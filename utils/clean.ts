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

/** Re-add spacing/line breaks lost when Gmail flattens HTML to innerText. */
export function improveReadableSpacing(text: string): string {
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

  return result.replace(/\n{3,}/g, "\n\n").trim()
}

/** Last-pass cleanup of artifacts introduced by the spacing pass. */
export function finalPolish(text: string): string {
  return text
    .replace(/\bBest\s*\n+\s*Regards\b/g, "Best Regards")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Cut everything from the first quoted/forwarded section onward — that content
 * belongs to an earlier message in the thread and we extract those separately.
 */
export function removeAfterPatterns(text: string): string {
  const patterns = [
    // Gmail / webmail quote markers.
    /\nOn .+ wrote:/i,
    /\nOn .+ at .+ wrote:/i,
    // Inline Gmail quote pattern, when Gmail collapses it into the same line.
    /\sOn [A-Z][a-z]{2},? .+ wrote:/i,
    /\sOn [A-Z][a-z]{2},? .+ <.+> wrote:/i,
    // German Outlook quote markers.
    /\nVon: .+/i,
    /\nGesendet: .+/i,
    /\n-----Ursprüngliche Nachricht-----/i,
    /\n-{2,} Weitergeleitete Nachricht -{2,}/i,
    // English forwarded markers.
    /\n-{2,} Forwarded message -{2,}/i,
    /\nFrom: .+\nSent: .+\nTo: .+\nSubject: .+/i
  ]

  let cutAt = -1
  for (const pattern of patterns) {
    const match = text.match(pattern)
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

/** Full cleaning pipeline for a single message body. */
export function cleanBody(text: string): string {
  let result = cleanText(text)
  result = improveReadableSpacing(result)
  result = removeAfterPatterns(result)
  result = removeNoiseLines(result)
  result = improveReadableSpacing(result)
  result = finalPolish(result)
  return cleanText(result)
}
