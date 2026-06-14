/**
 * Redirect Blocker — background service worker
 * Author: Dejan Simic | BeoData (beodata.rs)
 * License: MIT
 */

// ---------------------------------------------------------------------------
// State (restored from storage on startup)
// ---------------------------------------------------------------------------
let blockedCount = 0;
let isEnabled = true;

// Set used to prevent double-closing the same tab within the same event cycle
const pendingClose = new Set();

// User-defined domains (loaded from storage, updated live via onChanged)
let customDomains = [];

// Keep customDomains in sync whenever the options page saves a change.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.customDomains) {
    customDomains = changes.customDomains.newValue || [];
    console.log(`📋 Custom domains updated: ${customDomains.length} entries`);
  }
});

// ---------------------------------------------------------------------------
// Block-list
// ---------------------------------------------------------------------------

/**
 * Domain-level patterns — matched against the full hostname only.
 * Keeping these separate prevents false positives on short strings.
 */
const BLOCKED_DOMAINS = [
  "aliexpress.com",
  "click.aliexpress.com",
  "s.click.aliexpress.com",
  "best.aliexpress.com",
  "temu.com",
  "wish.com",
  "amazon.ae",
  "rakuten.com",
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "pagead2.googlesyndication.com",
  "adservice.google.com",
  "adsrvr.org",
  "adnxs.com",
  "popads.net",
  "trafficjunky.net",
  "exoclick.com",
  "adsterra.com",
  "mozzartbet.com",
  "propellerads.com",
];

/**
 * Query-parameter key patterns — matched against the query-string only.
 * Each entry is a full parameter key or unambiguous prefix.
 */
const BLOCKED_QUERY_PARAMS = [
  "aff_fcid",
  "aff_trace_key",
  "aff_platform",
  "aff_ab",
  "aff_sid",
  "af_sub",
  "CPS_NORMAL",
];

/**
 * Path/URL fragment patterns — matched against the full URL string.
 * Only use patterns that are long enough to be unambiguous.
 */
const BLOCKED_URL_FRAGMENTS = [
  "popunder",
  "_omocIxu",
  "?aff=",
  "&aff=",
];

// ---------------------------------------------------------------------------
// Core matching logic
// ---------------------------------------------------------------------------

/**
 * Returns true if the given URL should be blocked.
 * Uses a structured three-stage check to avoid false positives.
 *
 * @param {string} url
 * @returns {boolean}
 */
function shouldBlock(url) {
  if (!url || typeof url !== "string") return false;

  // Never block internal Chrome / extension pages
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Unparseable URL — skip silently
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const search = parsed.search.toLowerCase();
  const urlLower = url.toLowerCase();

  // Stage 1: hostname check (built-in list + user custom list)
  for (const domain of [...BLOCKED_DOMAINS, ...customDomains]) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      console.log(`🚫 BLOCKED (domain) [${domain}]: ${url.substring(0, 100)}`);
      return true;
    }
  }

  // Stage 2: query-parameter key check
  if (search) {
    for (const param of BLOCKED_QUERY_PARAMS) {
      // Match exact key (search contains "?key=" or "&key=")
      if (search.includes(`${param}=`)) {
        console.log(`🚫 BLOCKED (param) [${param}]: ${url.substring(0, 100)}`);
        return true;
      }
    }
  }

  // Stage 3: unambiguous URL fragment check
  for (const fragment of BLOCKED_URL_FRAGMENTS) {
    if (urlLower.includes(fragment)) {
      console.log(`🚫 BLOCKED (fragment) [${fragment}]: ${url.substring(0, 100)}`);
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Tab / window removal helper
// ---------------------------------------------------------------------------

/**
 * Closes a tab if it matches the block-list.
 * Uses pendingClose to prevent duplicate removal attempts.
 *
 * @param {number} tabId
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function closeTab(tabId, url) {
  if (!isEnabled) return false;
  if (!shouldBlock(url)) return false;
  if (pendingClose.has(tabId)) return false;

  pendingClose.add(tabId);

  try {
    await chrome.tabs.remove(tabId);
    blockedCount++;
    await chrome.storage.local.set({ blockedCount });
    console.log(`✅ CLOSED #${blockedCount}: ${url.substring(0, 100)}`);
    return true;
  } catch (err) {
    // Tab may already be closed — not an error worth surfacing
  } finally {
    // Allow future events for this tabId (tab is gone, but id may be reused)
    pendingClose.delete(tabId);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// 1. New tab opened (popup redirect, background tab, etc.)
chrome.tabs.onCreated.addListener((tab) => {
  // onCreated fires before the URL is set; wait one tick
  setTimeout(async () => {
    try {
      const fullTab = await chrome.tabs.get(tab.id);
      if (fullTab.url && fullTab.url !== "about:blank") {
        await closeTab(fullTab.id, fullTab.url);
      }
    } catch {
      // Tab may already be gone
    }
  }, 100);
});

// 2. URL change in existing tab (client-side redirect)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || changeInfo.url === "about:blank") return;

  setTimeout(async () => {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        await closeTab(tabId, tab.url);
      }
    } catch {
      // Tab may already be gone
    }
  }, 50);
});

// 3. Navigation event — fires before the page loads (earliest intercept point)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (!isEnabled) return;
  if (details.frameId !== 0) return; // Main frame only

  if (!shouldBlock(details.url)) return;
  if (pendingClose.has(details.tabId)) return;

  pendingClose.add(details.tabId);

  setTimeout(async () => {
    try {
      await chrome.tabs.remove(details.tabId);
      blockedCount++;
      await chrome.storage.local.set({ blockedCount });
      console.log(`✅ NAV BLOCKED #${blockedCount}: ${details.url.substring(0, 100)}`);
    } catch {
      // Tab may already be gone
    } finally {
      pendingClose.delete(details.tabId);
    }
  }, 10);
});

// 4. New popup window
chrome.windows.onCreated.addListener((window) => {
  setTimeout(async () => {
    try {
      const tabs = await chrome.tabs.query({ windowId: window.id });
      if (tabs.length > 0 && tabs[0].url && shouldBlock(tabs[0].url)) {
        await chrome.windows.remove(window.id);
        blockedCount++;
        await chrome.storage.local.set({ blockedCount });
        console.log(`✅ POPUP WINDOW BLOCKED #${blockedCount}`);
      }
    } catch {
      // Window may already be gone
    }
  }, 50);
});

// ---------------------------------------------------------------------------
// Message handler (popup communication)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.action) {
    case "toggle":
      isEnabled = Boolean(request.enabled);
      chrome.storage.local.set({ isEnabled });
      console.log(`Redirect Blocker ${isEnabled ? "ENABLED" : "DISABLED"}`);
      sendResponse({ status: "ok" });
      break;

    case "reset":
      blockedCount = 0;
      chrome.storage.local.set({ blockedCount: 0 });
      console.log("Counter reset");
      sendResponse({ status: "ok" });
      break;

    case "getStatus":
      sendResponse({ blockedCount, isEnabled });
      break;

    default:
      sendResponse({ status: "unknown_action" });
  }

  return true; // Keep message channel open for async responses
});

// ---------------------------------------------------------------------------
// Startup — restore persisted state
// ---------------------------------------------------------------------------

chrome.storage.local.get(["blockedCount", "isEnabled", "customDomains"], (result) => {
  blockedCount   = result.blockedCount ?? 0;
  isEnabled      = result.isEnabled !== false; // default: enabled
  customDomains  = result.customDomains || [];
  console.log(`🛡️ Redirect Blocker started`);
  console.log(`📊 Total blocked so far: ${blockedCount}`);
  console.log(`🎯 Status: ${isEnabled ? "ACTIVE" : "DISABLED"}`);
  console.log(`📋 Custom domains loaded: ${customDomains.length}`);
});