# SoundMaxx

SoundMaxx is a producer-focused web app where users upload audio and run real processing tools:

- Stem isolation (BS-RoFormer / Demucs via self-hosted worker)
- Mastering (SonicMaster via worker script path or Matchering fallback)
- Key + BPM detection (Essentia)
- Loudness analysis (pyloudnorm)
- MIDI extraction (Basic Pitch)

The web app runs on Vercel (Hobby), while heavy inference runs on a separate self-hosted worker service.

## Architecture

- **Next.js App Router**: frontend + API routes
- **Neon Postgres**: sessions, assets, jobs, artifacts, quotas
- **Upstash Redis**: IP throttling + queue counters
- **Vercel Blob**: uploaded sources + output artifacts
- **SoundMaxx Worker (`worker/`)**: executes open-source audio models and posts signed webhooks

## Redesigned UI Surfaces

- **Design language**: Minimal Brutal (Ink + Acid Mint), condensed display typography, mono telemetry text
- **Home (`/`)**: asymmetrical command-deck hero, signal-stack proof cards, split featured rails, dense tool matrix, timeline-style recent sessions
- **Tool pages (`/tools/[slug]`)**: mission panel + sticky workflow rail + hard-edged upload/process/results surfaces
- **Ops (`/ops`)**: industrial telemetry board with explicit degraded-state warnings
- **Global nav**: command-bar layout, theme toggle persistence, one dominant `Open Tool` action

## Quick Start

1. Install Node dependencies:

```bash
npm install
```

2. Copy environment template and set real values:

```bash
cp .env.example .env.local
```

3. Run SQL migration against Neon:

```bash
npm run db:migrate:sql
```

4. Start Next.js:

```bash
npm run dev
```

5. Start worker (separate terminal):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r worker/requirements.txt
export WORKER_API_KEY=replace-with-worker-api-key
export WORKER_PUBLIC_BASE_URL=http://localhost:8000
uvicorn worker.app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

- `POST /api/upload/init`
- `PUT /api/upload/content/:assetId`
- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/artifacts/:artifactId`
- `POST /api/provider/webhook/:provider`
- `GET /api/cron/cleanup`
- `GET /api/ops/summary`
- `GET /api/sessions/recent?limit=8`

## Data Retention and Consent

- Uploaded files and artifacts expire after **24 hours**.
- Cleanup endpoint removes expired assets/artifacts and marks stale jobs as expired.
- Optional training data capture is enabled only when user checks training consent at upload time.
- Consented samples are saved by the worker under `worker/data/consented` and indexed in `manifest.jsonl`.

## Running Tests

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:seo
```

## Preview Verification Workflow

1. Start the app: `npm run dev`
2. Visit:
- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/tools/stem-isolation`
- `http://127.0.0.1:3000/ops`
3. Confirm:
- no console errors
- no non-2xx network failures for core UI requests
- theme toggle persists after reload
- recent sessions panel handles populated, empty, and degraded responses
- desktop and mobile hierarchy remains clear (no repetitive card wall)

## Vercel Production Preflight

Run this before deploying to production:

```bash
npm run vercel:preflight -- soundmaxx.vercel.app
```

The check validates:
- Latest deployment is `Ready`
- Required env vars are configured (`APP_BASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, Upstash, worker auth/webhook secrets, and ops/cron secrets)

## Deploying to Vercel

1. Push repo and import project in Vercel.
2. Set all required env vars from `.env.example`.
3. Attach Neon, Upstash, and Blob credentials.
4. Ensure worker is deployed and publicly reachable.
5. Set `APP_BASE_URL` to your Vercel URL and align webhook secret with worker callback signing.

`vercel.json` includes a daily cleanup cron at `0 3 * * *` calling `/api/cron/cleanup`.
