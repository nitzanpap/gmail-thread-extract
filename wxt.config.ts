import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Gmail Thread Extractor",
    description: "Extract a Gmail conversation as clean Markdown",
    // storage: persists the show-floating-button setting.
    // activeTab: lets the popup message the content script in the current tab.
    // clipboardWrite: the popup-triggered path has no page user gesture, so the
    //   permission is needed for the clipboard copy there (download always works).
    // No host_permissions: the content-script `matches` grants the Gmail origin.
    permissions: ["storage", "activeTab", "clipboardWrite"],
    icons: {
      16: "icon/16.png",
      48: "icon/48.png",
      128: "icon/128.png"
    }
  }
})
