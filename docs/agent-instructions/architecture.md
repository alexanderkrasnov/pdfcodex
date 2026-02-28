# Architecture

## Project Shape
- `index.html`: single-page shell for the editor, preview panel, deck toolbar, and print container.
- `app.js`: all parsing, normalization, pagination, preview rendering, print rendering, keyboard navigation, and clipboard behavior.
- `theme.css`: complete visual system for app chrome, deck pages, print layout, and responsive behavior.
- `africa-usd-crisis-preamble.md`: sample content and a useful regression fixture for page composition.
- `README.md`: end-user usage and format documentation.

## Architectural Invariants
- The app must run as plain static files.
- There is no backend and no API.
- There is no bundler or dependency pipeline.
- Rendering happens entirely in the browser.
- Print output is generated from DOM markup using browser print, not Playwright or server-side PDF tooling.

## Ownership Boundaries
- If a task changes parsing or page splitting, update `app.js` and verify the Markdown contract still matches `README.md`.
- If a task changes visual hierarchy, page composition, or print layout, update `theme.css`.
- If a task changes controls or preview structure, update `index.html` and `app.js` together.

## Preferred Change Style
- Keep logic explicit and inspectable; avoid over-abstracting small UI behavior.
- Favor additive helpers over framework-like rewrites.
- Do not introduce modules, TypeScript, npm, or build tooling unless explicitly requested.

