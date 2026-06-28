import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Gmail Thread Extractor",
    description: "Extract a Gmail conversation as clean Markdown",
    // ponytail: no permissions. The content script copies via navigator.clipboard
    // on a user gesture and downloads via a synthetic <a download> click — neither
    // needs a permission, and `matches` already grants the mail.google.com origin.
    // Add clipboardWrite / downloads / host_permissions only if something breaks.
    icons: {
      16: "icon/16.png",
      48: "icon/48.png",
      128: "icon/128.png"
    }
  }
})
