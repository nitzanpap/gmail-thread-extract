import { browser } from "wxt/browser"
import type { OutputFormat, OutputOptions, Thread } from "../../types"
import { downloadFile } from "../../utils/download"
import { safeFilename } from "../../utils/markdown"
import { serialize } from "../../utils/serialize"
import { getSettings, setSettings, setShowFloatingButton } from "../../utils/settings"

const GMAIL_URL = /^https:\/\/mail\.google\.com\//

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

/** Ask the content script for the thread. Callback form matches WXT's raw-chrome messaging. */
function requestThread(tabId: number): Promise<Thread | null> {
  return new Promise(resolve => {
    browser.tabs.sendMessage(tabId, { action: "extractData" }, (response: Thread | null) => {
      resolve(browser.runtime.lastError ? null : (response ?? null))
    })
  })
}

async function init(): Promise<void> {
  const extractBtn = el<HTMLButtonElement>("extract")
  const hint = el<HTMLParagraphElement>("hint")
  const panel = el<HTMLDivElement>("panel")
  const formatSel = el<HTMLSelectElement>("format")
  const rangeSel = el<HTMLSelectElement>("range")
  const preview = el<HTMLDivElement>("preview")
  const copyBtn = el<HTMLButtonElement>("copy")
  const downloadBtn = el<HTMLButtonElement>("download")
  const includeAtt = el<HTMLInputElement>("includeAttachments")
  const toggle = el<HTMLInputElement>("toggle")
  const boilerplate = el<HTMLTextAreaElement>("boilerplate")

  // Footer: version from the manifest, browser from the build target.
  el<HTMLSpanElement>("version").textContent = browser.runtime.getManifest().version
  const target = import.meta.env.BROWSER
  el<HTMLSpanElement>("browserName").textContent = target.charAt(0).toUpperCase() + target.slice(1)

  let thread: Thread | null = null

  const settings = await getSettings()
  formatSel.value = settings.format
  includeAtt.checked = settings.includeAttachments
  toggle.checked = settings.showFloatingButton
  boilerplate.value = settings.boilerplate.join("\n")

  const boilerplateLines = (): string[] =>
    boilerplate.value
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)

  const options = (): OutputOptions => ({
    format: formatSel.value as OutputFormat,
    count: Number.parseInt(rangeSel.value, 10) || 0,
    includeAttachments: includeAtt.checked,
    boilerplate: boilerplateLines()
  })

  const current = () => serialize(thread as Thread, options(), new Date().toISOString())

  const render = () => {
    if (thread) {
      preview.textContent = current().content
    }
  }

  const persist = () =>
    setSettings({
      format: formatSel.value as OutputFormat,
      includeAttachments: includeAtt.checked,
      boilerplate: boilerplateLines()
    })

  // Settings-backed controls persist and re-render; range is session-only.
  for (const control of [formatSel, includeAtt, boilerplate]) {
    control.addEventListener("input", () => {
      persist()
      render()
    })
  }
  rangeSel.addEventListener("input", render)

  toggle.addEventListener("change", async () => {
    await setShowFloatingButton(toggle.checked)
    try {
      const [active] = await browser.tabs.query({ active: true, currentWindow: true })
      if (active?.id != null) {
        await browser.tabs.sendMessage(active.id, {
          action: "setFloatingButton",
          value: toggle.checked
        })
      }
    } catch {
      // Active tab has no Gmail content script — storage.onChanged covers it.
    }
  })

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  const onGmail = tab?.url ? GMAIL_URL.test(tab.url) : false
  if (!onGmail || tab?.id == null) {
    extractBtn.disabled = true
    hint.textContent = "Open a Gmail conversation to extract."
    return
  }
  const tabId = tab.id

  extractBtn.addEventListener("click", async () => {
    extractBtn.disabled = true
    hint.textContent = "Extracting…"
    try {
      thread = await requestThread(tabId)
      if (!thread || thread.messages.length === 0) {
        hint.textContent = "Couldn't find any messages in this thread."
        return
      }
      hint.textContent = ""
      panel.hidden = false
      render()
    } catch {
      hint.textContent = "Couldn't reach the page — reload Gmail and try again."
    } finally {
      extractBtn.disabled = false
    }
  })

  copyBtn.addEventListener("click", async () => {
    if (!thread) {
      return
    }
    try {
      await navigator.clipboard.writeText(current().content)
      flash(copyBtn, "Copied!")
    } catch {
      flash(copyBtn, "Copy failed")
    }
  })

  downloadBtn.addEventListener("click", () => {
    if (!thread) {
      return
    }
    const { content, ext } = current()
    downloadFile(`${safeFilename(thread.subject)}.${ext}`, content)
  })
}

function flash(button: HTMLButtonElement, text: string): void {
  const original = button.textContent
  button.textContent = text
  setTimeout(() => {
    button.textContent = original
  }, 1200)
}

init()
