const DEFAULT_AUTHOR = "Anton Titov";
const MAX_INPUT_CHARS = 1_000_000;

const LEGACY_HEADINGS = new Set([
  "Executive Summary",
  "Key Themes",
  "Notable Factoids",
  "Scope",
]);

const COVER_HEADINGS = new Set(["cover"]);
const CLOSING_HEADINGS = new Set(["close", "closing", "conclusion"]);

const $input = document.getElementById("md-input");
const $preview = document.getElementById("preview");
const $printDeck = document.getElementById("print-deck");
const $warnings = document.getElementById("warnings");
const $printHeader = document.getElementById("print-header");
const $printFooter = document.getElementById("print-footer");
const $btnPrint = document.getElementById("btn-print");
const $btnCopyNormalized = document.getElementById("btn-copy-normalized");
const $btnPrev = document.getElementById("btn-prev");
const $btnNext = document.getElementById("btn-next");
const $pageIndicator = document.getElementById("page-indicator");
const $pageLabel = document.getElementById("page-label");

const state = {
  meta: { title: "", date: "", author: "", subtitle: "" },
  semanticPages: [],
  renderedPages: [],
  currentPageIndex: 0,
  normalizedMarkdown: "",
};

let measureHost = null;

function todayISO() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stripLinks(markdown) {
  let output = markdown;
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  output = output.replace(/https?:\/\/[^\s)]+/g, "");
  output = output.replace(/\bwww\.[^\s)]+/g, "");
  return output;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}

function parseFrontmatter(markdown, warnings) {
  const trimmed = markdown.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---\n") && !trimmed.startsWith("---\r\n")) {
    return {
      meta: { title: "", date: "", author: "", subtitle: "" },
      body: markdown,
      hasFrontmatter: false,
    };
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    return {
      meta: { title: "", date: "", author: "", subtitle: "" },
      body: markdown,
      hasFrontmatter: false,
    };
  }

  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      endIndex = index;
      break;
    }
  }

  if (endIndex === -1) {
    warnings.push("Frontmatter starts with --- but never ends; ignoring it.");
    return {
      meta: { title: "", date: "", author: "", subtitle: "" },
      body: markdown,
      hasFrontmatter: false,
    };
  }

  const fmLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join("\n");
  const meta = { title: "", date: "", author: "", subtitle: "" };

  for (const line of fmLines) {
    const match = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let value = match[2] || "";
    value = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    if (key === "title") meta.title = value;
    if (key === "date") meta.date = value;
    if (key === "author") meta.author = value;
    if (key === "subtitle") meta.subtitle = value;
  }

  return { meta, body, hasFrontmatter: true };
}

function tryInferTitleFromH1(markdown) {
  const match = markdown.match(/^\s*#\s+(.+)\s*$/m);
  return match ? match[1].trim() : "";
}

function extractTopLevelSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\s*##\s+(.+?)\s*$/);
    if (match) {
      if (current) {
        current.lines = trimBlankEdges(current.lines);
        sections.push(current);
      }
      current = { heading: match[1].trim(), lines: [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current) {
    current.lines = trimBlankEdges(current.lines);
    sections.push(current);
  }

  return sections;
}

function trimBlankEdges(lines) {
  const copy = [...lines];
  while (copy.length && copy[0].trim() === "") copy.shift();
  while (copy.length && copy[copy.length - 1].trim() === "") copy.pop();
  return copy;
}

function detectLegacySections(sections) {
  if (sections.length === 0) return false;
  const headings = new Set(sections.map((section) => section.heading));
  if (headings.has("Cover")) return false;
  return Array.from(headings).some((heading) => LEGACY_HEADINGS.has(heading));
}

function firstParagraphFromLines(lines) {
  const paragraphLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (paragraphLines.length) break;
      continue;
    }
    if (/^\s*###\s+/.test(rawLine)) break;
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(rawLine)) break;
    if (/^\s*>\s?/.test(rawLine)) break;
    paragraphLines.push(line);
  }

  return paragraphLines.join(" ").trim();
}

function extractListLines(lines) {
  return lines.filter((line) => /^\s*[-*+]\s+/.test(line));
}

function splitThemeSections(lines) {
  const sections = [];
  let prelude = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\s*###\s+(.+?)\s*$/);
    if (match) {
      if (!current && trimBlankEdges(prelude).length) {
        sections.push({
          heading: "Key Themes Overview",
          lines: trimBlankEdges(prelude),
        });
      }
      prelude = [];
      if (current) {
        current.lines = trimBlankEdges(current.lines);
        sections.push(current);
      }
      current = { heading: match[1].trim(), lines: [] };
      continue;
    }

    if (!current) {
      prelude.push(line);
    } else {
      current.lines.push(line);
    }
  }

  if (current) {
    current.lines = trimBlankEdges(current.lines);
    sections.push(current);
  } else if (trimBlankEdges(prelude).length) {
    sections.push({
      heading: "Key Themes",
      lines: trimBlankEdges(prelude),
    });
  }

  return sections;
}

function convertLegacySectionsToDeckSections(sections, meta, warnings) {
  const byHeading = new Map();
  for (const section of sections) {
    byHeading.set(section.heading, section.lines);
  }

  const converted = [];
  const execLines = byHeading.get("Executive Summary") || [];
  const factLines = byHeading.get("Notable Factoids") || [];

  const coverLines = [];
  const coverLead = firstParagraphFromLines(execLines);
  if (coverLead) coverLines.push(coverLead);

  const coverStatLines = extractListLines(factLines).slice(0, 3);
  if (coverStatLines.length) {
    if (coverLines.length) coverLines.push("");
    coverLines.push("### Key Stats");
    coverLines.push(...coverStatLines);
  }

  converted.push({
    heading: "Cover",
    lines: trimBlankEdges(coverLines),
  });

  if (execLines.length) {
    converted.push({
      heading: "Executive Summary",
      lines: trimBlankEdges(execLines),
    });
  }

  const themeLines = byHeading.get("Key Themes") || [];
  const themeSections = splitThemeSections(themeLines);
  converted.push(...themeSections);

  if (factLines.length) {
    converted.push({
      heading: "Key Stats",
      lines: ["### Key Stats", ...extractListLines(factLines)],
    });
  }

  const scopeLines = byHeading.get("Scope") || [];
  if (scopeLines.length) {
    converted.push({
      heading: "Scope",
      lines: trimBlankEdges(scopeLines),
    });
  }

  for (const section of sections) {
    if (!LEGACY_HEADINGS.has(section.heading)) {
      converted.push(section);
    }
  }

  if (!meta.subtitle && coverLead) {
    meta.subtitle = coverLead;
  }

  warnings.push("Converted legacy markdown into page-based deck format.");
  return converted;
}

function inlineToHtml(text) {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

function parseStatLine(line) {
  const match = line.match(/^\s*[-*+]\s+\*\*(.+?)\*\*\s*[:\-]\s*(.+)\s*$/);
  if (!match) return null;
  return {
    value: match[1].trim(),
    label: match[2].trim(),
  };
}

function stripListMarker(line) {
  const match = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)\s*$/);
  return match ? match[1].trim() : line.trim();
}

function parseLooseBlocks(lines) {
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, "").trim());
        index += 1;
      }
      blocks.push({
        type: "quote",
        lines: quoteLines.filter(Boolean),
      });
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const listLines = [];
      while (index < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }

      const statItems = listLines.map(parseStatLine);
      const isStats = statItems.length >= 2 && statItems.every(Boolean);

      if (isStats) {
        blocks.push({
          type: "stats",
          title: "",
          items: statItems,
        });
      } else {
        blocks.push({
          type: "list",
          items: listLines.map(stripListMarker),
        });
      }
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*>\s?/.test(lines[index]) &&
      !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks.filter((block) => {
    if (block.type === "paragraph") return Boolean(block.text);
    if (block.type === "quote") return block.lines.length > 0;
    if (block.type === "list") return block.items.length > 0;
    if (block.type === "stats") return block.items.length > 0;
    return true;
  });
}

function parsePrelude(lines) {
  const cleanLines = trimBlankEdges(lines);
  if (!cleanLines.length) {
    return { lead: null, blocks: [] };
  }

  const leadLines = [];
  let index = 0;

  while (index < cleanLines.length) {
    const line = cleanLines[index];
    if (!line.trim()) {
      if (leadLines.length) {
        index += 1;
        break;
      }
      index += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line) || /^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      break;
    }
    leadLines.push(line.trim());
    index += 1;
  }

  const lead = leadLines.length ? leadLines.join(" ") : null;
  const blocks = parseLooseBlocks(cleanLines.slice(index));
  return { lead, blocks };
}

function parseGroupBlock(group) {
  const parsedBlocks = parseLooseBlocks(group.lines);

  if (
    parsedBlocks.length === 1 &&
    parsedBlocks[0].type === "stats" &&
    parsedBlocks[0].items.length >= 2
  ) {
    return {
      type: "stats",
      title: group.title,
      items: parsedBlocks[0].items,
    };
  }

  return {
    type: "group",
    title: group.title,
    blocks: parsedBlocks,
  };
}

function parsePageBody(lines) {
  const prelude = [];
  const groups = [];
  let currentGroup = null;

  for (const line of lines) {
    const match = line.match(/^\s*###\s+(.+?)\s*$/);
    if (match) {
      if (currentGroup) {
        currentGroup.lines = trimBlankEdges(currentGroup.lines);
        groups.push(currentGroup);
      }
      currentGroup = {
        title: match[1].trim(),
        lines: [],
      };
      continue;
    }

    if (!currentGroup) {
      prelude.push(line);
    } else {
      currentGroup.lines.push(line);
    }
  }

  if (currentGroup) {
    currentGroup.lines = trimBlankEdges(currentGroup.lines);
    groups.push(currentGroup);
  }

  const { lead, blocks } = parsePrelude(prelude);
  const groupBlocks = groups
    .filter((group) => group.lines.length || group.title)
    .map(parseGroupBlock);

  return {
    lead,
    blocks: [...blocks, ...groupBlocks],
  };
}

function pageKindFromHeading(heading) {
  const lower = heading.trim().toLowerCase();
  if (COVER_HEADINGS.has(lower)) return "cover";
  if (CLOSING_HEADINGS.has(lower)) return "closing";
  return "section";
}

function parseSectionsToPages(sections) {
  return sections.map((section, index) => {
    const body = parsePageBody(section.lines);
    return {
      id: `${slugify(section.heading)}-${index + 1}`,
      title: section.heading,
      sourceHeading: section.heading,
      kind: pageKindFromHeading(section.heading),
      lead: body.lead,
      blocks: body.blocks,
    };
  });
}

function firstParagraphFromBlocks(blocks) {
  for (const block of blocks) {
    if (block.type === "paragraph" && block.text) return block.text;
    if (block.type === "group") {
      const nested = firstParagraphFromBlocks(block.blocks);
      if (nested) return nested;
    }
  }
  return "";
}

function firstStatsBlock(pages) {
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type === "stats" && block.items.length) return block;
      if (block.type === "group") {
        for (const nested of block.blocks) {
          if (nested.type === "stats" && nested.items.length) return nested;
        }
      }
    }
  }
  return null;
}

function ensureCoverPage(meta, pages, warnings) {
  if (pages.some((page) => page.kind === "cover")) {
    return pages;
  }

  const coverLead = meta.subtitle || pages[0]?.lead || firstParagraphFromBlocks(pages[0]?.blocks || []) || null;
  const statsSource = firstStatsBlock(pages);
  const coverBlocks = [];

  if (statsSource) {
    coverBlocks.push({
      type: "stats",
      title: "Key Stats",
      items: statsSource.items.slice(0, 3),
    });
  }

  warnings.push("Added synthesized Cover page from frontmatter and first content block.");

  return [
    {
      id: "cover-0",
      title: "Cover",
      sourceHeading: "Cover",
      kind: "cover",
      lead: coverLead,
      blocks: coverBlocks,
    },
    ...pages,
  ];
}

function serializeBlockLines(block, lines) {
  if (block.type === "paragraph") {
    lines.push(block.text);
    lines.push("");
    return;
  }

  if (block.type === "quote") {
    for (const line of block.lines) lines.push(`> ${line}`);
    lines.push("");
    return;
  }

  if (block.type === "list") {
    for (const item of block.items) lines.push(`- ${item}`);
    lines.push("");
    return;
  }

  if (block.type === "stats") {
    if (block.title) lines.push(`### ${block.title}`);
    for (const item of block.items) {
      lines.push(`- **${item.value}**: ${item.label}`);
    }
    lines.push("");
    return;
  }

  if (block.type === "group") {
    lines.push(`### ${block.title}`);
    for (const nested of block.blocks) {
      serializeBlockLines(nested, lines);
    }
  }
}

function buildCanonicalMarkdown(meta, pages) {
  const lines = [
    "---",
    `title: "${meta.title || "Untitled"}"`,
    `date: "${meta.date || todayISO()}"`,
    `author: "${meta.author || DEFAULT_AUTHOR}"`,
  ];

  if (meta.subtitle) {
    lines.push(`subtitle: "${meta.subtitle}"`);
  }

  lines.push("---", "");

  for (const page of pages) {
    lines.push(`## ${page.sourceHeading}`);
    if (page.lead) {
      lines.push(page.lead);
      lines.push("");
    }
    for (const block of page.blocks) {
      serializeBlockLines(block, lines);
    }
    if (lines[lines.length - 1] !== "") lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function parseDeckMarkdown(input) {
  const warnings = [];
  const stripped = stripLinks(input);
  const parsed = parseFrontmatter(stripped, warnings);
  const meta = {
    title: parsed.meta.title || "",
    date: parsed.meta.date || "",
    author: parsed.meta.author || "",
    subtitle: parsed.meta.subtitle || "",
  };

  if (!parsed.hasFrontmatter) {
    warnings.push("No YAML frontmatter detected; inferred missing meta fields.");
  }

  if (!meta.title) {
    meta.title = tryInferTitleFromH1(parsed.body) || "Untitled";
    warnings.push("Missing frontmatter title; using inferred title or Untitled.");
  }

  meta.date = meta.date || todayISO();
  meta.author = meta.author || DEFAULT_AUTHOR;

  let sections = extractTopLevelSections(parsed.body);
  if (sections.length === 0) {
    warnings.push("No level-2 headings found; created a fallback content page.");
    sections = [
      {
        heading: "Content",
        lines: trimBlankEdges(parsed.body.split(/\r?\n/)),
      },
    ];
  }

  if (detectLegacySections(sections)) {
    sections = convertLegacySectionsToDeckSections(sections, meta, warnings);
  }

  let pages = parseSectionsToPages(sections);
  pages = ensureCoverPage(meta, pages, warnings);

  return {
    meta,
    pages,
    warnings,
    normalizedMarkdown: buildCanonicalMarkdown(meta, pages),
  };
}

function getMeasureHost() {
  if (measureHost) return measureHost;
  measureHost = document.createElement("div");
  measureHost.className = "measure-host";
  document.body.appendChild(measureHost);
  return measureHost;
}

function displayTitle(page, meta) {
  if (page.kind === "cover") return meta.title || "Untitled";
  if (page.kind === "continuation") return `${page.title} (cont.)`;
  return page.title;
}

function footerTitle(page, meta) {
  if (page.kind === "cover") return meta.title || "Untitled";
  if (page.kind === "continuation") return `${page.title} (cont.)`;
  return page.title;
}

function metaEyebrow(page) {
  if (page.kind === "cover") return "Cover";
  if (page.kind === "closing") return "Closing";
  if (page.kind === "continuation") return "Continuation";
  return "Section";
}

function renderStatsHtml(block) {
  const tiles = block.items
    .map((item) => {
      return `<div class="stat-tile"><div class="stat-tile__value">${escapeHtml(item.value)}</div><div class="stat-tile__label">${inlineToHtml(
        item.label
      )}</div></div>`;
    })
    .join("");

  return `<section class="content-group content-group--stats">${block.title ? `<h3 class="content-group__title">${escapeHtml(block.title)}</h3>` : ""}<div class="stat-grid">${tiles}</div></section>`;
}

function renderBlockHtml(block) {
  if (block.type === "paragraph") {
    return `<p class="content-block content-paragraph">${inlineToHtml(block.text)}</p>`;
  }

  if (block.type === "quote") {
    return `<blockquote class="content-block content-quote">${block.lines.map((line) => inlineToHtml(line)).join("<br />")}</blockquote>`;
  }

  if (block.type === "list") {
    return `<ul class="content-block content-list">${block.items
      .map((item) => `<li>${inlineToHtml(item)}</li>`)
      .join("")}</ul>`;
  }

  if (block.type === "stats") {
    return renderStatsHtml(block);
  }

  if (block.type === "group") {
    const nested = block.blocks.map(renderBlockHtml).join("");
    return `<section class="content-group"><h3 class="content-group__title">${escapeHtml(
      block.title
    )}</h3><div class="content-group__body">${nested}</div></section>`;
  }

  return "";
}

function buildPageHtml(page, meta, pageNumber, totalPages) {
  const title = displayTitle(page, meta);
  const footer = footerTitle(page, meta);
  const subtitle = page.kind === "cover" ? meta.subtitle || (!meta.subtitle && page.lead ? page.lead : "") : "";
  const lead =
    page.kind === "cover"
      ? meta.subtitle && page.lead && page.lead !== meta.subtitle
        ? page.lead
        : ""
      : page.lead || "";

  return `
    <article class="deck-page deck-page--${page.kind}">
      <div class="deck-page__inner">
        <div class="deck-page__meta">
          <span class="deck-page__eyebrow">${escapeHtml(metaEyebrow(page))}</span>
          <span class="deck-page__position">${escapeHtml(meta.date || todayISO())}</span>
        </div>
        <header class="deck-page__header">
          <h1 class="deck-page__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="deck-page__subtitle">${inlineToHtml(subtitle)}</p>` : ""}
          ${lead ? `<p class="deck-page__lead">${inlineToHtml(lead)}</p>` : ""}
        </header>
        <div class="deck-page__body">${page.blocks.map(renderBlockHtml).join("")}</div>
        <footer class="deck-page__footer">
          <span class="deck-page__footer-title">${escapeHtml(footer)}</span>
          <span>${pageNumber} / ${totalPages}</span>
        </footer>
      </div>
    </article>
  `.trim();
}

function createPageElement(page, meta, pageNumber, totalPages) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildPageHtml(page, meta, pageNumber, totalPages);
  return wrapper.firstElementChild;
}

function pageFits(page, meta) {
  const host = getMeasureHost();
  host.innerHTML = "";
  const pageElement = createPageElement(page, meta, 1, 1);
  host.appendChild(pageElement);
  const body = host.querySelector(".deck-page__body");
  return pageElement.scrollHeight <= pageElement.clientHeight + 1 && body.scrollHeight <= body.clientHeight + 1;
}

function splitPageWithOverflow(page, meta, warnings) {
  if (!page.blocks.length) {
    if (!pageFits(page, meta)) {
      warnings.push(`Page "${page.title}" is taller than one sheet; shorten the lead copy for best layout.`);
    }
    return [page];
  }

  const output = [];
  let remaining = [...page.blocks];
  let firstChunk = true;

  while (firstChunk || remaining.length) {
    let accepted = 0;
    let candidateBlocks = [];

    for (let index = 0; index < remaining.length; index += 1) {
      const nextBlocks = [...candidateBlocks, remaining[index]];
      const candidatePage = {
        ...page,
        kind: firstChunk ? page.kind : "continuation",
        lead: firstChunk ? page.lead : null,
        blocks: nextBlocks,
      };

      if (pageFits(candidatePage, meta)) {
        candidateBlocks = nextBlocks;
        accepted = index + 1;
        continue;
      }

      if (candidateBlocks.length === 0) {
        candidateBlocks = [remaining[index]];
        accepted = index + 1;
        warnings.push(`Block too tall for one page under "${page.title}"; shorten content for best layout.`);
      }
      break;
    }

    output.push({
      ...page,
      kind: firstChunk ? page.kind : "continuation",
      lead: firstChunk ? page.lead : null,
      blocks: candidateBlocks,
    });

    remaining = remaining.slice(accepted);
    firstChunk = false;
  }

  return output;
}

function paginatePages(pages, meta, warnings) {
  const output = [];
  for (const page of pages) {
    output.push(...splitPageWithOverflow(page, meta, warnings));
  }
  return output;
}

function setWarnings(warnings) {
  $warnings.innerHTML = "";
  const unique = Array.from(new Set(warnings)).slice(0, 8);

  for (const warning of unique) {
    const pill = document.createElement("div");
    pill.className = "warning-pill";
    pill.textContent = warning;
    $warnings.appendChild(pill);
  }
}

function renderCurrentPage() {
  const pages = state.renderedPages;
  if (!pages.length) {
    $preview.innerHTML = `<div class="preview__empty">No pages to preview.</div>`;
    $pageIndicator.textContent = "0 / 0";
    $pageLabel.textContent = "Page";
    $btnPrev.disabled = true;
    $btnNext.disabled = true;
    return;
  }

  const current = pages[state.currentPageIndex];
  const currentNumber = state.currentPageIndex + 1;
  const title = displayTitle(current, state.meta);

  $preview.innerHTML = `
    <div class="page-stage">
      <div>
        <p class="page-stage__caption">${escapeHtml(title)}</p>
        ${buildPageHtml(current, state.meta, currentNumber, pages.length)}
      </div>
    </div>
  `;

  $pageIndicator.textContent = `${currentNumber} / ${pages.length}`;
  $pageLabel.textContent = title;
  $btnPrev.disabled = state.currentPageIndex <= 0;
  $btnNext.disabled = state.currentPageIndex >= pages.length - 1;
}

function renderPrintDeck() {
  if (!state.renderedPages.length) {
    $printDeck.innerHTML = "";
    return;
  }

  $printDeck.innerHTML = state.renderedPages
    .map((page, index) => buildPageHtml(page, state.meta, index + 1, state.renderedPages.length))
    .join("");

  $printHeader.textContent = state.meta.title || "Untitled";
  $printFooter.textContent = `${state.meta.author || DEFAULT_AUTHOR} · ${state.meta.date || todayISO()}`;
}

function renderAll() {
  let input = $input.value || "";
  if (input.length > MAX_INPUT_CHARS) {
    input = input.slice(0, MAX_INPUT_CHARS);
  }

  const parsed = parseDeckMarkdown(input);
  const warnings = [...parsed.warnings];
  const renderedPages = paginatePages(parsed.pages, parsed.meta, warnings);

  state.meta = parsed.meta;
  state.semanticPages = parsed.pages;
  state.renderedPages = renderedPages;
  state.normalizedMarkdown = parsed.normalizedMarkdown;
  state.currentPageIndex = Math.max(0, Math.min(state.currentPageIndex, renderedPages.length - 1));

  setWarnings(warnings);
  renderCurrentPage();
  renderPrintDeck();
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function goToPage(nextIndex) {
  if (!state.renderedPages.length) return;
  state.currentPageIndex = Math.max(0, Math.min(nextIndex, state.renderedPages.length - 1));
  renderCurrentPage();
}

$input.addEventListener(
  "input",
  debounce(() => {
    state.currentPageIndex = 0;
    renderAll();
  }, 120)
);

$btnPrev.addEventListener("click", () => {
  goToPage(state.currentPageIndex - 1);
});

$btnNext.addEventListener("click", () => {
  goToPage(state.currentPageIndex + 1);
});

$btnPrint.addEventListener("click", () => {
  renderAll();
  window.print();
});

$btnCopyNormalized.addEventListener("click", async () => {
  try {
    await copyToClipboard(state.normalizedMarkdown || "");
    $btnCopyNormalized.textContent = "Copied!";
    setTimeout(() => {
      $btnCopyNormalized.textContent = "Copy Normalized Markdown";
    }, 900);
  } catch (error) {
    window.alert("Clipboard copy failed. Copy from the editor or preview manually.");
  }
});

window.addEventListener("keydown", (event) => {
  const tagName = document.activeElement?.tagName || "";
  if (tagName === "TEXTAREA" || tagName === "INPUT") return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goToPage(state.currentPageIndex - 1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    goToPage(state.currentPageIndex + 1);
  }
});

$input.value = `---
title: "Africa's $120 Billion Dollar Crisis"
date: "${todayISO()}"
author: "${DEFAULT_AUTHOR}"
subtitle: "The structural USD liquidity deficit and the settlement opportunity it creates."
---

## Cover
Sub-Saharan Africa faces a structural dollar shortage that constrains trade, funding, and growth.

### Key Stats
- **$100-120B**: Annual trade finance gap
- **34.2%**: Decline in correspondent banking relationships
- **$4T**: Capital trapped in pre-funding globally

## The Core Problem
The shortage is not cyclical. It is structural and linked to trade dependence, debt service, and failing access to formal dollar rails.

### Indicators
- **$100-120B**: Annual trade finance gap
- **$331B**: SME funding shortfall
- **$163B**: Debt service in 2024

### Named Sources
- Afreximbank
- African Development Bank
- IMF

## Banking Infrastructure
Cross-border payment demand remains high while the underlying banking rails continue to deteriorate.

### CBR Decline by Region
- **-44.2%**: Eastern Africa
- **-42.9%**: Northern Africa
- **-40.9%**: USD-specific decline

### Key Insight
- USD pipes are collapsing faster than general banking infrastructure.
- Demand for alternative rails rises as incumbent coverage falls.

## Close
The existing pipes are failing. The opportunity is to build new ones.

### Summary Signals
- **$120B+**: Trade finance gap
- **34.2%**: Correspondent banking collapse
- **$4T**: Trapped pre-funding globally
`;

renderAll();
