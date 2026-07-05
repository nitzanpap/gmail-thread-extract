import { describe, expect, it } from "vitest"
import { cleanBody, isForwardedContent } from "../utils/clean"

describe("cleanBody", () => {
  it("strips Gmail's collapsed-quote placeholder", () => {
    expect(cleanBody("Hello there\n[Quoted text hidden]")).toBe("Hello there")
  })

  it("strips repeated placeholders", () => {
    expect(cleanBody("Hi\n[Quoted text hidden]\n[Quoted text hidden]")).toBe("Hi")
  })

  it("keeps real body content", () => {
    expect(cleanBody("Line one\nLine two")).toBe("Line one\nLine two")
  })

  it("still cuts redundant reply history", () => {
    const text = "My reply.\nOn Mon, Jun 22, 2026 Alice <a@x.com> wrote:\nold stuff"
    expect(cleanBody(text)).toBe("My reply.")
  })

  it("keeps forwarded-message content (does not cut at the forward marker)", () => {
    const fwd =
      "---------- Forwarded message ---------\nFrom: AWS <no-reply@aws.com>\n\nPlease review your account."
    const out = cleanBody(fwd)
    expect(out).toContain("Forwarded message")
    expect(out).toContain("Please review your account.")
  })

  it("keepQuotes preserves everything as a safety net", () => {
    const text = "On Mon Alice wrote:\nquoted"
    expect(cleanBody(text, true)).toContain("quoted")
  })
})

describe("isForwardedContent", () => {
  it("detects forwarded blocks", () => {
    expect(isForwardedContent("---------- Forwarded message ---------")).toBe(true)
    expect(isForwardedContent("On Mon Alice wrote:")).toBe(false)
  })
})
