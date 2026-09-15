/**
 * Inline body images — pasted screenshots, embedded charts — are content, but
 * both extraction paths serialize the body to text (`innerText` / `domText`),
 * which drops `<img>` silently. We swap each one for a Markdown image reference
 * at its position in the body, so the image survives as a link.
 *
 * Signature logos, social icons and tracking pixels are `<img>` too, so anything
 * below MIN_IMAGE_PX on a known axis is treated as decoration. Images with no
 * known size are kept — a stray icon beats a dropped screenshot.
 *
 * The URL is Gmail's session-scoped attachment URL (`view=fimg&disp=emb`): it
 * resolves in the signed-in browser, not from an anonymous fetch.
 */

/** Below this (px, on any known axis) an image is decoration, not content. */
const MIN_IMAGE_PX = 80

/**
 * A width/height attribute as pixels, or null when absent or not a plain pixel
 * count. `width="60%"` is a *relative* size — parsing it as 60px would junk a
 * full-width hero image as an icon.
 */
function attrPixels(img: Element, name: string): number | null {
  const raw = (img.getAttribute(name) || "").trim()
  return /^\d+$/.test(raw) ? Number(raw) : null
}

/** Known pixel dimensions, from the width/height attributes or the loaded image. */
function knownSize(img: Element): number[] {
  const el = img as HTMLImageElement
  const width = attrPixels(el, "width") ?? (el.naturalWidth || null)
  const height = attrPixels(el, "height") ?? (el.naturalHeight || null)
  return [width, height].filter((n): n is number => n !== null)
}

/** False for signature icons, spacers and tracking pixels. */
export function isContentImage(img: Element): boolean {
  const sizes = knownSize(img)
  return sizes.length === 0 || sizes.every(n => n >= MIN_IMAGE_PX)
}

/** Alt text as a Markdown-safe label. */
function label(img: Element): string {
  const alt = (img.getAttribute("alt") || "")
    .replace(/[[\]\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return alt || "image"
}

/**
 * `![alt](absolute url)` for a content image, or null when the image is
 * decoration or its `src` can't be resolved. `base` is the document the `src`
 * is relative to — print-view srcs are query-only (`?ui=2&…`).
 */
export function imageMarkdown(img: Element, base: string): string | null {
  const src = img.getAttribute("src") || ""
  if (!src || !isContentImage(img)) {
    return null
  }
  try {
    // Parens are legal in a URL but end a Markdown link destination early, and
    // Gmail's image proxy appends the sender's original URL verbatim.
    const href = new URL(src, base).href.replace(/\(/g, "%28").replace(/\)/g, "%29")
    return `![${label(img)}](${href})`
  } catch {
    return null
  }
}

/**
 * Replace every `<img>` under `root` with its Markdown marker, on its own line,
 * so the following text pass keeps it. Mutates `root` — only ever call this on a
 * detached clone or a parsed document, never on the live Gmail DOM.
 */
export function inlineImages(root: Element, base: string): void {
  const doc = root.ownerDocument
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const md = imageMarkdown(img, base)
    img.replaceWith(doc.createTextNode(md ? `\n${md}\n` : ""))
  }
}
