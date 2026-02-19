# SoundMaxx Command Surface Spec (v2)

## Intent
Deliver one coherent command-deck experience where users can answer three questions in order:
1. Why this product matters.
2. How risky the current state is.
3. What action to take next.

The UI must work for:
- creators moving quickly through tools
- operators validating platform posture
- advanced users inspecting status and evidence

## Information Architecture
1. Home (`/`)
- Hero: explicit value proposition + dominant `Open Tool` action.
- Orientation rail: `Upload`, `Process`, `Export` sequence.
- Signal cards: state-first explanation of trust features.
- Tool matrix: one card per workflow with readiness and direct launch action.
2. Tool Studio (`/tools/[slug]`)
- Workspace hero with intent, safeguards, and workflow rail.
- Three execution phases:
  - `1. Upload`
  - `2. Process`
  - `3. Results + A/B Compare`
- Controls are progressive:
  - keep essentials visible
  - place tuning controls inside an expandable control block
3. Ops (`/ops`)
- Ops hero with posture badge (`Syncing`, `Healthy`, `Processing`, `Degraded`).
- Metrics grid: sessions, active jobs, failures, queue depth.
- Operator playbook + threshold interpretation.

## Navigation Contract
- Sticky header includes:
  - brand lockup
  - `Home`, `Ops`, and `Tools` dropdown
  - theme toggle
  - one dominant `Open Tool` CTA
- Mobile nav:
  - overlay panel
  - includes same route set as desktop
  - keeps `Open Tool` visible in-panel

## Visual System
- Palette: Ink + Cobalt + Coral + Mint accents.
- Surface hierarchy:
  - `smx-dark-frame`: orientation/hero sections
  - `smx-frame`: primary containers
  - `smx-subframe`: nested controls/cards
- Typography:
  - display-weight geometric sans for hierarchy
  - mono token support for telemetry snippets
- Motion:
  - purposeful enter/hover transitions only
  - respect reduced motion settings

## State Clarity Rules
- Each major phase must include:
  - current state label
  - next-step helper text
  - explicit failure copy when relevant
- Disabled actions must always have adjacent reason text.
- Risk/status meaning must not rely on color alone.

## Theme Parity
- Dark mode can be set through `.dark` or `[data-theme="dark"]`.
- All state badges, borders, and text remain AA-legible in light and dark themes.
- Theme switch must not cause layout shifts or missing affordances.

## Validation Requirements
- No console errors on:
  - `/`
  - `/tools/stem-isolation`
  - `/ops`
- No non-2xx route-level failures for these UI checks.
- Capture artifacts for:
  - desktop `/`, `/tools/stem-isolation`, `/ops`
  - mobile `/`, `/tools/stem-isolation`, `/ops`
  - dark theme parity samples for the same routes

## Reliability + Recovery Delta
- Job execution trust states are first-class and explicit in tool UI:
  - `Healthy`
  - `Recovering`
  - `Fallback Output`
  - `Failed After Retry`
- Process surfaces must show:
  - current recovery state
  - retry attempt count
  - quality flags (or `none`)
- Rerun UX must include:
  - one-click smart rerun presets
  - recent-run recall (`Use Recent Run Settings`)
  - post-result quality feedback (`usable` vs `needs rerun` with reason)
- Ops must present:
  - split rerun diagnostics (`same tool+asset`, `cross-tool chain`, `post-failure retry`)
  - confidence labels for trend interpretation in low-volume windows
  - direct operator remediation action to trigger stale-job recovery sweeps
