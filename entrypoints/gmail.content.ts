import { downloadMarkdown, toast } from "../utils/download"
import { extractMessages, extractSubject, isThreadOpen } from "../utils/extract"
import { safeFilename, toMarkdown } from "../utils/markdown"

const BUTTON_ID = "gte-extract-btn"

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  main() {
    const sync = () => syncButton()

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
        sync()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setInterval(sync, 2000)
    sync()
  }
})

function syncButton(): void {
  try {
    const existing = document.getElementById(BUTTON_ID)
    if (isThreadOpen()) {
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
  button.addEventListener("click", onExtractClick)
  return button
}

function onExtractClick(): void {
  try {
    const subject = extractSubject()
    const messages = extractMessages()

    if (messages.length === 0) {
      toast("Couldn't find any messages — Gmail's layout may have changed.")
      return
    }

    const markdown = toMarkdown(subject, messages, new Date().toISOString())
    downloadMarkdown(`${safeFilename(subject)}.md`, markdown)

    const ok = `Extracted ${messages.length} message(s).\nMarkdown copied & downloaded.`
    const copyFailed = `Extracted ${messages.length} message(s).\nDownloaded — clipboard copy failed.`

    navigator.clipboard
      ?.writeText(markdown)
      .then(() => toast(ok))
      .catch(() => toast(copyFailed))
  } catch {
    toast("Extraction failed — Gmail's layout may have changed.")
  }
}
