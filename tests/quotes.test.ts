import { describe, expect, it } from "vitest"
import type { Message } from "../types"
import { type ParsedMessage, resolveQuotes } from "../utils/quotes"

/** A message whose stripped body is `body` and whose quote, if any, is `quote`. */
function parsed(body: string, quote = ""): ParsedMessage {
  const message: Message = { senderName: "", senderEmail: "", date: "", toText: "", body }
  return { message, withQuotes: quote ? `${body}\n${quote}` : body }
}

const bodies = (list: ParsedMessage[]) => resolveQuotes(list).map(m => m.body)

const A = "The server moves to the new rack on Friday at noon."
const B = "Can we push it to Monday? The vendor is late."

describe("resolveQuotes", () => {
  it("drops a quote whose text an earlier message holds", () => {
    const out = bodies([parsed(A), parsed(B, `On Mon, Jun 22, 2026 Ada <ada@x.com> wrote:\n${A}`)])
    expect(out[1]).toBe(B)
  })

  it("drops a whole quoted chain the earlier messages hold, rewrapped", () => {
    const quoteOfB = `On Mon Ada wrote:\n${A}`
    const out = bodies([
      parsed(A),
      parsed(B, quoteOfB),
      parsed("Monday works.", `On Tue Bob wrote:\n> ${B.replace(" The", "\n> The")}\n> ${quoteOfB}`)
    ])
    expect(out[2]).toBe("Monday works.")
  })

  it("keeps the first message's quote: it predates the thread", () => {
    expect(bodies([parsed(B, `On Mon Ada wrote:\n${A}`)])[0]).toContain(A)
  })

  it("keeps a later message's quote of mail that was never in the thread", () => {
    const out = bodies([parsed(A), parsed("Agreed.", `On Tue Eve wrote:\n${B}`)])
    expect(out[1]).toContain(B)
  })

  it("keeps a quote whose own message is missing even when the one it quotes is present", () => {
    const out = bodies([
      parsed(A),
      parsed("Agreed.", `On Tue Bob wrote:\n${B}\nOn Mon Ada wrote:\n${A}`)
    ])
    expect(out[1]).toContain(B)
  })

  it("keeps answers written inline inside the quote", () => {
    const out = bodies([
      parsed(A),
      parsed("See inline.", `On Mon Ada wrote:\n${A}\nNo, the rack is not ready yet.`)
    ])
    expect(out[1]).toContain("the rack is not ready yet")
  })

  it("never counts a later message as covering an earlier quote", () => {
    // The reply quotes the first message, quote and all — it must not vouch for it.
    const first = parsed("Found the cause.", `On Wed Limor wrote:\n${B}`)
    const out = bodies([first, parsed("Thanks.", `On Wed Limor wrote:\n${first.withQuotes}`)])
    expect(out[0]).toContain(B)
    expect(out[1]).toBe("Thanks.")
  })

  it("skips a multi-line Outlook header before the quoted text", () => {
    const header =
      "Von: Ada <ada@x.com>\nGesendet: Montag, 22. Juni 2026 09:00\nAn: Bob\nBetreff: AW: Server"
    expect(bodies([parsed(A), parsed(B, `${header}\n${A}`)])[1]).toBe(B)
  })

  it("skips nested headers the quoting client rewrote", () => {
    const quoteOfB = `On Mon Ada wrote:\n${A}`
    const out = bodies([
      parsed(A),
      parsed(B, quoteOfB),
      parsed(
        "Monday works.",
        `On Tue Bob <bob@x.com> wrote:\nFrom: Bob [mailto:bob@x.com]\nSent: Tuesday, June 23, 2026 10:37 AM\nCc: Ada; Eve\nSubject: RE: Server\n${B}\nOn Mon, 22 Jun 2026, 09:00 Ada <ada@x.com> wrote:\n${A}`
      )
    ])
    expect(out[2]).toBe("Monday works.")
  })

  it("keeps initialled inline answers even though they look like 'Key: value'", () => {
    const out = bodies([
      parsed(A),
      parsed("See inline.", `On Mon Ada wrote:\n${A}\nע.א.: לא, הארון עוד לא מוכן`)
    ])
    expect(out[1]).toContain("הארון עוד לא מוכן")
  })

  it("skips a right-to-left attribution line", () => {
    const header =
      "\u202bבתאריך יום ד׳, 23 בספט׳ 2026 ב-17:24 מאת \u202aLimor\u202c <limor@x.com>:\u202c"
    expect(bodies([parsed(A), parsed(B, `${header}\n${A}`)])[1]).toBe(B)
  })

  it("ignores image URLs, which differ per message", () => {
    const out = bodies([
      parsed(`${A}\n![image](https://mail.google.com/?attid=0.1)`),
      parsed(B, `On Mon Ada wrote:\n${A}\n![image](https://mail.google.com/?attid=0.9)`)
    ])
    expect(out[1]).toBe(B)
  })

  it("finds the quote when kept text follows it, like the print view's attachment list", () => {
    const entry = {
      ...parsed(`${B}\n2 attachments`),
      withQuotes: `${B}\nOn Mon Ada wrote:\n${A}\n2 attachments`
    }
    expect(bodies([parsed(A), entry])[1]).toBe(`${B}\n2 attachments`)
  })

  it("still keeps an unknown quote sitting before kept text", () => {
    const entry = {
      ...parsed(`${B}\n2 attachments`),
      withQuotes: `${B}\nOn Mon Eve wrote:\nThe rack arrives damaged, do not sign for it.\n2 attachments`
    }
    expect(bodies([parsed(A), entry])[1]).toContain("do not sign for it")
  })
})
