import { describe, expect, it } from "vitest"
import type { Thread } from "../types"
import { applyBoilerplate, selectMessages, serialize } from "../utils/serialize"

const thread: Thread = {
  subject: "Server move",
  messages: [
    { senderName: "Ada", senderEmail: "ada@x.com", date: "d1", toText: "to me", body: "First." },
    {
      senderName: "Bob",
      senderEmail: "bob@x.com",
      date: "d2",
      toText: "",
      body: "Second.\nSent from my iPhone"
    },
    { senderName: "Cy", senderEmail: "cy@x.com", date: "d3", toText: "", body: "Third." }
  ],
  attachments: [{ name: "report.pdf", url: "https://x/report" }]
}

const AT = "2026-06-29T00:00:00.000Z"
const opts = (o: Partial<Parameters<typeof serialize>[1]> = {}) => ({
  format: "markdown" as const,
  count: 0,
  includeAttachments: true,
  boilerplate: [] as string[],
  ...o
})

describe("selectMessages", () => {
  it("keeps all when count is 0", () => {
    expect(selectMessages(thread.messages, 0)).toHaveLength(3)
  })
  it("keeps the last N", () => {
    expect(selectMessages(thread.messages, 2).map(m => m.senderName)).toEqual(["Bob", "Cy"])
  })
})

describe("applyBoilerplate", () => {
  it("drops lines containing a phrase (case-insensitive)", () => {
    expect(applyBoilerplate("Hello\nSent from my iPhone", ["sent from my iphone"])).toBe("Hello")
  })
  it("is a no-op with no phrases", () => {
    expect(applyBoilerplate("Hello", [])).toBe("Hello")
  })
})

describe("serialize", () => {
  it("markdown includes attachments and honors range", () => {
    const { content, ext } = serialize(thread, opts({ count: 1 }), AT)
    expect(ext).toBe("md")
    expect(content).toContain("## Message 1")
    expect(content).not.toContain("## Message 2") // only last 1 kept
    expect(content).toContain("## Attachments")
    expect(content).toContain("[report.pdf](https://x/report)")
  })

  it("omits attachments when disabled", () => {
    const { content } = serialize(thread, opts({ includeAttachments: false }), AT)
    expect(content).not.toContain("Attachments")
  })

  it("applies boilerplate to bodies", () => {
    const { content } = serialize(thread, opts({ boilerplate: ["Sent from my iPhone"] }), AT)
    expect(content).not.toContain("Sent from my iPhone")
    expect(content).toContain("Second.")
  })

  it("plain text has no markdown markers and correct extension", () => {
    const { content, ext } = serialize(thread, opts({ format: "text" }), AT)
    expect(ext).toBe("txt")
    expect(content).not.toContain("**From:**")
    expect(content).toContain("From: Ada <ada@x.com>")
    expect(content).toContain("Attachments:")
  })

  it("json is valid and structured", () => {
    const { content, ext } = serialize(thread, opts({ format: "json" }), AT)
    expect(ext).toBe("json")
    const parsed = JSON.parse(content)
    expect(parsed.subject).toBe("Server move")
    expect(parsed.messages).toHaveLength(3)
    expect(parsed.messages[0].from.email).toBe("ada@x.com")
    expect(parsed.attachments[0].name).toBe("report.pdf")
  })
})
