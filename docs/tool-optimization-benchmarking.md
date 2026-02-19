# Tool Optimization and Benchmarking

This project now uses two benchmark layers:

1. Contract and production functionality benchmark (runnable in this repo now)
2. MIR research benchmark standards (dataset-driven references for offline model evaluation)

## 1) Runnable production benchmark

Run the full production-contract benchmark with repeated iterations:

```bash
npm run test:benchmark:live
```

Or customize:

```bash
npx tsx scripts/tool-benchmark.ts \
  --base-url https://soundmaxx.vercel.app \
  --iterations 3 \
  --tool-timeout-sec 900 \
  --baseline-file output/benchmarks/<previous-report>.json
```

What it enforces per tool:
- `stem_isolation`: exactly 4 WAV stems + ZIP, required stem names (`vocals`, `drums`, `bass`, `other`), non-identical stem payload hashes.
- `mastering`: mastered audio exists, mastering report JSON exists, mastered output is not byte-identical to source, report engine is present.
- `key_bpm`: JSON output exists with valid `key` string and numeric `bpm`.
- `loudness_report`: JSON output includes numeric `integratedLufs`, `truePeakDbtp`, and `dynamicRange`.
- `midi_extract`: at least one MIDI file exists and starts with valid MIDI header (`MThd`).

The benchmark report includes:
- run pass/fail rate
- per-tool pass/fail rate
- per-tool latency `min/max/avg/p50/p95`
- optional baseline delta comparison for regression tracking

## 2) MIR benchmark standards (reference)

For deeper model-quality benchmarking beyond live contracts, these are the primary standards:

- Source separation: MUSDB18 + BSS Eval/SDR style metrics
  - Dataset overview: https://sigsep.github.io/datasets/
  - Evaluation tooling context: https://github.com/sigsep/sigsep-mus-eval
  - MIR Eval separation API: https://mir-eval.readthedocs.io/latest/api/separation.html

- Key and tempo estimation:
  - GiantSteps key dataset: https://github.com/GiantSteps/giantsteps-key-dataset
  - MIR Eval key metrics (weighted score): https://mir-eval.readthedocs.io/latest/api/key.html
  - MIR Eval tempo metrics: https://mir-eval.readthedocs.io/latest/api/tempo.html

- Audio-to-MIDI transcription:
  - MAESTRO dataset: https://magenta.tensorflow.org/datasets/maestro
  - MIR Eval transcription metrics (precision/recall/F1): https://mir-eval.readthedocs.io/latest/api/transcription.html

- Runtime optimization guidance (for ONNX-based inference):
  - ONNX Runtime threading/performance tuning: https://onnxruntime.ai/docs/performance/tune-performance/threading.html

- Basic Pitch inference thresholds and model API used by this project:
  - https://github.com/spotify/basic-pitch/blob/main/basic_pitch/inference.py

## Notes

The production benchmark in this repo is intentionally strict on output correctness and end-to-end tool behavior. Dataset-level MIR evaluation is complementary and should be run as an offline model-quality pipeline when full benchmark datasets are available in the environment.
