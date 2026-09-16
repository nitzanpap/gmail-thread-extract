/**
 * Text-cleaning pipeline for Gmail message bodies.
 *
 * Ported from a working console snippet. The generic quote/signature/noise
 * stripping is the valuable part and is kept; sender- and company-specific
 * literals from the original were removed. Add your own one-off fixes via
 * PERSONAL_OVERRIDES below.
 */

/** User-editable string replacements applied to every body. Empty by default. */
const PERSONAL_OVERRIDES: ReadonlyArray<[RegExp, string]> = [
  // Example — uncomment / add your own:
  // [/\bAcme Corp\b/g, "Acme"],
]

/** Collapse whitespace, normalize non-breaking spaces and newlines. */
export function cleanText(text: string): string {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * A whole line that is just a Markdown image marker, e.g. `![alt](https://…)`.
 * Its URL must survive verbatim — `.replace(/\.([A-Z])/…)` below and friends
 * would inject spaces into a signed Gmail attachment URL.
 */
const IMAGE_LINE = /^!\[[^\]]*\]\(\S+\)$/

function respace(text: string): string {
  let result = text
    // Fix missing spaces after punctuation.
    .replace(/,([A-Z])/g, ", $1")
    .replace(/\.([A-Z])/g, ". $1")
    .replace(/\?([A-Z])/g, "? $1")
    .replace(/!([A-Z])/g, "! $1")
    .replace(/:([A-Z])/g, ": $1")
    // Add useful line breaks around common email sign-off patterns.
    .replace(/\b(Sincerely,)\s*/g, "\n$1\n")
    .replace(/\b(Best Regards)\b/g, "\n$1")
    .replace(/\b(Kind Regards)\b/g, "\n$1")
    .replace(/\b(Regards)\b/g, "\n$1")
    // Undo generic browser/copy quirks (word-splitting of common terms).
    .replace(/\bGmb H\b/g, "GmbH")
    .replace(/\bLinked In\b/g, "LinkedIn")

  for (const [pattern, replacement] of PERSONAL_OVERRIDES) {
    result = result.replace(pattern, replacement)
  }

  // No trim here: several rules above work by PREPENDING a newline, which the
  // per-line caller below would otherwise trim straight back off.
  return result
}

/** Re-add spacing/line breaks lost when Gmail flattens HTML to innerText. */
export function improveReadableSpacing(text: string): string {
  // Image markers are passed through untouched; everything else is respaced.
  const spaced = text.includes("![")
    ? text
        .split("\n")
        .map(line => (IMAGE_LINE.test(line.trim()) ? line.trim() : respace(line)))
        .join("\n")
    : respace(text)

  return spaced.replace(/\n{3,}/g, "\n\n").trim()
}

/** Last-pass cleanup of artifacts introduced by the spacing pass. */
export function finalPolish(text: string): string {
  return text
    .replace(/\bBest\s*\n+\s*Regards\b/g, "Best Regards")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Marks a forwarded-message block. Unlike a reply quote (redundant — the quoted
 * message is elsewhere in the thread), a forward's content is unique and must be
 * kept, so we detect it to avoid stripping/cutting it away.
 */
export const FORWARD_MARKER = /-{2,}\s*(Forwarded message|Weitergeleitete Nachricht)\s*-{2,}/i

export function isForwardedContent(text: string): boolean {
  return FORWARD_MARKER.test(text)
}

/** A quote's own text, excluding quotes nested inside it. */
function ownText(quote: Element): string {
  const copy = quote.cloneNode(true) as Element
  for (const nested of Array.from(copy.querySelectorAll(".gmail_quote"))) {
    nested.remove()
  }
  return copy.textContent || ""
}

/**
 * True when `el` is, or sits inside, a forwarded `.gmail_quote`. A forward
 * carries its own conversation: reply quotes nested inside it are usually
 * history from another thread, so they're kept — duplicating a same-thread
 * forward's history beats dropping content that exists nowhere else.
 *
 * A quote is a forward only if the marker is in its OWN content: a reply quote
 * that merely contains a forward deeper down is still a reply.
 */
export function isInsideForward(el: Element): boolean {
  for (
    let q = el.closest(".gmail_quote");
    q;
    q = q.parentElement?.closest(".gmail_quote") ?? null
  ) {
    if (isForwardedContent(ownText(q))) {
      return true
    }
  }
  return false
}

/** Remove reply quotes (redundant with the thread's other messages), keeping forwards whole. */
export function stripReplyQuotes(root: Element): void {
  for (const quote of Array.from(root.querySelectorAll(".gmail_quote"))) {
    // The whole-text check keeps a quote that contains a forward anywhere, as
    // before; isInsideForward adds the reply history nested within a forward.
    if (!isForwardedContent(quote.textContent || "") && !isInsideForward(quote)) {
      quote.remove()
    }
  }
}

/**
 * Cut everything from the first quoted REPLY section onward — that content is an
 * earlier message we already extract separately. Forwarded content is NOT cut
 * (it's unique): forward markers are absent from the patterns, and nothing after
 * the first forward marker is searched, since a reply marker there belongs to
 * the forwarded conversation.
 */
export function removeAfterPatterns(text: string): string {
  const patterns = [
    // Gmail / webmail reply-quote markers.
    /\nOn .+ wrote:/i,
    /\nOn .+ at .+ wrote:/i,
    // Inline Gmail quote pattern, when Gmail collapses it into the same line.
    /\sOn [A-Z][a-z]{2},? .+ wrote:/i,
    /\sOn [A-Z][a-z]{2},? .+ <.+> wrote:/i,
    // German Outlook reply markers.
    /\nVon: .+/i,
    /\nGesendet: .+/i,
    /\n-----Ursprüngliche Nachricht-----/i
  ]

  const forwardAt = text.search(FORWARD_MARKER)
  const searchable = forwardAt >= 0 ? text.slice(0, forwardAt) : text

  let cutAt = -1
  for (const pattern of patterns) {
    const match = searchable.match(pattern)
    if (match && match.index !== undefined && match.index > 0) {
      if (cutAt === -1 || match.index < cutAt) {
        cutAt = match.index
      }
    }
  }

  return cutAt > -1 ? text.slice(0, cutAt).trim() : text
}

/** Drop generic banner/footer/UI noise lines (company-agnostic only). */
export function removeNoiseLines(text: string): string {
  const noisyLinePatterns = [
    /^Download$/i,
    /^Add to Drive$/i,
    /^Save to Photos$/i,
    /^sophospsmartbannerend$/i,
    /^Follow us on LinkedIn!?$/i,
    /^Please consider the environment before printing this e-mail$/i,
    /^P$/i,
    /^P\s+Please consider the environment before printing this e-mail$/i,
    // Gmail's collapsed-quote placeholder — the quoted content it stands in for
    // is already captured as its own message in the thread, so drop the marker.
    /^\[quoted text hidden\]$/i,
    /^\[message clipped\].*$/i
  ]

  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !noisyLinePatterns.some(p => p.test(line)))
    .join("\n")
    .trim()
}

/**
 * Full cleaning pipeline for a single message body. With `keepQuotes`, the
 * reply-quote cut is skipped — used as a safety net so a body that is entirely
 * quoted/forwarded content is never reduced to nothing.
 */
export function cleanBody(text: string, keepQuotes = false): string {
  let result = cleanText(text)
  result = improveReadableSpacing(result)
  if (!keepQuotes) {
    result = removeAfterPatterns(result)
  }
  result = removeNoiseLines(result)
  result = improveReadableSpacing(result)
  result = finalPolish(result)
  return cleanText(result)
}
