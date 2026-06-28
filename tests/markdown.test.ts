import { describe, expect, it } from "vitest"
import type { Message } from "../types"
import { safeFilename, toMarkdown } from "../utils/markdown"

const messages: Message[] = [
  {
    senderName: "Ada Lovelace",
    senderEmail: "ada@example.com",
    date: "Jun 22, 2026, 12:42 PM",
    toText: "to me",
    body: "First message body."
  },
  {
    senderName: "Alan Turing",
    senderEmail: "alan@example.com",
    date: "Jun 22, 2026, 12:57 PM",
    toText: "",
    body: "Second message body."
  }
]

describe("toMarkdown", () => {
  const md = toMarkdown("Hello World", messages, "2026-06-28T00:00:00.000Z")

  it("emits the header block", () => {
    expect(md).toContain("# Gmail Thread")
    expect(md).toContain("**Subject:** Hello World")
    expect(md).toContain("**Extracted at:** 2026-06-28T00:00:00.000Z")
  })

  it("reports the message count", () => {
    expect(md).toContain("**Messages found:** 2")
  })

  it("renders one block per message in order", () => {
    expect(md).toContain("## Message 1")
    expect(md).toContain("## Message 2")
    expect(md).not.toContain("## Message 3")
    expect(md.indexOf("## Message 1")).toBeLessThan(md.indexOf("## Message 2"))
  })

  it("formats From with email and omits empty To", () => {
    expect(md).toContain("**From:** Ada Lovelace <ada@example.com>")
    expect(md).toContain("**To / Details:** to me")
    // second message has empty toText → no To line for it
    const secondBlock = md.slice(md.indexOf("## Message 2"))
    expect(secondBlock).not.toContain("**To / Details:**")
  })
})

describe("safeFilename", () => {
  it("strips path-unsafe characters", () => {
    expect(safeFilename('a/b:c"d<e>f|g?h*i')).not.toMatch(/[<>:"/\\|?*]/)
  })

  it("truncates to 120 chars", () => {
    expect(safeFilename("x".repeat(500)).length).toBe(120)
  })

  it("falls back when empty", () => {
    expect(safeFilename("")).toBe("gmail-thread")
  })
})
