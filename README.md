# Branded Preamble PDF Tool (Paged Deck Mode)

Static, serverless web tool: paste Markdown, preview one page at a time like a deck, then use browser print to save a multi-page A4 PDF.

## What changed
- Output is now a paged deck, not one long flowing article.
- Each top-level `##` section becomes one semantic page.
- If a page is too tall, the renderer auto-creates continuation pages.
- Preview uses `Prev` / `Next` and keyboard left/right arrows.
- Export still uses browser print, so the project stays Netlify-friendly and has no backend.
- Style controls: open `Style` to toggle decorative elements (texture, rails, shadows, animations). Settings persist in your browser.

## Canonical Markdown format
```md
---
title: "Africa's $120 Billion Dollar Crisis"
date: "2025-01-01"
author: "Anton Titov"
subtitle: "Optional deck subtitle"
---

## Cover
Lead paragraph...
### Key Stats
- **$100-120B**: Annual trade finance gap
- **34.2%**: Decline in correspondent banking relationships

## The Core Problem
Opening paragraph...
### Indicators
- **$331B**: SME funding shortfall
```

Rules:
- Frontmatter is the canonical input format.
- Each `##` is one semantic page.
- Each `###` is a labeled block inside the page.
- `- **VALUE**: label` is the canonical stat format.
- Links are stripped before rendering.

## Legacy compatibility
The old structure still works:
- `## Executive Summary`
- `## Key Themes`
- `## Notable Factoids`
- `## Scope`

The tool converts it into the new page-based format automatically. `Copy Normalized Markdown` always copies the page-based result.

## Run locally
- Open `index.html` in Chrome, or
- run `python3 -m http.server 8080` and open `http://localhost:8080`

## Deploy
- Deploy the folder as a static site to Netlify.
- No build step or backend is required.

## Print / PDF behavior
- Use `Print / Save as PDF`.
- Every rendered page is printed with explicit page breaks.
- The footer shows deterministic page numbering generated in the browser.
- This is browser-print output, not server-side PDF rendering.

## Limitations
- Continuation pages split only between block boundaries.
- Extremely tall single blocks are not split internally; the tool warns instead.
- Exact visual parity with the reference PDF is not the goal. The target is structural similarity and page-by-page composition.
