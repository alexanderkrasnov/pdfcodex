# AGENTS.md

This repository is a static, client-side Markdown-to-PDF deck tool.

Start by reading [README.md](README.md). Load only the linked instruction files that are relevant to the task instead of reading everything by default.

## Core Rules
- Keep the project static and Netlify-compatible.
- Do not add a backend, build step, package manager, or server-side PDF generation unless the user explicitly asks for it.
- Preserve browser print (`Print / Save as PDF`) as the default export path.
- Prefer minimal edits in vanilla HTML, CSS, and JavaScript.
- Keep the page-based deck model intact: one top-level `##` section maps to one semantic page, with continuation pages created only when content overflows.
- Preserve legacy Markdown compatibility unless the task explicitly removes it.

## Relevant Guides
- Architecture and file ownership: [docs/agent-instructions/architecture.md](docs/agent-instructions/architecture.md)
- Markdown parsing and content rules: [docs/agent-instructions/content-format.md](docs/agent-instructions/content-format.md)
- UI and layout constraints: [docs/agent-instructions/ui-layout.md](docs/agent-instructions/ui-layout.md)
- Validation and release checks: [docs/agent-instructions/validation.md](docs/agent-instructions/validation.md)

## Fast Commands
- Local preview: `python3 -m http.server 8080`
- Then open: `http://localhost:8080`

