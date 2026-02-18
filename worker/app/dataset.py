from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Iterable


def dataset_root() -> Path:
    root = Path(os.getenv("DATASET_ROOT", "worker/data/consented")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def capture_training_sample(
    *,
    source_session_id: str,
    job_id: str,
    tool_type: str,
    input_file: Path,
    output_files: Iterable[Path],
    params: dict,
) -> None:
    root = dataset_root()
    sample_dir = root / source_session_id / job_id
    sample_dir.mkdir(parents=True, exist_ok=True)

    input_target = sample_dir / input_file.name
    shutil.copy2(input_file, input_target)

    output_targets: list[str] = []
    for file in output_files:
        target = sample_dir / file.name
        shutil.copy2(file, target)
        output_targets.append(target.name)

    manifest_path = root / "manifest.jsonl"
    with manifest_path.open("a", encoding="utf-8") as f:
        f.write(
            json.dumps(
                {
                    "job_id": job_id,
                    "session_id": source_session_id,
                    "tool_type": tool_type,
                    "input": f"{source_session_id}/{job_id}/{input_file.name}",
                    "outputs": [f"{source_session_id}/{job_id}/{name}" for name in output_targets],
                    "params": params,
                }
            )
            + "\n"
        )
