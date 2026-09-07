// Background service worker for Setflow.
//
// Chrome injects content scripts only into pages loaded after the extension was (re)loaded or
// enabled. Tabs already open on YouTube Music keep an orphaned copy that can't reach storage
// or the popup. Every time this worker starts (install, update, reload, enable, browser
// start) it injects the current content script into those tabs; the script's takeover
// handshake makes any older copy let go of the page.
async function injectIntoOpenTabs() {
  const { js = [], css = [] } = chrome.runtime.getManifest().content_scripts?.[0] ?? {}
  const tabs = await chrome.tabs.query({ url: '*://music.youtube.com/*' })
  for (const tab of tabs) {
    if (!tab.id) continue
    try {
      if (css.length) await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: css })
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: js })
    } catch {
      // Discarded or otherwise non-injectable tab; it gets the script on its next load
    }
  }
}

injectIntoOpenTabs()
