from __future__ import annotations

import json
import os
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


@dataclass
class TrainingWindow:
    start: datetime
    end: datetime


def _dataset_root() -> Path:
    root = Path(os.getenv("DATASET_ROOT", "worker/data/consented")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _model_output_root() -> Path:
    root = Path(os.getenv("MODEL_ARTIFACT_ROOT", "worker/data/models")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _load_manifest_rows(window: TrainingWindow) -> list[dict[str, Any]]:
    manifest = _dataset_root() / "manifest.jsonl"
    if not manifest.exists():
        return []

    rows: list[dict[str, Any]] = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue

        captured_at = _parse_iso(row.get("captured_at"))
        if captured_at is None:
            continue
        if captured_at < window.start or captured_at > window.end:
            continue
        rows.append(row)

    return rows


def _mode(values: list[Any], fallback: Any) -> Any:
    if not values:
        return fallback
    counts = Counter(values)
    return counts.most_common(1)[0][0]


def _avg(values: list[float], fallback: float) -> float:
    if not values:
        return fallback
    return float(sum(values) / len(values))


def _train_lightweight_recommenders(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_tool: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        tool_type = str(row.get("tool_type") or "")
        if not tool_type:
            continue
        by_tool.setdefault(tool_type, []).append(row)

    stem_rows = by_tool.get("stem_isolation", [])
    stem_stems = []
    stem_variants = []
    for row in stem_rows:
        params = row.get("params", {})
        if isinstance(params, dict):
            stems = params.get("stems")
            if isinstance(stems, int):
                stem_stems.append(stems)
            variant = params.get("fallbackModel")
            if isinstance(variant, str):
                stem_variants.append(variant)

    mastering_rows = by_tool.get("mastering", [])
    mastering_presets = []
    mastering_intensities = []
    for row in mastering_rows:
        params = row.get("params", {})
        if isinstance(params, dict):
            preset = params.get("preset")
            if isinstance(preset, str):
                mastering_presets.append(preset)
            intensity = params.get("intensity")
            if isinstance(intensity, (int, float)):
                mastering_intensities.append(float(intensity))

    midi_rows = by_tool.get("midi_extract", [])
    midi_sensitivities = []
    for row in midi_rows:
        params = row.get("params", {})
        if isinstance(params, dict):
            sensitivity = params.get("sensitivity")
            if isinstance(sensitivity, (int, float)):
                midi_sensitivities.append(float(sensitivity))

    recommendations = {
        "stem_isolation": {
            "recommended_stems": int(_mode(stem_stems, 4)),
            "recommended_variant": str(_mode(stem_variants, "mel_band_roformer")),
            "samples": len(stem_rows),
        },
        "mastering": {
            "recommended_preset": str(_mode(mastering_presets, "streaming_clean")),
            "recommended_intensity": round(_avg(mastering_intensities, 60.0), 2),
            "samples": len(mastering_rows),
        },
        "midi_extract": {
            "recommended_sensitivity": round(_avg(midi_sensitivities, 0.5), 3),
            "samples": len(midi_rows),
        },
    }

    return recommendations


def run_training_cycle(window_hours: int = 48) -> dict[str, Any]:
    end = datetime.now(UTC)
    start = end - timedelta(hours=max(1, window_hours))
    window = TrainingWindow(start=start, end=end)

    rows = _load_manifest_rows(window)
    recommendations = _train_lightweight_recommenders(rows)

    output = {
        "generated_at": end.isoformat(),
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "rows_used": len(rows),
        "recommendations": recommendations,
    }

    filename = f"lightweight-recommenders-{end.strftime('%Y%m%dT%H%M%SZ')}.json"
    artifact = _model_output_root() / filename
    artifact.write_text(json.dumps(output, indent=2), encoding="utf-8")

    return {
        "artifact": str(artifact),
        "rows_used": len(rows),
        "recommendations": recommendations,
    }


if __name__ == "__main__":
    result = run_training_cycle(window_hours=int(os.getenv("TRAINING_WINDOW_HOURS", "48")))
    print(json.dumps(result, indent=2))
