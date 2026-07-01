import type { Attachment } from "../types"

/**
 * Attachment filenames (and links where available) from the open thread's live
 * DOM. Gmail attachment chips carry a `download_url` attribute formatted
 * `mimeType:fileName:url`, which gives both name and link. Falls back to the
 * visible filename chip (`.aV3`) for name-only. Returns [] when none are found,
 * so the feature degrades quietly if Gmail's markup shifts.
 */
export function extractAttachments(): Attachment[] {
  const found: Attachment[] = []
  const seen = new Set<string>()

  const add = (name: string, url: string) => {
    const clean = name.trim()
    const key = `${clean}|${url}`
    if (!clean || seen.has(key)) {
      return
    }
    seen.add(key)
    found.push({ name: clean, url: url.trim() })
  }

  // Primary: download_url = "mimeType:fileName:url" (url itself may contain ':").
  for (const el of Array.from(document.querySelectorAll("[download_url]"))) {
    const parts = (el.getAttribute("download_url") || "").split(":")
    if (parts.length >= 3) {
      add(parts[1], parts.slice(2).join(":"))
    }
  }

  // Fallback: visible filename chips (name only).
  if (found.length === 0) {
    for (const el of Array.from(document.querySelectorAll(".aV3"))) {
      add(el.getAttribute("title") || el.textContent || "", "")
    }
  }

  return found
}
