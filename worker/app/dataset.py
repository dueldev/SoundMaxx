from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable
from uuid import uuid4


def dataset_root() -> Path:
    root = Path(os.getenv("DATASET_ROOT", "worker/data/consented")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _hash_text(value: str) -> str:
    return _hash_bytes(value.encode("utf-8"))


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _feature_summary(input_file: Path, output_files: list[Path]) -> dict:
    output_sizes = [f.stat().st_size for f in output_files if f.exists()]
    total_output_size = sum(output_sizes)
    return {
        "inputSizeBytes": input_file.stat().st_size if input_file.exists() else 0,
        "outputCount": len(output_files),
        "outputSizeBytesTotal": total_output_size,
        "outputSizeBytesAverage": int(total_output_size / len(output_sizes)) if output_sizes else 0,
    }


def capture_training_sample(
    *,
    source_session_id: str,
    job_id: str,
    tool_type: str,
    input_file: Path,
    output_files: Iterable[Path],
    params: dict,
    policy_version: str,
) -> None:
    root = dataset_root()
    captured_at = datetime.now(timezone.utc)
    raw_retention_days = max(1, int(os.getenv("DATASET_RAW_RETENTION_DAYS", "90")))
    derived_retention_days = max(raw_retention_days, int(os.getenv("DATASET_DERIVED_RETENTION_DAYS", "365")))

    sample_id = str(uuid4())
    session_salt = os.getenv("DATASET_SESSION_SALT", "soundmaxx-dataset-salt")
    session_fingerprint = _hash_text(f"{session_salt}:{source_session_id}")

    sample_dir = root / "samples" / sample_id
    sample_dir.mkdir(parents=True, exist_ok=True)

    input_target = sample_dir / input_file.name
    shutil.copy2(input_file, input_target)
    input_hash = _file_hash(input_target)

    output_manifest: list[dict[str, str]] = []
    copied_outputs: list[Path] = []
    for file in output_files:
        target = sample_dir / file.name
        shutil.copy2(file, target)
        copied_outputs.append(target)
        output_manifest.append(
            {
                "name": target.name,
                "path": f"samples/{sample_id}/{target.name}",
                "sha256": _file_hash(target),
            }
        )

    features = _feature_summary(input_target, copied_outputs)
    metadata = {
        "sample_id": sample_id,
        "job_id": job_id,
        "session_fingerprint": session_fingerprint,
        "tool_type": tool_type,
        "capture_mode": "implied_use",
        "policy_version": policy_version,
        "captured_at": captured_at.isoformat(),
        "raw_expires_at": (captured_at + timedelta(days=raw_retention_days)).isoformat(),
        "derived_expires_at": (captured_at + timedelta(days=derived_retention_days)).isoformat(),
        "input": {
            "name": input_target.name,
            "path": f"samples/{sample_id}/{input_target.name}",
            "sha256": input_hash,
        },
        "outputs": output_manifest,
        "params": params,
        "outcome": {
            "output_count": len(output_manifest),
        },
        "features": features,
    }

    metadata_path = sample_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    manifest_path = root / "manifest.jsonl"
    with manifest_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(metadata) + "\n")
