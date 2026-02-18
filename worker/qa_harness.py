from __future__ import annotations

import argparse
import json
from pathlib import Path

from worker.app.processing import run_processing


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SoundMaxx audio QA harness")
    parser.add_argument("--fixtures", required=True, help="Directory containing input audio fixtures")
    parser.add_argument("--out", default="worker/data/qa-results.json", help="Output JSON report path")
    parser.add_argument(
        "--tools",
        nargs="+",
        default=["stem_isolation", "mastering", "key_bpm", "loudness_report", "midi_extract"],
    )

    args = parser.parse_args()
    fixtures_dir = Path(args.fixtures)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fixtures = sorted(p for p in fixtures_dir.iterdir() if p.is_file())
    report: dict[str, dict] = {}

    for fixture in fixtures:
        fixture_report: dict[str, dict] = {}
        for tool in args.tools:
            output_dir = Path("worker/data/qa") / fixture.stem / tool
            output_dir.mkdir(parents=True, exist_ok=True)
            model, outputs = run_processing(tool, fixture, output_dir, {})
            fixture_report[tool] = {
                "model": model,
                "outputs": [str(path) for path in outputs if path.exists()],
            }
        report[fixture.name] = fixture_report

    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote QA report: {out_path}")


if __name__ == "__main__":
    main()
