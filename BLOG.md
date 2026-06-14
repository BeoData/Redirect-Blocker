# Redirect Blocker: How I Built a Chrome Extension That Kills Ads Before They Load

*Published by Dejan Simic — [BeoData](https://beodata.rs)*

---

If you have ever clicked a perfectly normal-looking link and found yourself on AliExpress, Temu, or some aggressive ad network — congratulations, you have experienced an affiliate redirect. They are everywhere: in YouTube descriptions, blog posts, comparison sites, and forum comments. Most people don't even notice. I got tired of them.

This is the story of **Redirect Blocker**: a Chrome extension I built that intercepts those redirects before they ever load — silently, automatically, with zero clicks required.

---

## The Problem

Affiliate redirect links work by routing your click through a tracking domain before sending you to the final destination. The tracking domain records a commission for the person who embedded the link. That's fine in principle — but it has become wildly abused:

- **Pop-unders**: a new tab opens behind your current window with an ad page
- **Popup windows**: a `window.open()` call spawns a new browser window for an ad
- **Silent redirects**: a legitimate link secretly bounces you through `click.aliexpress.com` before reaching the product
- **Affiliate query strings**: URLs stuffed with `?aff_fcid=xxx&aff_platform=xxx&CPS_NORMAL` that track your click across sessions

None of these require any action from you. The browser just follows the redirect.

---

## The Solution: Intercept at the Earliest Possible Point

Chrome's extension APIs let you hook into navigation at several stages. I use all of them:

### 1. `webNavigation.onBeforeNavigate` — the earliest intercept

This fires before the browser makes any network request. If the URL matches my block-list, I remove the tab immediately. The user sees nothing — no flash, no blank page, no ad.

```js
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  if (shouldBlock(details.url)) {
    await chrome.tabs.remove(details.tabId);
  }
});
```

### 2. `tabs.onCreated` — catching pop-unders

Pop-unders open as new tabs (often via `window.open()`). `onCreated` fires the moment the tab is created, before the URL is available. I wait 100 ms (one tick) and then read the URL:

```js
chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(async () => {
    const fullTab = await chrome.tabs.get(tab.id);
    if (shouldBlock(fullTab.url)) {
      await chrome.tabs.remove(tab.id);
    }
  }, 100);
});
```

### 3. `tabs.onUpdated` — client-side redirects

Some sites do the redirect in JavaScript after the page loads. `onUpdated` fires every time the URL in a tab changes:

```js
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  setTimeout(async () => {
    const tab = await chrome.tabs.get(tabId);
    if (shouldBlock(tab.url)) await chrome.tabs.remove(tabId);
  }, 50);
});
```

### 4. `windows.onCreated` — popup windows

A few ad networks open a full `window.open()` popup instead of a tab. I catch those too:

```js
chrome.windows.onCreated.addListener((window) => {
  setTimeout(async () => {
    const tabs = await chrome.tabs.query({ windowId: window.id });
    if (tabs[0]?.url && shouldBlock(tabs[0].url)) {
      await chrome.windows.remove(window.id);
    }
  }, 50);
});
```

---

## The Matching Engine: Avoiding False Positives

The naive approach — `url.includes("af=")` — causes false positives immediately. A URL like `https://example.com/craft?craft=something` would match `raft=` if you're not careful.

I split the block-list into three typed arrays:

```
BLOCKED_DOMAINS        →  matched against hostname only
BLOCKED_QUERY_PARAMS   →  matched against query string (key= pattern)
BLOCKED_URL_FRAGMENTS  →  matched against full URL (long, unambiguous strings only)
```

And I parse the URL properly with the browser's own `URL` API:

```js
function shouldBlock(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Stage 1: exact hostname or subdomain match
  for (const domain of BLOCKED_DOMAINS) {
    if (hostname === domain || hostname.endsWith("." + domain)) return true;
  }

  // Stage 2: query parameter key match
  for (const param of BLOCKED_QUERY_PARAMS) {
    if (parsed.search.toLowerCase().includes(`${param}=`)) return true;
  }

  // Stage 3: unambiguous URL fragment match
  for (const fragment of BLOCKED_URL_FRAGMENTS) {
    if (url.toLowerCase().includes(fragment)) return true;
  }

  return false;
}
```

This completely eliminates the false positive problem that plagued version 1.0.

---

## Handling the Race Condition

Here's a subtle bug I fixed in v1.1: multiple event listeners can fire for the same tab at nearly the same time. For example, when a new tab opens with a blocked URL, both `onCreated` and `onBeforeNavigate` fire. Both call `chrome.tabs.remove()`. The second call throws a `No tab with id` error — which, while caught silently, wastes cycles and pollutes the log.

The fix is a `Set` that tracks tabs currently being closed:

```js
const pendingClose = new Set();

async function closeTab(tabId, url) {
  if (pendingClose.has(tabId)) return false;
  pendingClose.add(tabId);
  try {
    await chrome.tabs.remove(tabId);
  } finally {
    pendingClose.delete(tabId);
  }
}
```

Clean, cheap, effective.

---

## The Popup UI

The popup is intentionally minimal. It shows:

- **Total blocked count** — persisted in `chrome.storage.local`, survives browser restarts
- **Status badge** — pulsing green dot when active, static red when disabled
- **Toggle button** — pause protection without uninstalling
- **Reset button** — zero the counter

The UI uses the Inter font, a dark gradient background, and subtle CSS animations. The count display has a "bump" animation that plays whenever the number changes — a small detail that makes the interface feel alive.

---

## How to Install

Until the Chrome Web Store version is ready, install it as an unpacked extension:

1. Download the [latest release](https://github.com/beodata/redirect-blocker/releases) or clone the repo
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right corner)
4. Click **Load unpacked** and select the folder
5. Done — the shield icon appears in your toolbar

---

## What's Next

A few features I'm planning for future versions:

- **Custom block-list** — add your own domains or patterns directly from the popup
- **Per-site allowlist** — whitelist domains you trust so they're never blocked
- **Statistics page** — a full history of what was blocked and when
- **Chrome Web Store** — proper signed release for one-click install

---

## Open Source

Redirect Blocker is fully open source under the MIT license. The code is clean, well-commented, and structured to be easy to extend.

👉 [GitHub: beodata/redirect-blocker](https://github.com/beodata/redirect-blocker)

---

*Dejan Simic is the founder of [BeoData](https://beodata.rs), a Serbian digital tools studio focused on practical software for everyday users.*
