# UI and Layout

## Product Intent
The app should feel like an editorial research deck, not a generic form.

## UI Constraints
- The editor remains on the left and the preview remains on the right on desktop.
- The preview should show one page at a time, with `Prev` / `Next` controls and a page counter.
- Keyboard left/right navigation should remain functional unless the task explicitly removes it.

## Page Composition Constraints
- The preview page should read as a single designed sheet, not a scrolling article fragment.
- Cover pages should feel like title slides.
- Section pages should use visually distinct sub-blocks instead of flat text walls.
- Factoid-heavy content should render as stat tiles rather than ordinary bullet lists.
- Print output must preserve A4 page boundaries.

## Styling Guidance
- Prefer clear typographic hierarchy and deliberate spacing over decorative clutter.
- Keep styles in CSS variables where possible so future theme changes stay centralized.
- Preserve print readability first; preview-only embellishments must not break print output.

## When Editing Layout
- Check both screen and print rules.
- Be careful with `height`, `overflow`, and `@page` changes because they directly affect continuation-page logic.

