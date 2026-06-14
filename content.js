/**
 * Redirect Blocker — content script
 * Author: Dejan Simic | BeoData (beodata.rs)
 * License: MIT
 *
 * Minimal content script — the heavy lifting is done in background.js.
 * This script only responds to ping messages used for connection checks.
 */

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "pong" });
    return true;
  }
});