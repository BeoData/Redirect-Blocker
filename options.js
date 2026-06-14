/**
 * Redirect Blocker — options page script
 * Author: Dejan Simic | BeoData (beodata.rs)
 * License: MIT
 */

// ---------------------------------------------------------------------------
// Built-in domain list (kept in sync with background.js BLOCKED_DOMAINS)
// Displayed read-only so users know what's already covered.
// ---------------------------------------------------------------------------
const BUILTIN_DOMAINS = [
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
  "propellerads.com",
];

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const domainInput  = document.getElementById("domainInput");
const addBtn       = document.getElementById("addBtn");
const customList   = document.getElementById("customList");
const emptyState   = document.getElementById("emptyState");
const customCount  = document.getElementById("customCount");
const toast        = document.getElementById("toast");
const builtinToggle = document.getElementById("builtinToggle");
const builtinList  = document.getElementById("builtinList");

// ---------------------------------------------------------------------------
// Domain normalisation
// Strips protocol, www, path and port so users can paste full URLs or just
// domain names — the result is always a clean hostname like "example.com".
// ---------------------------------------------------------------------------
function normalizeDomain(raw) {
  let s = raw.trim().toLowerCase();
  // Remove protocol (http://, https://)
  s = s.replace(/^https?:\/\//, "");
  // Remove www. prefix
  s = s.replace(/^www\./, "");
  // Keep only the host part (strip path, query, fragment)
  s = s.split("/")[0].split("?")[0].split("#")[0];
  // Remove port
  s = s.split(":")[0];
  return s;
}

// Returns true if the string looks like a valid domain.
function isValidDomain(domain) {
  // Must contain at least one dot and no spaces or illegal chars.
  return /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/.test(domain) && domain.includes(".");
}

// ---------------------------------------------------------------------------
// Toast notifications (auto-hide after 3 s)
// ---------------------------------------------------------------------------
let toastTimer = null;

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

// ---------------------------------------------------------------------------
// Render the custom domain list
// ---------------------------------------------------------------------------
function renderCustomList(domains) {
  // Remove all existing domain items (keep emptyState)
  Array.from(customList.querySelectorAll(".domain-item")).forEach((el) => el.remove());

  customCount.textContent = domains.length;

  if (domains.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  domains.forEach((domain) => {
    const item = document.createElement("div");
    item.className = "domain-item";
    item.dataset.domain = domain;

    const nameEl = document.createElement("span");
    nameEl.className = "domain-name";
    nameEl.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeDomain(domain));

    item.appendChild(nameEl);
    item.appendChild(removeBtn);
    customList.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Render the built-in domain list (read-only tags)
// ---------------------------------------------------------------------------
function renderBuiltinList() {
  BUILTIN_DOMAINS.forEach((domain) => {
    const tag = document.createElement("span");
    tag.className = "builtin-tag";
    tag.textContent = domain;
    builtinList.appendChild(tag);
  });
}

// ---------------------------------------------------------------------------
// Load from storage and render
// ---------------------------------------------------------------------------
function loadAndRender() {
  chrome.storage.local.get(["customDomains"], (result) => {
    const domains = result.customDomains || [];
    renderCustomList(domains);
  });
}

// ---------------------------------------------------------------------------
// Add domain
// ---------------------------------------------------------------------------
function addDomain() {
  const raw = domainInput.value;
  const domain = normalizeDomain(raw);

  if (!domain) {
    showToast("Please enter a domain.", "error");
    return;
  }

  if (!isValidDomain(domain)) {
    showToast(`"${domain}" doesn't look like a valid domain.`, "error");
    return;
  }

  chrome.storage.local.get(["customDomains"], (result) => {
    const domains = result.customDomains || [];

    if (BUILTIN_DOMAINS.includes(domain)) {
      showToast(`"${domain}" is already in the built-in block list.`, "error");
      return;
    }

    if (domains.includes(domain)) {
      showToast(`"${domain}" is already in your list.`, "error");
      return;
    }

    const updated = [...domains, domain];
    chrome.storage.local.set({ customDomains: updated }, () => {
      domainInput.value = "";
      renderCustomList(updated);
      showToast(`✅ "${domain}" added to your block list.`);
    });
  });
}

// ---------------------------------------------------------------------------
// Remove domain
// ---------------------------------------------------------------------------
function removeDomain(domain) {
  chrome.storage.local.get(["customDomains"], (result) => {
    const domains = result.customDomains || [];
    const updated = domains.filter((d) => d !== domain);
    chrome.storage.local.set({ customDomains: updated }, () => {
      renderCustomList(updated);
      showToast(`"${domain}" removed.`);
    });
  });
}

// ---------------------------------------------------------------------------
// Built-in toggle
// ---------------------------------------------------------------------------
builtinToggle.addEventListener("click", () => {
  const isOpen = builtinList.classList.contains("visible");
  builtinList.classList.toggle("visible", !isOpen);
  builtinToggle.classList.toggle("open", !isOpen);
  builtinToggle.querySelector("span:last-child").textContent = isOpen
    ? "Show built-in list"
    : "Hide built-in list";
});

// ---------------------------------------------------------------------------
// Add button + Enter key
// ---------------------------------------------------------------------------
addBtn.addEventListener("click", addDomain);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
renderBuiltinList();
loadAndRender();
