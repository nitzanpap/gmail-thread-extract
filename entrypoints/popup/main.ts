import { browser } from "wxt/browser"
import { getSettings, setShowFloatingButton } from "../../utils/settings"

const GMAIL_URL = /^https:\/\/mail\.google\.com\//

async function init(): Promise<void> {
  const extractBtn = document.getElementById("extract") as HTMLButtonElement
  const toggle = document.getElementById("toggle") as HTMLInputElement
  const hint = document.getElementById("hint") as HTMLParagraphElement

  const settings = await getSettings()
  toggle.checked = settings.showFloatingButton
  toggle.addEventListener("change", async () => {
    await setShowFloatingButton(toggle.checked)
    // Nudge the active Gmail tab to update now, without waiting on a storage
    // event (and so it works even if the tab's content script missed it).
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

  if (!onGmail || !tab?.id) {
    extractBtn.disabled = true
    hint.textContent = "Open a Gmail conversation to extract."
    return
  }

  extractBtn.addEventListener("click", async () => {
    try {
      await browser.tabs.sendMessage(tab.id as number, { action: "extract" })
      window.close()
    } catch {
      hint.textContent = "Couldn't reach the page — reload Gmail and try again."
    }
  })
}

init()
