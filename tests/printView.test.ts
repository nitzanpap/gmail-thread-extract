// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { parsePrintThread } from "../utils/printView"

// Mirrors Gmail's print-view (?view=pt) structure observed live: each message is
// a <table class="message"> with sender in <b>, email as <…@…> text, a
// right-aligned date cell, a .recipient row, and a nested body table.
const PRINT_HTML = `
<html><head><title>Gmail - Server move thread</title></head><body>
<table class="message">
  <tr>
    <td><font size="-1"><b>Ada Lovelace</b> &lt;ada@example.com&gt;</font></td>
    <td align="right"><font size="-1">Jun 22, 2026, 12:42 PM</font></td>
  </tr>
  <tr><td colspan="2"><font size="-1" class="recipient"><div>to me</div></font></td></tr>
  <tr><td colspan="2"><table><tr><td><div>First body line.<br>Second line.</div></td></tr></table></td></tr>
</table>
<table class="message">
  <tr>
    <td><font size="-1"><b>Grace Hopper</b> &lt;grace@example.com&gt;</font></td>
    <td align="right"><font size="-1">Jun 22, 2026, 12:50 PM</font></td>
  </tr>
  <tr><td colspan="2"><font size="-1" class="recipient"><div>to me</div></font></td></tr>
  <tr><td colspan="2"><table><tr><td><div>See the readings below.<br>
    <img width="1849" height="818" src="?ui=2&amp;attid=0.1&amp;view=fimg&amp;disp=emb"><br>
    Regards<br>
    <img width="19" height="19" alt="phone icon" src="?ui=2&amp;attid=0.2&amp;view=fimg&amp;disp=emb">
  </div></td></tr></table></td></tr>
</table>
<table class="message">
  <tr>
    <td><font size="-1"><b>Alan Turing</b> &lt;alan@example.com&gt;</font></td>
    <td align="right"><font size="-1">Jun 22, 2026, 12:57 PM</font></td>
  </tr>
  <tr><td colspan="2"><font size="-1" class="recipient"><div>to Ada</div></font></td></tr>
  <tr><td colspan="2"><table><tr><td><div>Second body.<div class="gmail_signature">Sent from my device</div></div></td></tr></table></td></tr>
</table>
</body></html>`

describe("parsePrintThread", () => {
  const { subject, messages } = parsePrintThread(PRINT_HTML)

  it("reads the subject from the document title", () => {
    expect(subject).toBe("Server move thread")
  })

  it("parses one message per .message block", () => {
    expect(messages).toHaveLength(3)
  })

  it("extracts sender name, email, date and recipients", () => {
    expect(messages[0]).toMatchObject({
      senderName: "Ada Lovelace",
      senderEmail: "ada@example.com",
      toText: "to me"
    })
    expect(messages[0].date).toContain("12:42")
  })

  it("preserves body line breaks from <br>", () => {
    expect(messages[0].body).toContain("First body line.")
    expect(messages[0].body).toContain("Second line.")
  })

  it("strips gmail_signature noise from the body", () => {
    expect(messages[2].body).toContain("Second body.")
    expect(messages[2].body).not.toContain("Sent from my device")
  })

  it("keeps inline body images as Markdown, with the query-only src resolved", () => {
    expect(messages[1].body).toContain(
      "![image](https://mail.google.com/mail/u/0/?ui=2&attid=0.1&view=fimg&disp=emb)"
    )
  })

  it("drops signature-sized icons", () => {
    expect(messages[1].body).not.toContain("phone icon")
    expect(messages[1].body).not.toContain("attid=0.2")
  })

  it("leaves the image URL untouched by the text-spacing pass", () => {
    const url = messages[1].body.match(/\]\((\S+)\)/)?.[1]
    expect(url).toBe("https://mail.google.com/mail/u/0/?ui=2&attid=0.1&view=fimg&disp=emb")
  })
})
