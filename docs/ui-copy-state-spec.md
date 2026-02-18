# SoundMaxx Copy and State Spec (v2)

## Copy Principles
- State-first and action-oriented.
- Every message must answer one of these:
  - what is happening now
  - what should happen next
- Keep telemetry labels compact and uppercase.

## Home
- Hero intent: position SoundMaxx as an explicit command surface for creators and operators.
- Primary action: `Open Tool`.
- Secondary action: `View Ops`.
- Tool cards: `Launch` as direct route action.

## Upload Step
- State labels:
  - `idle`: `Waiting`
  - `preparing`: `Preparing`
  - `uploading`: `Uploading`
  - `uploaded`: `Uploaded`
  - `failed`: `Failed`
- Next-step helper text:
  - no file: `Select one audio file to start.`
  - file + rights unchecked: `Confirm rights to enable upload.`
  - in progress: `Upload in progress. Keep this tab open until completion.`
  - uploaded: `Upload complete. Configure process settings and run the tool.`

## Process Step
- Pipeline status body:
  - `idle`: `Awaiting processing telemetry.`
  - `queued`: `Queued and waiting for worker allocation.`
  - `running`: `Estimated time remaining: {etaSec}s` or `Processing in progress.`
  - `succeeded`: `Processing completed. Review outputs below.`
  - `failed`: `Processing failed. Adjust settings and retry.`
- Run action helper text:
  - disabled/no asset: `Upload audio first to enable processing.`
  - active job: `A processing job is active. Wait for completion before starting another run.`
  - ready: `Ready to run with current settings.`

## Results Step
- Empty: `No artifacts yet. Run a tool to generate outputs.`
- Expiry active: `Expires {datetime}`
- Expired: `Expired {datetime}`

## Ops
- Health labels:
  - `Syncing`
  - `Healthy`
  - `Processing`
  - `Degraded`
- Degraded warning uses API degraded message when present.
- Intervention body adapts to failure and queue conditions.
