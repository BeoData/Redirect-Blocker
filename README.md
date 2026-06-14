# Redirect Blocker

> **A Chrome extension that silently kills unwanted redirects, ad popups, and affiliate tracking links — before they load.**

[![Version](https://img.shields.io/badge/version-1.1.0-16c79a?style=flat-square)](https://github.com/beodata/redirect-blocker/releases)
[![License](https://img.shields.io/badge/license-MIT-4cc9f0?style=flat-square)](LICENSE)
[![Manifest](https://img.shields.io/badge/manifest-v3-orange?style=flat-square)](manifest.json)
[![Made by BeoData](https://img.shields.io/badge/made%20by-BeoData-0f3460?style=flat-square)](https://beodata.rs)

---

## ✨ What it does

Redirect Blocker intercepts browser navigation at three distinct points to catch redirects before they can display:

| Intercept point | What is blocked |
|---|---|
| `onBeforeNavigate` | Stops the page load before the browser even requests it |
| `tabs.onCreated` | Closes tab-based pop-unders immediately after they open |
| `windows.onCreated` | Closes popup windows before they render |

The extension maintains a live counter of everything it has blocked, visible in the toolbar popup.

---

## 🚫 What gets blocked

### Ad networks & tracking domains
- Google Ad Services (`googleadservices.com`, `googlesyndication.com`, `doubleclick.net`)
- Programmatic ad networks: `adnxs.com`, `adsrvr.org`, `adsterra.com`, `propellerads.com`, `exoclick.com`, `trafficjunky.net`, `popads.net`

### Marketplace redirect domains
- AliExpress affiliate redirects (`click.aliexpress.com`, `s.click.aliexpress.com`)
- Temu, Wish, Amazon AE, Rakuten

### Affiliate query parameters
- `aff_fcid=`, `aff_trace_key=`, `aff_platform=`, `aff_ab=`, `aff_sid=`, `af_sub=`, `CPS_NORMAL`

### URL patterns
- `popunder` in any URL
- `?aff=` and `&aff=` query strings

> **Note:** The matching engine uses structured three-stage checks (hostname → query params → URL fragments) to minimise false positives. Short ambiguous patterns (like `af=`) are no longer matched against full URLs.

---

## 🛠 Installation (Developer / Unpacked)

> The extension is not yet published to the Chrome Web Store. Install it manually in a few steps.

1. Download or clone this repository:
   ```bash
   git clone https://github.com/beodata/redirect-blocker.git
   ```
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the folder containing `manifest.json`

The shield icon appears in your Chrome toolbar immediately.

---

## 🖥 Popup UI

Click the toolbar icon to open the popup:

- **Counter** — total number of redirects blocked since install (persisted across restarts)
- **Enable / Disable button** — temporarily pause the extension without uninstalling it
- **Reset counter** — zeroes the counter without disabling protection

---

## 📁 Project structure

```
redirect-blocker/
├── manifest.json        # Extension manifest (MV3)
├── background.js        # Service worker — all blocking logic
├── content.js           # Content script (minimal — ping only)
├── popup.html           # Toolbar popup UI
├── popup.js             # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## ⚙️ How it works (technical)

The extension runs as a **Manifest V3 service worker** and uses four Chrome APIs:

```
chrome.webNavigation.onBeforeNavigate  →  earliest possible intercept
chrome.tabs.onCreated                  →  catches tab-based pop-unders
chrome.tabs.onUpdated                  →  catches client-side redirects
chrome.windows.onCreated               →  catches popup windows
```

A `Set<tabId>` (`pendingClose`) prevents the race condition where multiple events fire for the same tab and both attempt `chrome.tabs.remove()` on an already-removed tab.

All state (enabled flag + counter) is persisted in `chrome.storage.local` so it survives the service worker being suspended by Chrome.

---

## 🔒 Permissions explained

| Permission | Reason |
|---|---|
| `tabs` | Read tab URLs and close tabs |
| `windows` | Detect and close popup windows |
| `storage` | Persist counter and enabled state |
| `webNavigation` | Intercept navigation before it loads |
| `<all_urls>` | Inspect URLs on all sites |

The extension does **not** read page content, collect data, or make any network requests.

---

## 🗺 Roadmap

- [ ] Custom user-defined block list (editable from popup)
- [ ] Per-site allowlist (whitelist domains you trust)
- [ ] Chrome Web Store publication
- [ ] Export/import block list as JSON

---

## 👤 Author

**Dejan Simic**  
[BeoData](https://beodata.rs) — Digital tools made in Serbia 🇷🇸

---

## 📄 License

MIT © 2025 Dejan Simic / BeoData. See [LICENSE](LICENSE) for full text.
