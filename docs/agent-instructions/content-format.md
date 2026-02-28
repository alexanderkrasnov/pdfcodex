# Content Format

## Canonical Markdown Contract
Use YAML frontmatter plus page sections:

```md
---
title: "Document Title"
date: "2025-01-01"
author: "Anton Titov"
subtitle: "Optional deck subtitle"
---

## Cover
Lead paragraph
### Key Stats
- **42%**: Example stat

## Section Title
Lead paragraph
### Group Title
- Bullet
```

## Parsing Rules
- Frontmatter is the preferred input format.
- Each top-level `##` creates one semantic page.
- Each `###` creates a labeled block within that page.
- `- **VALUE**: label` is the canonical stat pattern.
- Links must be stripped from rendered output.

## Legacy Compatibility
The parser currently supports the old long-form structure:
- `## Executive Summary`
- `## Key Themes`
- `## Notable Factoids`
- `## Scope`

When touching parsing:
- Preserve compatibility unless the user explicitly wants a breaking change.
- Keep `Copy Normalized Markdown` output in the canonical page-based format.

## Pagination Rules
- Continuation pages may be created only at block boundaries.
- Do not split inside a single paragraph, list item, or stat tile.
- If one block is too tall to fit on a page, keep it intact and emit a warning rather than splitting it internally.

