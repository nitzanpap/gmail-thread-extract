import { browser } from "wxt/browser"
import type { OutputFormat } from "../types"

export interface Settings {
  /** Whether the floating Extract button is shown on Gmail thread pages. */
  showFloatingButton: boolean
  /** Output format used by the floating button and as the popup's default. */
  format: OutputFormat
  /** Include a thread-level attachment list in the output. */
  includeAttachments: boolean
  /** Body lines containing any of these (case-insensitive) are stripped. */
  boilerplate: string[]
}

const FORMATS: OutputFormat[] = ["markdown", "text", "json"]

/** Read settings from local storage, applying defaults for missing keys. */
export async function getSettings(): Promise<Settings> {
  const s = await browser.storage.local.get([
    "showFloatingButton",
    "format",
    "includeAttachments",
    "boilerplate"
  ])
  return {
    // Only `false` disables; anything else (incl. missing) keeps the default on.
    showFloatingButton: s.showFloatingButton !== false,
    format: FORMATS.includes(s.format as OutputFormat) ? (s.format as OutputFormat) : "markdown",
    includeAttachments: s.includeAttachments !== false,
    boilerplate: Array.isArray(s.boilerplate) ? (s.boilerplate as string[]) : []
  }
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(patch)
}

export async function setShowFloatingButton(value: boolean): Promise<void> {
  await setSettings({ showFloatingButton: value })
}
