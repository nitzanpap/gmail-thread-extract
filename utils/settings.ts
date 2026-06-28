import { browser } from "wxt/browser"

export interface Settings {
  /** Whether the floating Extract button is shown on Gmail thread pages. */
  showFloatingButton: boolean
}

/** Read settings from local storage, applying defaults for missing keys. */
export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get("showFloatingButton")
  // Only `false` disables; anything else (incl. missing) keeps the default on.
  return { showFloatingButton: stored.showFloatingButton !== false }
}

export async function setShowFloatingButton(value: boolean): Promise<void> {
  await browser.storage.local.set({ showFloatingButton: value })
}
