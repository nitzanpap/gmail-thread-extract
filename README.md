# Gmail Thread Extractor

A minimal cross-browser (Chrome + Firefox) extension that extracts an open Gmail conversation as
clean Markdown — copied to the clipboard and downloaded as a `.md` file named after the subject,
ready to paste into an AI agent.

You can trigger extraction two ways:

- the **floating Extract button** on the thread page, or
- the **toolbar icon popup** (Extract current thread).

Collapsed and super-collapsed messages are **expanded automatically** before scraping, so the whole
thread is captured — not just the message that happens to be open.

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

## Note

Gmail's DOM class names (`.adn`, `.a3s`, `.gD`, `.g3`, `.hP`, …) are obfuscated and change over
time. If extraction stops finding messages, the selectors in [`utils/extract.ts`](utils/extract.ts)
likely need updating (flip the `DEBUG` flag there to trace which stage returns nothing).

Auto-expand finds Gmail's "Expand all" button by its `aria-label`, which is **English-only** by
default. If your Gmail UI is in another language, add a pattern to `EXPAND_ALL_LABELS` in the same
file. If the button can't be found, only the already-open messages are extracted.
