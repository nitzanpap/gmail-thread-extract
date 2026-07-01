# Gmail Thread Extractor

A minimal cross-browser (Chrome + Firefox) extension that extracts an open Gmail conversation as
clean, structured text — copied to the clipboard and downloaded as a file named after the subject,
ready to paste into an AI agent.

You can trigger extraction two ways:

- the **floating Extract button** on the thread page (a quick copy + download using your saved
  options), or
- the **toolbar icon popup** — extract, **preview** the output, and tweak options before copying or
  downloading.

The whole thread is captured — not just the open message. The primary path fetches Gmail's **print
view** (`?view=pt`), a single static document containing every message already expanded, with stable
semantic markup. If that ever fails, it **falls back** to expanding and scraping the live thread DOM.

### Options (in the popup)

- **Format** — Markdown, plain text, or JSON.
- **Messages** — the whole thread, or just the last N.
- **Include attachment list** — appends attachment filenames/links found in the thread.
- **Strip lines containing…** — drop boilerplate lines (signatures, disclaimers) by phrase.
- **Show floating button in Gmail** — hide the on-page button and extract only from the toolbar.

Format, attachment, boilerplate, and floating-button choices persist and are also used by the
floating button; the message-range is a per-extraction choice.

## Develop

```bash
bun install
bun run dev          # default browser, hot reload
bun run dev:chrome   # Chrome
bun run dev:firefox  # Firefox (uses --mv2 for hot reload)
```

## Build

```bash
bun run build:chrome   # → .output/chrome-mv3/
bun run build:firefox  # → .output/firefox-mv2/  (dev) or firefox-mv3 (build)
bun run zip            # distribution zips for both
```

## Quality

```bash
bun run code:check   # Biome + tsc
bun run test         # Vitest (Markdown serializer)
```

## Load unpacked

**Chrome** — `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select
`.output/chrome-mv3/`.

**Firefox** — `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick any file in
`.output/firefox-mv2/` (dev) or `.output/firefox-mv3/` (production build).

Open a Gmail conversation and click the floating **Extract** button.

## How extraction works

1. **Primary — print view** ([`utils/printView.ts`](utils/printView.ts)): a same-origin `fetch` of
   `?view=pt&search=all&th=<legacyThreadId>` returns the full thread as one static HTML document,
   pre-expanded, with stable classes (`.message`, `.recipient`). The legacy thread id comes from the
   `data-legacy-message-id` attribute on the open message. No extra permissions, no new tab.
2. **Fallback — live DOM** ([`utils/extract.ts`](utils/extract.ts)): if the print fetch/parse yields
   nothing (logged out, or Gmail changed the print view), it expands collapsed messages and scrapes
   the live thread using Gmail's obfuscated classes (`.adn`, `.a3s`, `.gD`, …).

Two fallback-only caveats (the print path avoids both): Gmail's obfuscated class names change over
time and may need updating in `utils/extract.ts` (flip the `DEBUG` flag to trace which stage returns
nothing); and auto-expand matches the "Expand all" button by its **English** `aria-label` — for
other UI languages add a pattern to `EXPAND_ALL_LABELS`.
