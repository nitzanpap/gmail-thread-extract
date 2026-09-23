import type { Message } from "../types"

/**
 * Reply quotes are stripped because the quoted message is usually elsewhere in
 * the thread. "Usually" is the trap: you were CC'd mid-conversation, the reply
 * quotes mail you never got, someone answered inline inside the quote, or a
 * forward's header is in a language we don't recognize. So stripping is only
 * provisional — a quote is dropped only when the EARLIER messages already hold
 * its text. Later messages don't count: they quote this one, quote included,
 * and would vouch for content that exists nowhere else.
 */

/** A parsed message plus its body with every quote left in. */
export interface ParsedMessage {
  message: Message
  withQuotes: string
}

/**
 * Normalized chars a quote may leave unaccounted for: a sign-off the respacing
 * pass split differently. Kept small — an inline "yes" is content too.
 */
const TOLERANCE = 10

const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/** Outlook-style header fields, in the locales seen so far. */
const HEADER_FIELD =
  /^(from|sent|to|cc|bcc|subject|date|von|gesendet|an|betreff|datum|de|envoyé|à|objet|para|enviado|asunto|מאת|נשלח|אל|עותק|נושא|תאריך)\s*:/i

/**
 * A quote header, top-level or nested: "On … wrote:", "בתאריך … מאת …:",
 * "From: …", "-----Original Message-----". The quoting client writes these, so
 * they rarely match an earlier message verbatim and would falsely count as new.
 * Only named fields, not any "Word:" — "ע.א.: …" marks an inline answer.
 */
function isHeaderLine(line: string): boolean {
  const text = line.replace(BIDI, "").trim()
  return /:$/.test(text) || HEADER_FIELD.test(text) || /^-{2,}.*-{2,}$/.test(text)
}

/**
 * Letters and digits only, so wrapping, punctuation and `>` markers don't
 * matter. Image markers go too: the same image has a different URL per message.
 */
function normalize(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\(\S+\)/g, "")
    .replace(/\[cid:[^\]]*\]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

/**
 * The lines stripping removed. Not a suffix: the print view puts the
 * attachment list after the quote, so the kept text can resume past it.
 */
function removedLines(body: string, withQuotes: string): string[] {
  const kept = new Set(body.split("\n").map(normalize))
  return withQuotes.split("\n").filter(line => !kept.has(normalize(line)))
}

/** Normalized chars of the quote (header lines aside) missing from every earlier text. */
function uncoveredLength(quote: string[], earlier: string[]): number {
  return quote
    .filter(line => !isHeaderLine(line))
    .map(normalize)
    .filter(line => !earlier.some(text => text.includes(line)))
    .reduce((sum, line) => sum + line.length, 0)
}

/** Each message's body, with its quotes restored unless earlier messages cover them. */
export function resolveQuotes(parsed: ParsedMessage[]): Message[] {
  const resolved: Message[] = []
  // Earlier messages' full text, whole so re-wrapped lines still match. A reply
  // usually re-quotes the entire history, so a text it contains is dropped —
  // otherwise the corpus grows quadratically and a long thread stalls the tab.
  let earlier: string[] = []
  for (const { message, withQuotes } of parsed) {
    const covered = uncoveredLength(removedLines(message.body, withQuotes), earlier) <= TOLERANCE
    resolved.push(covered ? message : { ...message, body: withQuotes })
    const text = normalize(withQuotes)
    earlier = [...earlier.filter(prior => !text.includes(prior)), text]
  }
  return resolved
}
