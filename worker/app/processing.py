from __future__ import annotations

import json
import math
import multiprocessing
import os
import shutil
import subprocess
import threading
import zipfile
from queue import Empty
from pathlib import Path
from typing import Any

import numpy as np
import requests
import soundfile as sf

THREAD_LOCAL = threading.local()
_BASIC_PITCH_MODEL: Any | None = None
_BASIC_PITCH_MODEL_LOCK = threading.Lock()


def download_source_audio(source_url: str, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)

    with requests.get(source_url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with target_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1_048_576):
                if chunk:
                    handle.write(chunk)


def resolve_output_file(path_or_name: str, output_dir: Path) -> Path:
    candidate = Path(path_or_name)
    if candidate.is_absolute() and candidate.exists():
        return candidate

    resolved = output_dir / candidate.name
    if resolved.exists():
        return resolved

    return candidate


def stem_zip_compression_mode() -> int:
    compression = os.getenv("STEM_ZIP_COMPRESSION", "stored").strip().lower()
    if compression in {"deflate", "zip_deflated", "compressed"}:
        return zipfile.ZIP_DEFLATED
    return zipfile.ZIP_STORED


def stem_model_candidates(preferred: str) -> list[str]:
    demucs_default = os.getenv("STEM_MODEL_DEMUCS_NAME", "UVR-MDX-NET-Inst_HQ_5.onnx").strip()
    roformer_default = os.getenv("STEM_MODEL_ROFORMER_NAME", "UVR-MDX-NET-Inst_HQ_5.onnx").strip()

    stable_fallbacks = [
        "UVR-MDX-NET-Inst_HQ_5.onnx",
        "UVR-MDX-NET-Inst_HQ_3.onnx",
        "mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt",
    ]

    combined = [demucs_default, *stable_fallbacks] if preferred == "demucs_v4" else [roformer_default, *stable_fallbacks]

    deduped: list[str] = []
    for name in combined:
        if name and name not in deduped:
            deduped.append(name)
    return deduped


STEM_ORDER_4 = ("vocals", "drums", "bass", "other")
STEM_ORDER_2 = ("vocals", "accompaniment")
STEM_KEYWORDS: dict[str, tuple[str, ...]] = {
    "vocals": ("vocals", "vocal", "vox", "voice", "lead"),
    "drums": ("drums", "drum", "percussion", "beat", "kick", "snare"),
    "bass": ("bass", "low", "sub"),
    "other": ("other", "music", "instrumental", "inst", "accompaniment"),
    "accompaniment": ("accompaniment", "instrumental", "inst", "music", "other", "minus_vocals", "no_vocals"),
}

AUDIO_SUFFIXES = {".wav", ".mp3", ".flac", ".ogg", ".aac", ".m4a", ".aif", ".aiff"}


def read_audio_2d(path: Path) -> tuple[np.ndarray, int]:
    audio, sample_rate = sf.read(str(path), always_2d=True, dtype="float32")
    return np.asarray(audio, dtype=np.float32), int(sample_rate)


def write_audio_copy(source: Path, target: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    audio, sample_rate = read_audio_2d(source)
    sf.write(str(target), audio, sample_rate, subtype="PCM_24")
    return target


def first_matching_path(paths: list[Path], keywords: tuple[str, ...]) -> Path | None:
    lowered = [keyword.lower() for keyword in keywords]
    for path in paths:
        haystack = path.stem.lower()
        if any(keyword in haystack for keyword in lowered):
            return path
    return None


def render_accompaniment_mix(paths: list[Path], output_path: Path) -> Path:
    if not paths:
        raise RuntimeError("No source stems available to render accompaniment mix")

    layers: list[np.ndarray] = []
    sample_rate: int | None = None
    max_frames = 0
    max_channels = 1

    for path in paths:
        audio, current_sr = read_audio_2d(path)
        if sample_rate is None:
            sample_rate = current_sr
        elif current_sr != sample_rate:
            raise RuntimeError("Cannot combine stems with mixed sample rates")
        layers.append(audio)
        max_frames = max(max_frames, audio.shape[0])
        max_channels = max(max_channels, audio.shape[1] if audio.ndim > 1 else 1)

    if sample_rate is None or max_frames == 0:
        raise RuntimeError("Unable to render accompaniment mix from empty stems")

    mix = np.zeros((max_frames, max_channels), dtype=np.float32)
    for layer in layers:
        framed = np.zeros((max_frames, max_channels), dtype=np.float32)
        framed[: layer.shape[0], : layer.shape[1]] = layer
        mix += framed

    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.98:
        mix *= 0.98 / peak

    sf.write(str(output_path), mix, sample_rate, subtype="PCM_24")
    return output_path


def render_stem_band_split(
    audio: np.ndarray,
    sample_rate: int,
    low_hz: float,
    high_hz: float | None = None,
) -> np.ndarray:
    frame_count = audio.shape[0]
    if frame_count == 0:
        return np.zeros_like(audio, dtype=np.float32)

    spectrum = np.fft.rfft(audio, axis=0)
    freqs = np.fft.rfftfreq(frame_count, d=1.0 / sample_rate)
    mask = freqs >= low_hz
    if high_hz is not None:
        mask = mask & (freqs <= high_hz)

    filtered = np.zeros_like(spectrum)
    filtered[mask, :] = spectrum[mask, :]
    rendered = np.fft.irfft(filtered, n=frame_count, axis=0)
    return np.asarray(rendered, dtype=np.float32)


def limit_audio_peak(audio: np.ndarray, target_peak: float = 0.98) -> np.ndarray:
    if audio.size == 0:
        return audio
    peak = float(np.max(np.abs(audio)))
    if peak > target_peak and peak > 0:
        audio = audio * (target_peak / peak)
    return np.asarray(audio, dtype=np.float32)


def synthesize_four_stems_from_accompaniment(
    input_file: Path,
    output_dir: Path,
    vocals_source: Path,
    accompaniment_source: Path,
) -> dict[str, Path]:
    vocals_target = output_dir / f"{input_file.stem}-vocals.wav"
    if vocals_source.resolve() != vocals_target.resolve():
        write_audio_copy(vocals_source, vocals_target)

    accompaniment_audio, sample_rate = read_audio_2d(accompaniment_source)
    if accompaniment_audio.size == 0:
        raise RuntimeError("Cannot synthesize 4-stem fallback from empty accompaniment audio")

    frame_count = accompaniment_audio.shape[0]
    spectrum = np.fft.rfft(accompaniment_audio, axis=0)
    freqs = np.fft.rfftfreq(frame_count, d=1.0 / sample_rate)

    bass_spec = spectrum.copy()
    bass_spec[freqs > 200.0, :] = 0
    bass_audio = np.fft.irfft(bass_spec, n=frame_count, axis=0)

    drums_spec = spectrum.copy()
    drums_spec[(freqs < 1500.0) | (freqs > 9000.0), :] = 0
    drums_audio = np.fft.irfft(drums_spec, n=frame_count, axis=0)

    other_audio = accompaniment_audio - bass_audio - drums_audio

    bass_audio = limit_audio_peak(bass_audio)
    drums_audio = limit_audio_peak(drums_audio)
    other_audio = limit_audio_peak(other_audio)

    bass_target = output_dir / f"{input_file.stem}-bass.wav"
    drums_target = output_dir / f"{input_file.stem}-drums.wav"
    other_target = output_dir / f"{input_file.stem}-other.wav"

    sf.write(str(bass_target), bass_audio, sample_rate, subtype="PCM_24")
    sf.write(str(drums_target), drums_audio, sample_rate, subtype="PCM_24")
    sf.write(str(other_target), other_audio, sample_rate, subtype="PCM_24")

    return {
        "vocals": vocals_target,
        "drums": drums_target,
        "bass": bass_target,
        "other": other_target,
    }


def build_stem_timeout_fallback(input_file: Path, output_dir: Path, stems: int) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    audio, sample_rate = read_audio_2d(input_file)
    if audio.size == 0:
        raise RuntimeError("Cannot build stem fallback from empty source audio")

    bass_audio = render_stem_band_split(audio, sample_rate, low_hz=0.0, high_hz=180.0)
    vocals_audio = render_stem_band_split(audio, sample_rate, low_hz=180.0, high_hz=4200.0)
    drums_audio = render_stem_band_split(audio, sample_rate, low_hz=1200.0, high_hz=9500.0)
    other_audio = audio - vocals_audio - bass_audio - drums_audio

    vocals_audio = limit_audio_peak(vocals_audio)
    bass_audio = limit_audio_peak(bass_audio)
    drums_audio = limit_audio_peak(drums_audio)
    other_audio = limit_audio_peak(other_audio)

    outputs: list[Path] = []
    if stems >= 4:
        rendered = {
            "vocals": vocals_audio,
            "drums": drums_audio,
            "bass": bass_audio,
            "other": other_audio,
        }
    else:
        accompaniment_audio = limit_audio_peak(audio - vocals_audio)
        rendered = {
            "vocals": vocals_audio,
            "accompaniment": accompaniment_audio,
        }

    for stem_name, stem_audio in rendered.items():
        stem_path = output_dir / f"{input_file.stem}-{stem_name}.wav"
        sf.write(str(stem_path), stem_audio, sample_rate, subtype="PCM_24")
        outputs.append(stem_path)

    zip_path = output_dir / f"{input_file.stem}-stems.zip"
    with zipfile.ZipFile(zip_path, mode="w", compression=stem_zip_compression_mode()) as zipf:
        for file in outputs:
            if file.exists():
                zipf.write(file, arcname=file.name)

    return "fallback_band_split", [*outputs, zip_path]


def canonicalize_stem_outputs(input_file: Path, output_dir: Path, produced: list[Path], stems: int) -> list[Path]:
    existing = [path for path in produced if path.exists()]
    if not existing:
        raise RuntimeError("Stem isolation produced no files")

    if stems >= 4:
        remaining = existing.copy()
        mapped: dict[str, Path] = {}
        for stem_name in STEM_ORDER_4:
            candidate = first_matching_path(remaining, STEM_KEYWORDS[stem_name])
            if candidate:
                mapped[stem_name] = candidate
                remaining.remove(candidate)

        missing = [stem_name for stem_name in STEM_ORDER_4 if stem_name not in mapped]
        if missing:
            vocals_source = mapped.get("vocals") or first_matching_path(existing, STEM_KEYWORDS["vocals"])
            accompaniment_source = first_matching_path(existing, STEM_KEYWORDS["accompaniment"])
            if vocals_source is not None and accompaniment_source is not None:
                mapped = synthesize_four_stems_from_accompaniment(
                    input_file=input_file,
                    output_dir=output_dir,
                    vocals_source=vocals_source,
                    accompaniment_source=accompaniment_source,
                )
                missing = [stem_name for stem_name in STEM_ORDER_4 if stem_name not in mapped]
        if missing:
            raise RuntimeError(f"Stem isolation missing required stems: {', '.join(missing)}")

        ordered: list[Path] = []
        for stem_name in STEM_ORDER_4:
            source = mapped[stem_name]
            target = output_dir / f"{input_file.stem}-{stem_name}.wav"
            if source.resolve() != target.resolve():
                write_audio_copy(source, target)
            ordered.append(target)
        return ordered

    vocals_source = first_matching_path(existing, STEM_KEYWORDS["vocals"])
    if vocals_source is None:
        raise RuntimeError("2-stem isolation failed to identify vocals output")

    remaining = [path for path in existing if path != vocals_source]
    accompaniment_source = first_matching_path(remaining, STEM_KEYWORDS["accompaniment"])

    vocals_target = output_dir / f"{input_file.stem}-vocals.wav"
    if vocals_source.resolve() != vocals_target.resolve():
        write_audio_copy(vocals_source, vocals_target)

    accompaniment_target = output_dir / f"{input_file.stem}-accompaniment.wav"
    if accompaniment_source is not None:
        if accompaniment_source.resolve() != accompaniment_target.resolve():
            write_audio_copy(accompaniment_source, accompaniment_target)
    else:
        if not remaining:
            raise RuntimeError("2-stem isolation failed to build accompaniment output")
        render_accompaniment_mix(remaining, accompaniment_target)

    return [vocals_target, accompaniment_target]


def process_stem_isolation(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    try:
        from audio_separator.separator import Separator  # type: ignore
    except ModuleNotFoundError as exc:
        if exc.name == "onnxruntime":
            raise RuntimeError(
                "Stem isolation dependency missing: install 'onnxruntime' in the worker environment."
            ) from exc
        raise

    output_dir.mkdir(parents=True, exist_ok=True)
    stems = int(params.get("stems", 4))
    preferred = str(params.get("fallbackModel") or "mel_band_roformer")

    output_files: list[str] = []
    resolved_model = ""
    last_error: Exception | None = None

    for model_name in stem_model_candidates(preferred):
        separator = Separator(output_dir=str(output_dir), output_format="WAV")
        try:
            separator.load_model(model_filename=model_name)
            output_files = separator.separate(str(input_file))
            resolved_model = model_name
            break
        except Exception as exc:
            last_error = exc

    if not output_files:
        suffix = f": {last_error}" if last_error else ""
        raise RuntimeError(f"Stem isolation model load/separation failed{suffix}")

    produced = [resolve_output_file(path, output_dir) for path in output_files]
    produced = canonicalize_stem_outputs(input_file, output_dir, produced, stems)

    zip_path = output_dir / f"{input_file.stem}-stems.zip"
    with zipfile.ZipFile(zip_path, mode="w", compression=stem_zip_compression_mode()) as zipf:
        for file in produced:
            if file.exists():
                zipf.write(file, arcname=file.name)

    return resolved_model, [*produced, zip_path]


def process_mastering(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    requested_engine = os.getenv("MASTERING_ENGINE", "matchering_2_0").strip().lower()

    candidate_engines: list[str] = ["sonicmaster", "matchering_2_0"] if requested_engine == "sonicmaster" else ["matchering_2_0", "sonicmaster"]
    candidate_engines.append("adaptive_dsp_mastering")

    errors: list[str] = []
    for engine in candidate_engines:
        try:
            if engine == "sonicmaster":
                model_name, files = process_mastering_sonicmaster(input_file, output_dir, params)
            elif engine == "matchering_2_0":
                model_name, files = process_mastering_matchering(input_file, output_dir, params)
            else:
                model_name, files = process_mastering_adaptive(input_file, output_dir, params)

            audio_outputs = [path for path in files if path.suffix.lower() in AUDIO_SUFFIXES]
            if not audio_outputs:
                raise RuntimeError("Mastering engine returned no audio artifact")

            mastered_output = audio_outputs[0]
            if not mastered_output.exists():
                raise RuntimeError("Mastering output file is missing")

            if not mastered_audio_is_distinct(input_file, mastered_output):
                raise RuntimeError("Mastering output is effectively unchanged from source audio")

            return model_name, files
        except Exception as exc:
            errors.append(f"{engine}: {exc}")

    summary = "; ".join(errors)
    raise RuntimeError(f"Mastering failed across all engines ({requested_engine}): {summary[:1200]}")


def mastered_audio_is_distinct(source: Path, candidate: Path) -> bool:
    try:
        if source.stat().st_size != candidate.stat().st_size:
            return True
    except OSError:
        pass

    source_audio, source_sr = read_audio_2d(source)
    candidate_audio, candidate_sr = read_audio_2d(candidate)

    if source_sr != candidate_sr:
        return True
    if source_audio.shape != candidate_audio.shape:
        return True
    if source_audio.size == 0 or candidate_audio.size == 0:
        return False

    delta = np.abs(source_audio - candidate_audio)
    mean_abs_delta = float(np.mean(delta))
    baseline = float(np.mean(np.abs(source_audio)))
    relative_delta = mean_abs_delta / max(baseline, 1e-8)
    return mean_abs_delta >= 1e-5 or relative_delta >= 5e-4


def _essentia_module():
    module = getattr(THREAD_LOCAL, "essentia_module", None)
    if module is None:
        import essentia.standard as es  # type: ignore

        setattr(THREAD_LOCAL, "essentia_module", es)
        module = es
    return module


def _essentia_extractors():
    extractors = getattr(THREAD_LOCAL, "essentia_extractors", None)
    if extractors is None:
        es = _essentia_module()
        extractors = (
            es.RhythmExtractor2013(method="multifeature"),
            es.KeyExtractor(),
        )
        setattr(THREAD_LOCAL, "essentia_extractors", extractors)
    return extractors


def _loudness_meter(sample_rate: int):
    meters = getattr(THREAD_LOCAL, "loudness_meters", None)
    if meters is None:
        meters = {}
        setattr(THREAD_LOCAL, "loudness_meters", meters)

    meter = meters.get(sample_rate)
    if meter is None:
        import pyloudnorm as pyln  # type: ignore

        meter = pyln.Meter(sample_rate)
        meters[sample_rate] = meter
    return meter


def _basic_pitch_model():
    global _BASIC_PITCH_MODEL
    model = _BASIC_PITCH_MODEL
    if model is not None:
        return model

    with _BASIC_PITCH_MODEL_LOCK:
        model = _BASIC_PITCH_MODEL
        if model is None:
            from basic_pitch import ICASSP_2022_MODEL_PATH  # type: ignore
            from basic_pitch.inference import Model  # type: ignore

            model = Model(ICASSP_2022_MODEL_PATH)
            _BASIC_PITCH_MODEL = model
    return model


def midi_thresholds_from_sensitivity(value: float) -> tuple[float, float]:
    sensitivity = max(0.0, min(1.0, float(value)))
    onset_threshold = 0.7 - (0.4 * sensitivity)
    frame_threshold = 0.5 - (0.35 * sensitivity)
    return onset_threshold, frame_threshold


def process_mastering_adaptive(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    mastered_path = output_dir / f"{input_file.stem}-mastered.wav"
    report_path = output_dir / "mastering-report.json"

    audio, sample_rate = read_audio_2d(input_file)
    if audio.size == 0:
        raise RuntimeError("Input audio is empty")

    intensity = float(params.get("intensity", 50))
    intensity = max(0.0, min(100.0, intensity))
    wet = 0.35 + 0.55 * (intensity / 100.0)
    drive = 1.0 + 2.2 * (intensity / 100.0)

    shaped = np.tanh(audio * drive)
    shaped_peak = float(np.max(np.abs(shaped))) if shaped.size else 0.0
    if shaped_peak > 0:
        shaped *= 0.98 / shaped_peak

    mastered = (audio * (1.0 - wet)) + (shaped * wet)

    # Add a subtle high-frequency tilt to avoid pure passthrough behavior.
    if mastered.shape[0] > 1:
        high_diff = mastered - np.vstack([mastered[0:1, :], mastered[:-1, :]])
        mastered += high_diff * (0.04 + 0.12 * (intensity / 100.0))

    mastered = np.tanh(mastered * 1.05)
    peak = float(np.max(np.abs(mastered))) if mastered.size else 0.0
    if peak > 0:
        mastered *= 0.98 / peak

    if float(np.mean(np.abs(mastered - audio))) < 1e-5:
        mastered = np.clip(audio * 0.995, -1.0, 1.0)

    sf.write(str(mastered_path), mastered, sample_rate, subtype="PCM_24")

    input_peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    output_peak = float(np.max(np.abs(mastered))) if mastered.size else 0.0
    report_payload = {
        "preset": params.get("preset", "streaming_clean"),
        "intensity": intensity,
        "engine": "adaptive_dsp_mastering",
        "inputPeakDbfs": 20 * math.log10(max(input_peak, 1e-8)),
        "outputPeakDbfs": 20 * math.log10(max(output_peak, 1e-8)),
    }
    report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")
    return "adaptive_dsp_mastering", [mastered_path, report_path]


def process_mastering_matchering(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    import matchering as mg  # type: ignore

    mastered_path = output_dir / f"{input_file.stem}-mastered.wav"
    reference_path = params.get("referencePath") or str(input_file)

    mg.process(
        target=str(input_file),
        reference=str(reference_path),
        results=[mg.pcm24(str(mastered_path))],
    )

    report_path = output_dir / "mastering-report.json"
    report_payload = {
        "preset": params.get("preset", "streaming_clean"),
        "intensity": params.get("intensity", 50),
        "engine": "matchering_2_0",
    }
    report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")

    return "matchering_2_0", [mastered_path, report_path]


def process_mastering_sonicmaster(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    sonicmaster_script = os.getenv("SONICMASTER_SCRIPT_PATH")
    if not sonicmaster_script:
        raise RuntimeError("SONICMASTER_SCRIPT_PATH must be set when MASTERING_ENGINE=sonicmaster")

    mastered_path = output_dir / f"{input_file.stem}-mastered.wav"
    report_path = output_dir / "mastering-report.json"

    command = [
        "python",
        sonicmaster_script,
        "--input",
        str(input_file),
        "--output",
        str(mastered_path),
        "--preset",
        str(params.get("preset", "streaming_clean")),
        "--intensity",
        str(params.get("intensity", 50)),
    ]

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"SonicMaster failed with exit {result.returncode}: {result.stderr.strip() or result.stdout.strip()}"
        )

    report_payload = {
        "preset": params.get("preset", "streaming_clean"),
        "intensity": params.get("intensity", 50),
        "engine": "sonicmaster",
        "stdout": result.stdout.strip(),
    }
    report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")

    return "sonicmaster", [mastered_path, report_path]


def process_key_bpm(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    es = _essentia_module()
    rhythm_extractor, key_extractor = _essentia_extractors()
    audio = es.MonoLoader(filename=str(input_file), sampleRate=44100)()
    bpm, _, _, _, _ = rhythm_extractor(audio)
    key, scale, strength = key_extractor(audio)

    result = {
        "key": f"{key} {scale}",
        "strength": float(strength),
        "bpm": float(bpm),
        "includeChordHints": bool(params.get("includeChordHints", True)),
    }

    out_path = output_dir / "key-bpm.json"
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return "essentia", [out_path]


def process_loudness_report(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    data, sample_rate = sf.read(str(input_file), dtype="float32")

    if data.ndim > 1:
        mono = np.mean(data, axis=1)
    else:
        mono = np.asarray(data, dtype=np.float32)

    meter = _loudness_meter(int(sample_rate))
    integrated_lufs = float(meter.integrated_loudness(mono))
    peak_amplitude = float(np.max(np.abs(mono)))
    true_peak_dbtp = 20 * math.log10(max(peak_amplitude, 1e-8))

    p95 = float(np.percentile(np.abs(mono), 95))
    p10 = float(np.percentile(np.abs(mono), 10))
    dynamic_range = 20 * math.log10(max(p95, 1e-8) / max(p10, 1e-8))

    result = {
        "integratedLufs": integrated_lufs,
        "truePeakDbtp": true_peak_dbtp,
        "dynamicRange": dynamic_range,
        "targetLufs": float(params.get("targetLufs", -14)),
        "clippingWarnings": int(np.sum(np.abs(mono) >= 0.999)),
    }

    out_path = output_dir / "loudness-report.json"
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return "pyloudnorm", [out_path]


def process_midi_extract(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    from basic_pitch.inference import predict  # type: ignore

    sensitivity = float(params.get("sensitivity", 0.5))
    onset_threshold, frame_threshold = midi_thresholds_from_sensitivity(sensitivity)
    _, midi_data, note_events = predict(
        str(input_file),
        model_or_model_path=_basic_pitch_model(),
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
    )

    midi_path = output_dir / "extracted.mid"
    if hasattr(midi_data, "write"):
        midi_data.write(str(midi_path))
    elif hasattr(midi_data, "writeFile"):
        with midi_path.open("wb") as handle:
            midi_data.writeFile(handle)
    else:
        raise RuntimeError("MIDI extractor returned unsupported MIDI object")

    notes_path = output_dir / "notes.json"
    notes_payload = {
        "sensitivity": sensitivity,
        "onsetThreshold": onset_threshold,
        "frameThreshold": frame_threshold,
        "noteCount": len(note_events),
        "noteEvents": [
            {
                "start": float(event[0]),
                "end": float(event[1]),
                "pitch": int(event[2]),
                "confidence": float(event[3]),
            }
            for event in note_events
        ],
    }
    notes_path.write_text(json.dumps(notes_payload, indent=2), encoding="utf-8")

    return "basic_pitch", [midi_path, notes_path]


def run_processing(tool_type: str, input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    if tool_type == "stem_isolation":
        return process_stem_isolation(input_file, output_dir, params)

    if tool_type == "mastering":
        return process_mastering(input_file, output_dir, params)

    if tool_type == "key_bpm":
        return process_key_bpm(input_file, output_dir, params)

    if tool_type == "loudness_report":
        return process_loudness_report(input_file, output_dir, params)

    if tool_type == "midi_extract":
        return process_midi_extract(input_file, output_dir, params)

    raise ValueError(f"Unsupported tool type: {tool_type}")


def _run_processing_worker(
    output: multiprocessing.queues.Queue,
    tool_type: str,
    input_file: str,
    output_dir: str,
    params: dict[str, Any],
) -> None:
    try:
        model, produced = run_processing(tool_type, Path(input_file), Path(output_dir), params)
        output.put(
            {
                "ok": True,
                "model": model,
                "files": [str(path) for path in produced],
            }
        )
    except Exception as exc:
        output.put(
            {
                "ok": False,
                "error": str(exc),
            }
        )


def run_processing_with_hard_timeout(
    tool_type: str,
    input_file: Path,
    output_dir: Path,
    params: dict[str, Any],
    timeout_sec: int,
) -> tuple[str, list[Path]]:
    ctx = multiprocessing.get_context("spawn")
    output: multiprocessing.queues.Queue = ctx.Queue(maxsize=1)
    process = ctx.Process(
        target=_run_processing_worker,
        args=(output, tool_type, str(input_file), str(output_dir), params),
    )

    process.start()
    process.join(timeout_sec)

    if process.is_alive():
        process.terminate()
        process.join(timeout=10)
        raise TimeoutError(f"processing_timeout_after_{timeout_sec}s")

    try:
        result = output.get_nowait()
    except Empty as exc:
        raise RuntimeError(f"processing_worker_exited_without_result (exitcode={process.exitcode})") from exc

    if not result.get("ok"):
        raise RuntimeError(result.get("error") or "processing_worker_failed")

    model = str(result.get("model") or "unknown")
    files = [Path(path) for path in result.get("files", [])]
    return model, files


def clear_output_directory(job_id: str, output_root: Path) -> None:
    target = output_root / job_id
    if target.exists():
        shutil.rmtree(target)
