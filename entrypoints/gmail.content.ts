import { browser } from "wxt/browser"
import { downloadMarkdown, toast } from "../utils/download"
import { extractThread, isThreadOpen } from "../utils/extract"
import { safeFilename, toMarkdown } from "../utils/markdown"
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

    // Extraction can also be triggered from the popup.
    browser.runtime.onMessage.addListener(message => {
      if (message?.action === "extract") {
        runExtraction()
      } else if (message?.action === "setFloatingButton") {
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
    const { subject, messages } = await extractThread()

    if (messages.length === 0) {
      toast("Couldn't find any messages — Gmail's layout may have changed.")
      return
    }

    const markdown = toMarkdown(subject, messages, new Date().toISOString())
    downloadMarkdown(`${safeFilename(subject)}.md`, markdown)

    try {
      await navigator.clipboard.writeText(markdown)
      toast(`Extracted ${messages.length} message(s).\nMarkdown copied & downloaded.`)
    } catch {
      toast(`Extracted ${messages.length} message(s).\nDownloaded — clipboard copy failed.`)
    }
  } catch {
    toast("Extraction failed — Gmail's layout may have changed.")
  } finally {
    extracting = false
  }
}
