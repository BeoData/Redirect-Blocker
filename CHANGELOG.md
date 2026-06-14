# Changelog

All notable changes to Redirect Blocker are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] — 2025-06-14

### Fixed
- **False positives eliminated** — short generic patterns (`af=`, `dp=`) removed; replaced with a structured three-stage matching engine (hostname → query-param key → URL fragment).
- **Race condition fixed** — `pendingClose` Set prevents two event listeners from both calling `chrome.tabs.remove()` on the same tab simultaneously.
- **`content.js` broken code removed** — all undefined `Ginny*` function references that caused `ReferenceError` on every page are removed.
- **Duplicate counter increments** — `webNavigation.onBeforeNavigate` no longer bypasses the shared `closeTab()` helper, preventing double-counting.

### Changed
- Block-list split into three typed arrays: `BLOCKED_DOMAINS`, `BLOCKED_QUERY_PARAMS`, `BLOCKED_URL_FRAGMENTS` for clarity and precision.
- Hostname matching uses `hostname === domain || hostname.endsWith("." + domain)` instead of `url.includes(domain)`.
- All log messages switched to English.
- Popup UI redesigned: Inter font, dark gradient theme, animated status badge, count bump animation.
- `setInterval(updateUI, 2000)` removed from popup (unnecessary — popup is closed-on-click).
- `manifest.json`: bumped to `1.1.0`, added `author`, `homepage_url`, icon declarations.

### Added
- `icons/` directory referenced in manifest (icon files to be placed by developer).
- `README.md` with full documentation.
- `CHANGELOG.md` (this file).
- `LICENSE` (MIT — Dejan Simic / BeoData).
- `.gitignore`.

---

## [1.0.0] — 2025-06-01

### Added
- Initial release.
- Pattern-based URL blocking using `chrome.tabs.onCreated`, `chrome.tabs.onUpdated`, `chrome.webNavigation.onBeforeNavigate`, `chrome.windows.onCreated`.
- Simple popup with blocked-count display and enable/disable toggle.
- Counter persisted in `chrome.storage.local`.
