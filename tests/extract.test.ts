// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { extractMessages } from "../utils/extract"

const IMG =
  '<img width="1200" height="800" src="https://mail.google.com/mail/u/0/?ui=2&amp;attid=0.1&amp;view=fimg">'

function renderThread(bodyHtml: string): void {
  document.body.innerHTML = `
    <div class="adn ads">
      <span class="gD" email="ada@example.com" name="Ada Lovelace">Ada Lovelace</span>
      <span class="g3" title="Jun 22, 2026, 12:42 PM">12:42 PM</span>
      <div class="a3s aiL">${bodyHtml}</div>
    </div>`
}

describe("extractMessages (live-DOM fallback)", () => {
  it("keeps inline body images as Markdown", () => {
    renderThread(`<div>See the chart:<br>${IMG}<br>Regards</div>`)
    expect(extractMessages()[0].body).toContain("![image](https://mail.google.com/mail/u/0/?ui=2")
  })

  it("keeps them on the safety-net path, where the whole body is stripped as noise", () => {
    // `.im` is removed wholesale by stripNoiseNodes, so this body survives only
    // via the keepQuotes fallback — which must not lose the image on the way.
    renderThread(
      `<div class="im">---------- Forwarded message ---------<br>See the chart:<br>${IMG}</div>`
    )
    const body = extractMessages()[0].body
    expect(body).toContain("Forwarded message")
    expect(body).toContain("![image](https://mail.google.com/mail/u/0/?ui=2")
  })

  it("drops signature-sized icons", () => {
    renderThread('<div>Hi<img width="19" height="19" alt="phone" src="https://x/i.png"></div>')
    expect(extractMessages()[0].body).not.toContain("![")
  })

  it("keeps reply history quoted inside a forward, blockquote included", () => {
    renderThread(`<div dir="rtl">These are the photos.<br><br>
  <div class="gmail_quote">
    <div class="gmail_attr" dir="ltr">---------- Forwarded message ---------<br>From: Limor &lt;limor@example.com&gt;<br>Date: Wed, Sep 16, 2026 at 9:26 AM<br>Subject: Re: Fw: meter numbers<br>To: Tom &lt;tom@example.com&gt;<br></div><br><br>
    <div dir="rtl">Thanks a lot!</div><br>
    <div class="gmail_quote">
      <div class="gmail_attr" dir="ltr">On Wed, Sep 16, 2026 at 9:00 AM Tom &lt;tom@example.com&gt; wrote:<br></div>
      <blockquote class="gmail_quote"><div>Meter numbers:<br>1392627<br>1392631</div></blockquote>
    </div>
  </div>
</div>`)
    const body = extractMessages()[0].body
    expect(body).toContain("Thanks a lot!")
    expect(body).toContain("1392627")
    expect(body).toContain("1392631")
  })

  it("still drops a plain reply quote outside any forward", () => {
    renderThread(
      '<div>My reply.<div class="gmail_quote"><div class="gmail_attr">On Mon, Jun 22, 2026 Ada wrote:</div><blockquote class="gmail_quote">old stuff</blockquote></div></div>'
    )
    expect(extractMessages()[0].body).toBe("My reply.")
  })

  it("drops Gmail's inline-image hover toolbar", () => {
    // Live-DOM markup observed on a real thread: the labels sit in separate
    // elements but innerText on a detached clone glues them onto one line, so
    // the line-based noise patterns (^Download$ …) never match.
    renderThread(
      `<div>Photos:<br>${IMG}<div class="a6S"><span class="a5q"><div id="tt-c4">Download</div><div id="tt-c5">Add to Drive</div><div id="tt-c6">Save to Photos</div></span></div></div>`
    )
    const body = extractMessages()[0].body
    expect(body).toContain("![image](")
    expect(body).not.toMatch(/Download|Add to Drive|Save to Photos/)
  })

  it("drops a reply quote that merely contains a forward, whatever the header language", () => {
    // The quoted message (with its forward) is already in the thread. Only an
    // English "On … wrote:" header would be caught by the text-level cut, so
    // the DOM pass must not mistake the quote for forwarded content.
    renderThread(
      '<div>Got it, thanks.</div><br><div class="gmail_quote"><div class="gmail_attr">Am Mi., 16. Sept. 2026 um 09:00 Uhr schrieb Tom &lt;tom@example.com&gt;:<br></div>' +
        '<blockquote class="gmail_quote"><div>FYI see below<br><br><div class="gmail_quote"><div class="gmail_attr">---------- Forwarded message ---------<br>From: Limor</div><br><div>Meter 1392627</div></div></div></blockquote></div>'
    )
    const body = extractMessages()[0].body
    expect(body).toContain("Got it, thanks.")
    expect(body).not.toContain("FYI see below")
    expect(body).not.toContain("1392627")
  })

  it("drops the image hover toolbar on the safety-net path too", () => {
    renderThread(
      `<div class="im">---------- Forwarded message ---------<br>See the chart:<br>${IMG}<div class="a6S"><span><div>Download</div><div>Add to Drive</div><div>Save to Photos</div></span></div></div>`
    )
    const body = extractMessages()[0].body
    expect(body).toContain("See the chart:")
    expect(body).not.toMatch(/Download|Add to Drive|Save to Photos/)
  })
})
