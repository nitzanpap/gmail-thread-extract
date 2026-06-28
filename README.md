# Gmail Thread Extractor

A minimal cross-browser (Chrome + Firefox) extension that adds an **Extract** button inside an open
Gmail conversation. Clicking it scrapes the whole thread, converts it to clean Markdown, copies it
to the clipboard, and downloads a `.md` file named after the subject — ready to paste into an AI
agent.

It's a single content script: no popup, no settings, no background logic.

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
