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
})
