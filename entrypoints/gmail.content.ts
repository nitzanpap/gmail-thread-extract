import { browser } from "wxt/browser"
import { downloadFile, toast } from "../utils/download"
import { extractThread, isThreadOpen } from "../utils/extract"
import { safeFilename } from "../utils/markdown"
import { serialize } from "../utils/serialize"
import { getSettings } from "../utils/settings"

const BUTTON_ID = "gte-extract-btn"

let showFloatingButton = true
let extracting = false

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  main() {
    getSettings().then(s => {
      showFloatingButton = s.showFloatingButton
      syncButton()
    })

    // Live-toggle the floating button when the popup changes the setting.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.showFloatingButton) {
        showFloatingButton = changes.showFloatingButton.newValue !== false
        syncButton()
      }
    })

    // Messages from the popup.
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === "extractData") {
        // Async response: `return true` keeps the message channel open until
        // sendResponse fires (Chrome's raw runtime semantics, which WXT uses).
        extractThread().then(sendResponse, () => sendResponse(null))
        return true
      }
      if (message?.action === "setFloatingButton") {
        showFloatingButton = message.value !== false
        syncButton()
      }
    })

    // Gmail is a SPA — the DOM changes without page loads. Re-sync the button on
    // any mutation, debounced, plus a slow interval as a belt-and-braces fallback.
    let scheduled = false
    const observer = new MutationObserver(() => {
      if (scheduled) {
        return
      }
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        syncButton()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setInterval(syncButton, 2000)
    syncButton()
  }
})

function syncButton(): void {
  try {
    const existing = document.getElementById(BUTTON_ID)
    if (showFloatingButton && isThreadOpen()) {
      if (!existing) {
        document.body.appendChild(createButton())
      }
    } else if (existing) {
      existing.remove()
    }
  } catch {
    // Gmail markup shifts; never let the observer callback throw.
  }
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button")
  button.id = BUTTON_ID
  button.type = "button"
  button.textContent = "Extract"
  button.setAttribute(
    "style",
    [
      "position:fixed",
      "z-index:2147483646",
      "bottom:24px",
      "right:24px",
      "padding:10px 18px",
      "border:none",
      "border-radius:20px",
      "background:#1a73e8",
      "color:#fff",
      "font:600 13px/1 'Google Sans',Roboto,Arial,sans-serif",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,0.25)"
    ].join(";")
  )
  button.addEventListener("click", runExtraction)
  return button
}

async function runExtraction(): Promise<void> {
  if (extracting) {
    return
  }
  extracting = true
  try {
    const thread = await extractThread()

    if (thread.messages.length === 0) {
      toast("Couldn't find any messages — Gmail's layout may have changed.")
      return
    }

    const settings = await getSettings()
    const { content, ext } = serialize(
      thread,
      {
        format: settings.format,
        count: 0,
        includeAttachments: settings.includeAttachments,
        boilerplate: settings.boilerplate
      },
      new Date().toISOString()
    )
    downloadFile(`${safeFilename(thread.subject)}.${ext}`, content)

    const n = thread.messages.length
    try {
      await navigator.clipboard.writeText(content)
      toast(`Extracted ${n} message(s).\nCopied & downloaded (.${ext}).`)
    } catch {
      toast(`Extracted ${n} message(s).\nDownloaded — clipboard copy failed.`)
    }
  } catch {
    toast("Extraction failed — Gmail's layout may have changed.")
  } finally {
    extracting = false
  }
}
