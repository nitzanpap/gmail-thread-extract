import type { Message } from "../types"
import { cleanBody, cleanText, improveReadableSpacing } from "./clean"
import { extractViaPrintView } from "./printView"

/**
 * DOM scraping of the open Gmail conversation into typed Message objects.
 *
 * Gmail's class names (.adn, .a3s, .gD, .g3, .hP, …) are obfuscated and change
 * over time. Treat these selectors as a best guess. When extraction returns
 * zero messages the caller surfaces a visible error; set DEBUG to trace which
 * stage produced nothing.
 */
const DEBUG = false

function debug(...args: unknown[]): void {
  // ponytail: gated behind a compile-time-off flag so no console in shipped path.
  if (DEBUG) {
    // biome-ignore lint/suspicious/noConsole: debug-only, off by default
    console.debug("[gmail-extractor]", ...args)
  }
}

function getText(el: Element | null | undefined): string {
  const node = el as HTMLElement | null | undefined
  return cleanText(node?.innerText || el?.textContent || "")
}

function getAttr(el: Element | null | undefined, attr: string): string {
  return el?.getAttribute(attr) || ""
}

/** The conversation subject, best-effort across DOM and document title. */
export function extractSubject(): string {
  return improveReadableSpacing(
    getText(document.querySelector("h2.hP")) ||
      getText(document.querySelector("[data-thread-perm-id] h2")) ||
      document.title.replace(/ - Gmail$/, "")
  )
}

function findMessageNodes(): Element[] {
  const nodes = Array.from(document.querySelectorAll(".adn.ads, .adn, [role='listitem']")).filter(
    node => {
      const body = node.querySelector(".a3s")
      const sender = node.querySelector(".gD, [email], .go")
      return body && sender
    }
  )

  if (nodes.length === 0) {
    debug("stage=findMessageNodes found 0 candidates (selectors may have changed)")
  }
  return nodes
}

function stripNoiseNodes(clone: Element): void {
  const selector = [
    "style",
    "script",
    "noscript",
    ".gmail_quote",
    ".gmail_signature",
    ".yj6qo",
    ".adL",
    ".im",
    "blockquote"
  ].join(", ")
  for (const el of Array.from(clone.querySelectorAll(selector))) {
    el.remove()
  }
}

function nodeToMessage(node: Element): Message | null {
  const senderEl =
    node.querySelector(".gD[email]") ||
    node.querySelector("[email]") ||
    node.querySelector(".gD") ||
    node.querySelector(".go")

  const senderName =
    getAttr(senderEl, "name") || getAttr(senderEl, "data-name") || getText(senderEl)

  const senderEmail = getAttr(senderEl, "email") || getAttr(senderEl, "data-hovercard-id") || ""

  const dateEl =
    node.querySelector(".g3") ||
    node.querySelector(".gH .g3") ||
    node.querySelector("[title][alt]") ||
    node.querySelector("[title]")

  const date = getAttr(dateEl, "title") || getAttr(dateEl, "alt") || getText(dateEl)

  const toEl =
    node.querySelector(".hb") ||
    node.querySelector(".g2") ||
    node.querySelector("[aria-label*='To']")

  const toText = getText(toEl)

  const bodyEl = node.querySelector(".a3s.aiL") || node.querySelector(".a3s")
  const clone = bodyEl?.cloneNode(true) as HTMLElement | undefined
  if (clone) {
    stripNoiseNodes(clone)
  }

  const body = cleanBody(clone?.innerText || "")
  if (!body) {
    return null
  }

  return { senderName, senderEmail, date, toText, body }
}

/** Extract every distinct message in the open thread, in document order. */
export function extractMessages(): Message[] {
  const seen = new Set<string>()
  const messages: Message[] = []

  for (const node of findMessageNodes()) {
    const message = nodeToMessage(node)
    if (!message) {
      continue
    }

    const signature = `${message.senderName}|${message.senderEmail}|${message.date}|${message.body.slice(0, 120)}`
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
    messages.push(message)
  }

  if (messages.length === 0) {
    debug("stage=extractMessages produced 0 messages")
  }
  return messages
}

/** True when a conversation appears to be open (used to decide button injection). */
export function isThreadOpen(): boolean {
  return Boolean(document.querySelector("h2.hP")) && findMessageNodes().length > 0
}

/** Selectors that mark a still-collapsed message or super-collapsed bundle. */
const COLLAPSED_SELECTOR = ".kv, .kQ, .adv"

/**
 * aria-label of Gmail's "Expand all" toolbar button. Locale-dependent — add
 * patterns for your Gmail UI language if auto-expand stops working.
 * ponytail: matched by label text; a single click expands every collapsed
 * message and the super-collapsed bundle (verified). Messages that can't be
 * expanded are simply skipped and the message count reflects that.
 */
const EXPAND_ALL_LABELS: ReadonlyArray<RegExp> = [/expand all/i]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function findExpandAllButton(): HTMLElement | null {
  for (const button of Array.from(document.querySelectorAll<HTMLElement>("button[aria-label]"))) {
    const label = button.getAttribute("aria-label") || ""
    if (EXPAND_ALL_LABELS.some(re => re.test(label))) {
      return button
    }
  }
  return null
}

/**
 * Expand all collapsed messages so their bodies render into the DOM. Gmail
 * lazy-renders collapsed messages, so without this only the open message is
 * scraped. No-op when nothing is collapsed or the control can't be found.
 */
export async function expandThread(): Promise<void> {
  if (!document.querySelector(COLLAPSED_SELECTOR)) {
    return
  }

  const button = findExpandAllButton()
  if (!button) {
    debug("stage=expandThread expand-all button not found (locale?)")
    return
  }

  button.click()

  // Bodies render asynchronously; wait until no collapsed markers remain.
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    await delay(200)
    if (!document.querySelector(COLLAPSED_SELECTOR)) {
      break
    }
  }
  await delay(200) // brief settle for the last body to paint
}

/**
 * Extract the open thread. Prefers Gmail's print view (complete, pre-expanded,
 * stable selectors); falls back to expanding and scraping the live DOM if the
 * print fetch/parse yields nothing.
 */
export async function extractThread(): Promise<{ subject: string; messages: Message[] }> {
  const viaPrint = await extractViaPrintView()
  if (viaPrint) {
    return viaPrint
  }

  debug("stage=extractThread print view unavailable, falling back to live DOM")
  await expandThread()
  return { subject: extractSubject(), messages: extractMessages() }
}
