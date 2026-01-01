// Background service worker for Setflow
// Handles alarms and notifications for phase transitions

chrome.runtime.onInstalled.addListener(() => {
  console.log('Setflow extension installed')
})

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SESSION') {
    chrome.storage.local.get('setflow', (result) => {
      const data = result.setflow as { activeSession?: unknown } | undefined
      sendResponse(data?.activeSession || null)
    })
    return true // Keep channel open for async response
  }
})

// Optional: Set up alarms for phase transition notifications
// This can be extended to show browser notifications when phases change
