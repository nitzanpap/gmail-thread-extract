/** Trigger a client-side `.md` download via a synthetic anchor click. */
export function downloadMarkdown(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 1000)
}

/** Show a small self-removing toast in the corner. Less intrusive than alert(). */
export function toast(message: string): void {
  const el = document.createElement("div")
  el.textContent = message
  el.setAttribute(
    "style",
    [
      "position:fixed",
      "z-index:2147483647",
      "bottom:80px",
      "right:24px",
      "max-width:360px",
      "padding:12px 16px",
      "border-radius:8px",
      "background:#202124",
      "color:#fff",
      "font:13px/1.4 'Google Sans',Roboto,Arial,sans-serif",
      "box-shadow:0 4px 12px rgba(0,0,0,0.3)",
      "white-space:pre-wrap"
    ].join(";")
  )
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}
