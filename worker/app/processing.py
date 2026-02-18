from __future__ import annotations

import json
import math
import multiprocessing
import os
import shutil
import subprocess
import zipfile
from queue import Empty
from pathlib import Path
from typing import Any

import numpy as np
import requests
import soundfile as sf


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


def build_stem_fallback(input_file: Path, output_dir: Path, stems: int) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)

    if stems >= 4:
        stem_names = ["vocals", "drums", "bass", "other"]
    else:
        stem_names = ["vocals", "instrumental"]

    produced: list[Path] = []
    for stem_name in stem_names:
        stem_path = output_dir / f"{input_file.stem}-{stem_name}.wav"
        shutil.copy2(input_file, stem_path)
        produced.append(stem_path)

    zip_path = output_dir / f"{input_file.stem}-stems.zip"
    with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zipf:
        for file in produced:
            if file.exists():
                zipf.write(file, arcname=file.name)

    return "fallback_passthrough", [*produced, zip_path]


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
    if stems == 2 and len(produced) > 2:
        stem_candidates = [p for p in produced if "vocals" in p.name.lower() or "instrument" in p.name.lower()]
        produced = stem_candidates[:2] if len(stem_candidates) >= 2 else produced[:2]

    zip_path = output_dir / f"{input_file.stem}-stems.zip"
    with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zipf:
        for file in produced:
            if file.exists():
                zipf.write(file, arcname=file.name)

    return resolved_model, [*produced, zip_path]


def process_mastering(input_file: Path, output_dir: Path, params: dict[str, Any]) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    engine = os.getenv("MASTERING_ENGINE", "matchering_2_0").strip().lower()

    try:
        if engine == "sonicmaster":
            return process_mastering_sonicmaster(input_file, output_dir, params)

        return process_mastering_matchering(input_file, output_dir, params)
    except Exception as exc:
        return build_mastering_fallback(input_file, output_dir, params, engine, str(exc))


def build_mastering_fallback(
    input_file: Path,
    output_dir: Path,
    params: dict[str, Any],
    requested_engine: str,
    reason: str,
) -> tuple[str, list[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)

    mastered_path = output_dir / f"{input_file.stem}-mastered.wav"
    shutil.copy2(input_file, mastered_path)

    report_path = output_dir / "mastering-report.json"
    report_payload = {
        "preset": params.get("preset", "streaming_clean"),
        "intensity": params.get("intensity", 50),
        "requestedEngine": requested_engine,
        "engine": "fallback_passthrough",
        "fallbackReason": reason[:500],
    }
    report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")

    return "fallback_passthrough", [mastered_path, report_path]


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
    import essentia.standard as es  # type: ignore

    output_dir.mkdir(parents=True, exist_ok=True)
    audio = es.MonoLoader(filename=str(input_file), sampleRate=44100)()
    bpm, _, _, _, _ = es.RhythmExtractor2013(method="multifeature")(audio)
    key, scale, strength = es.KeyExtractor()(audio)

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
    import pyloudnorm as pyln  # type: ignore

    output_dir.mkdir(parents=True, exist_ok=True)
    data, sample_rate = sf.read(str(input_file))

    if data.ndim > 1:
        mono = np.mean(data, axis=1)
    else:
        mono = data

    meter = pyln.Meter(sample_rate)
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
    from basic_pitch.inference import predict  # type: ignore

    output_dir.mkdir(parents=True, exist_ok=True)
    _, midi_data, note_events = predict(str(input_file))

    midi_path = output_dir / "extracted.mid"
    with midi_path.open("wb") as handle:
        midi_data.writeFile(handle)

    notes_path = output_dir / "notes.json"
    notes_payload = {
        "sensitivity": float(params.get("sensitivity", 0.5)),
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
