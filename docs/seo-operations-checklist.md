# SEO Operations Checklist

## 1. Search Console Setup
- Add a Domain property for `soundmaxx.net`.
- Add a URL-prefix property for `https://www.soundmaxx.net/`.
- Verify ownership with DNS and/or HTML tag (`GOOGLE_SITE_VERIFICATION`).
- Submit `https://www.soundmaxx.net/sitemap.xml`.

## 2. Index Request Workflow
- Use URL Inspection for:
  - `https://www.soundmaxx.net/`
  - `https://www.soundmaxx.net/about`
  - `https://www.soundmaxx.net/contact`
  - `https://www.soundmaxx.net/privacy`
  - `https://www.soundmaxx.net/terms`
  - `https://www.soundmaxx.net/tools/stem-isolation`
  - `https://www.soundmaxx.net/tools/mastering`
  - `https://www.soundmaxx.net/tools/key-bpm`
  - `https://www.soundmaxx.net/tools/loudness-report`
  - `https://www.soundmaxx.net/tools/midi-extract`
- Request indexing when pages are marked as "URL is available to Google".

## 3. Weekly Monitoring (US English)
- Check Search Console query report for `soundmaxx`.
- Track impressions, average position, and click-through rate.
- Review Page indexing report for any:
  - `Blocked by robots.txt`
  - `Excluded by noindex`
  - `Duplicate, Google chose different canonical`

## 4. Post-Deploy Guardrail
- Run:
  - `npm run test:seo`
- Confirm:
  - `robots.txt` and `sitemap.xml` return 200.
  - Canonicals are present and match `https://www.soundmaxx.net`.
  - Production pages do not contain `noindex`.

## 5. Escalation Rules
- If `soundmaxx` average position does not improve for 2 consecutive weeks:
  - Validate indexing coverage for all target URLs.
  - Re-check canonical consistency.
  - Audit external brand citations for mismatched URL/brand naming.
