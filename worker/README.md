# SoundMaxx Worker

This service runs the open-source audio pipelines used by SoundMaxx and sends signed webhooks back to the web app.

## Models and Engines

- Stem isolation: `audio-separator` with BS-RoFormer / Demucs model files.
- Mastering: Matchering 2.0.
- Key/BPM: Essentia.
- Loudness report: pyloudnorm.
- MIDI extraction: Spotify Basic Pitch.

## Run Locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r worker/requirements.txt
export WORKER_API_KEY=your-worker-key
export WORKER_PUBLIC_BASE_URL=http://localhost:8000
uvicorn worker.app.main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

- `WORKER_API_KEY` (required): Bearer key expected from the web app.
- `WORKER_PUBLIC_BASE_URL` (required in production): Public URL used to generate artifact links.
- `OUTPUT_ROOT` (optional): Output file directory. Default `worker/data/outputs`.
- `TMP_ROOT` (optional): Temp processing directory. Default `worker/data/tmp`.
- `DATASET_ROOT` (optional): Consented dataset directory. Default `worker/data/consented`.
- `STEM_MODEL_ROFORMER_NAME` (optional): BS-RoFormer model filename.
- `STEM_MODEL_DEMUCS_NAME` (optional): Demucs model filename.
- `MASTERING_ENGINE` (optional): `matchering_2_0` (default) or `sonicmaster`.
- `SONICMASTER_SCRIPT_PATH` (required when `MASTERING_ENGINE=sonicmaster`): path to SonicMaster inference script.

## Callback Contract

Worker sends signed callback with header `x-soundmaxx-signature` = `HMAC_SHA256(rawBody, webhookSecret)`.

Payload example:

```json
{
  "externalJobId": "job_123",
  "status": "succeeded",
  "progressPct": 100,
  "artifacts": [
    {
      "blobUrl": "https://worker.example.com/outputs/job_123/mastered.wav",
      "blobKey": "mastered.wav",
      "format": "wav",
      "sizeBytes": 102400
    }
  ]
}
```
