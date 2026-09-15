// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { imageMarkdown, inlineImages, isContentImage } from "../utils/images"

const BASE = "https://mail.google.com/mail/u/0/"

function img(html: string): Element {
  const host = document.createElement("div")
  host.innerHTML = html
  return host.querySelector("img") as Element
}

describe("isContentImage", () => {
  it("keeps a full-size screenshot", () => {
    expect(isContentImage(img('<img width="1849" height="818" src="?a=1">'))).toBe(true)
  })

  it("drops signature icons and tracking pixels", () => {
    expect(isContentImage(img('<img width="19" height="19" src="?a=1">'))).toBe(false)
    expect(isContentImage(img('<img width="1" height="1" src="?a=1">'))).toBe(false)
    expect(isContentImage(img('<img width="70" height="64" src="?a=1">'))).toBe(false)
  })

  it("drops an image that is wide but hairline-thin", () => {
    expect(isContentImage(img('<img width="600" height="2" src="?a=1">'))).toBe(false)
  })

  it("keeps an image with no declared size rather than losing content", () => {
    expect(isContentImage(img('<img src="?a=1">'))).toBe(true)
  })

  it("treats a percentage width as unknown, not as that many pixels", () => {
    // parseInt("60%") is 60 — sizing a full-width hero as a 60px icon.
    expect(isContentImage(img('<img width="60%" src="?a=1">'))).toBe(true)
    expect(isContentImage(img('<img width="60%" height="400" src="?a=1">'))).toBe(true)
  })

  it("drops an explicitly zero-sized image", () => {
    expect(isContentImage(img('<img width="0" height="0" src="?a=1">'))).toBe(false)
  })
})

describe("imageMarkdown", () => {
  it("resolves Gmail's query-only print-view src against the base", () => {
    expect(
      imageMarkdown(img('<img width="800" height="600" src="?ui=2&amp;attid=0.1">'), BASE)
    ).toBe("![image](https://mail.google.com/mail/u/0/?ui=2&attid=0.1)")
  })

  it("uses alt text as the label", () => {
    expect(
      imageMarkdown(img('<img width="800" height="600" alt="Q3 chart" src="?a=1">'), BASE)
    ).toBe("![Q3 chart](https://mail.google.com/mail/u/0/?a=1)")
  })

  it("neutralizes brackets in alt text so the marker stays valid", () => {
    const md = imageMarkdown(img('<img width="800" height="600" alt="a [b] c" src="?a=1">'), BASE)
    expect(md).toBe("![a b c](https://mail.google.com/mail/u/0/?a=1)")
  })

  it("escapes parentheses so the Markdown link can't terminate early", () => {
    // Gmail's image proxy appends the sender's original URL verbatim.
    const md = imageMarkdown(
      img(
        '<img width="800" height="600" src="https://ci3.googleusercontent.com/p/x#https://cdn.ex/a)b.png">'
      ),
      BASE
    )
    expect(md).toBe("![image](https://ci3.googleusercontent.com/p/x#https://cdn.ex/a%29b.png)")
  })

  it("returns null for decoration and for a missing src", () => {
    expect(imageMarkdown(img('<img width="19" height="19" src="?a=1">'), BASE)).toBeNull()
    expect(imageMarkdown(img('<img width="800" height="600">'), BASE)).toBeNull()
  })
})

describe("inlineImages", () => {
  it("replaces images with markers in place and drops decoration", () => {
    const host = document.createElement("div")
    host.innerHTML =
      '<div>Before<img width="900" height="500" alt="chart" src="?a=1">After' +
      '<img width="19" height="19" src="?b=2"></div>'
    inlineImages(host, BASE)

    expect(host.querySelectorAll("img")).toHaveLength(0)
    expect(host.textContent).toContain("![chart](https://mail.google.com/mail/u/0/?a=1)")
    expect(host.textContent).toContain("Before")
    expect(host.textContent).toContain("After")
    expect(host.textContent).not.toContain("?b=2")
  })
})
