import { describe, expect, it } from "vitest"
import { cleanBody } from "../utils/clean"

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
})
