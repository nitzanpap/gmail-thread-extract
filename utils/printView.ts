import type { Message } from "../types"
import { cleanBody, cleanText, stripReplyQuotes } from "./clean"
import { inlineImages } from "./images"
import { type ParsedMessage, resolveQuotes } from "./quotes"

/**
 * Primary extraction path: fetch Gmail's print view (`?view=pt`) and parse it.
 *
 * The print view returns the entire thread as a single static HTML document
 * with every message already expanded and clean, semantic class names
 * (`.message`, `.recipient`) instead of Gmail's obfuscated, churning live-DOM
 * classes. This sidesteps the "Expand all" click (and its locale dependency),
 * the lazy-render race, and selector rot in one same-origin request — no extra
 * permissions, no new tab. Falls back to live-DOM scraping if anything fails.
 *
 * Verified live (June 2026): `GET /mail/u/<n>/?view=pt&search=all&th=<legacyId>`
 * returns HTTP 200 with the full thread.
 */

/** Account index from the `/mail/u/<n>/` path; defaults to 0. */
function accountIndex(): string {
  return (location.pathname.match(/\/u\/(\d+)\//) || [])[1] || "0"
}

/**
 * Legacy thread id for the print view's `th=` param, read from the live thread
 * DOM. Every rendered message carries it; the open message is always rendered.
 */
export function getLegacyThreadId(): string | null {
  const el = document.querySelector("[data-legacy-message-id]")
  return el?.getAttribute("data-legacy-message-id") || null
}

/** Base the print view's query-only image srcs (`?ui=2&…`) resolve against. */
function printBase(): string {
  return `https://mail.google.com/mail/u/${accountIndex()}/`
}

function printUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/${accountIndex()}/?view=pt&search=all&th=${threadId}`
}

/**
 * Serialize a parsed (detached) DOM node to text. `innerText` is unavailable on
 * detached nodes, so we walk children and insert newlines at block boundaries.
 */
export function domText(node: Node): string {
  let out = ""
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.nodeValue || ""
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === "br") {
        out += "\n"
      } else if (tag !== "style" && tag !== "script") {
        const block = /^(div|p|tr|li|h[1-6]|blockquote|table)$/.test(tag)
        if (block) {
          out += "\n"
        }
        out += domText(el)
        if (block) {
          out += "\n"
        }
      }
    }
  }
  return out
}

function parseMessage(block: HTMLTableElement, base: string): ParsedMessage | null {
  const rows = Array.from(block.rows)
  if (rows.length === 0) {
    return null
  }

  const headerCell = rows[0].cells[0]
  const senderName = headerCell?.querySelector("b")?.textContent?.trim() || ""
  const senderEmail = (headerCell?.textContent?.match(/[\w.+-]+@[\w.-]+\.[\w.-]+/) || [])[0] || ""
  const date = rows[0].cells[1]?.textContent?.trim() || ""
  const toText = cleanText(block.querySelector(".recipient")?.textContent || "")

  // Body lives in the first nested table.
  const bodyEl = block.querySelector("table")
  let body = ""
  let withQuotes = ""
  if (bodyEl) {
    // Before any text pass: <img> has no text and would otherwise vanish.
    inlineImages(bodyEl, base)
    const rawText = domText(bodyEl)
    for (const noise of Array.from(
      bodyEl.querySelectorAll(".gmail_signature, .gmail_signature_prefix, style, script")
    )) {
      noise.remove()
    }
    withQuotes = cleanBody(domText(bodyEl), true)
    stripReplyQuotes(bodyEl)
    // Safety net: never reduce a non-empty message to nothing.
    body = cleanBody(domText(bodyEl)) || cleanBody(rawText, true)
  }

  if (!body && !senderName) {
    return null
  }
  return { message: { senderName, senderEmail, date, toText, body }, withQuotes }
}

/** Parse a print-view HTML document into subject + messages. */
export function parsePrintThread(
  html: string,
  base = "https://mail.google.com/mail/u/0/"
): { subject: string; messages: Message[] } {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const subject = doc.title.replace(/^Gmail - /, "").trim()
  const blocks = Array.from(doc.querySelectorAll<HTMLTableElement>("table.message"))
  const messages = resolveQuotes(
    blocks.map(block => parseMessage(block, base)).filter((m): m is ParsedMessage => m !== null)
  )
  return { subject, messages }
}

/**
 * Fetch and parse the print view. Returns null on any failure (no thread id,
 * non-200, a login redirect, an unexpected document, or a parse error) so the
 * caller can fall back to live-DOM scraping.
 */
export async function extractViaPrintView(): Promise<{
  subject: string
  messages: Message[]
} | null> {
  const threadId = getLegacyThreadId()
  if (!threadId) {
    return null
  }

  try {
    const res = await fetch(printUrl(threadId), { credentials: "include" })
    if (!res.ok) {
      return null
    }
    const html = await res.text()
    if (!html.includes('class="message"')) {
      return null // login page or unexpected response
    }
    const result = parsePrintThread(html, printBase())
    return result.messages.length > 0 ? result : null
  } catch {
    return null
  }
}
