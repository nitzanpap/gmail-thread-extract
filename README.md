# Gmail Thread Extractor

A minimal cross-browser (Chrome + Firefox) extension that extracts an open Gmail conversation as
clean Markdown — copied to the clipboard and downloaded as a `.md` file named after the subject,
ready to paste into an AI agent.

You can trigger extraction two ways:

- the **floating Extract button** on the thread page, or
- the **toolbar icon popup** (Extract current thread).

The whole thread is captured — not just the open message. The primary path fetches Gmail's **print
view** (`?view=pt`), a single static document containing every message already expanded, with stable
semantic markup. If that ever fails, it **falls back** to expanding and scraping the live thread DOM.

The popup also has one setting: **Show floating button in Gmail**, to hide the on-page button if you
prefer to extract only from the toolbar.

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
