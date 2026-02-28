# Validation

## Minimum Checks After Changes
- Open the app locally and verify it still renders without a build step.
- Confirm the preview still shows pages in order.
- Confirm `Prev` / `Next` still work.
- Confirm `Copy Normalized Markdown` still returns valid page-based Markdown.
- Confirm `Print / Save as PDF` still renders a page-broken A4 document.

## Good Manual Test Inputs
- Use `africa-usd-crisis-preamble.md` as a realistic, dense content test.
- Test at least one canonical page-based Markdown input.
- Test at least one legacy-format Markdown input.

## Regression Risks
- Layout regressions can break continuation-page splitting even if the app still “looks fine” on screen.
- Parsing regressions may silently change normalized Markdown output.
- Print-only regressions are easy to miss if only screen preview is checked.

## Documentation Sync
- If behavior changes for parsing, pagination, or controls, update `README.md`.
- If long-lived agent workflow assumptions change, update `AGENTS.md` and the relevant linked guide.
