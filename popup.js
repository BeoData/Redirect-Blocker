/**
 * Redirect Blocker — popup script
 * Author: Dejan Simic | BeoData (beodata.rs)
 * License: MIT
 */

// ---------------------------------------------------------------------------
// DOM references (resolved once on load)
// ---------------------------------------------------------------------------
const countEl      = document.getElementById("count");
const toggleBtn    = document.getElementById("toggleBtn");
const toggleIcon   = document.getElementById("toggleIcon");
const toggleLabel  = document.getElementById("toggleLabel");
const statusBadge  = document.getElementById("statusBadge");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const resetBtn     = document.getElementById("resetBtn");
const manageBtn    = document.getElementById("manageBtn");

// ---------------------------------------------------------------------------
// UI update
// ---------------------------------------------------------------------------

/**
 * Fetches current status from the background worker and updates the UI.
 */
async function updateUI() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getStatus" });
    if (!response) return;

    const count     = response.blockedCount ?? 0;
    const enabled   = response.isEnabled !== false;

    // Update counter with bump animation
    const prevCount = parseInt(countEl.textContent, 10) || 0;
    countEl.textContent = count;
    if (count !== prevCount) {
      countEl.classList.add("bump");
      setTimeout(() => countEl.classList.remove("bump"), 200);
    }

    // Update toggle button
    if (enabled) {
      toggleBtn.className   = "btn btn-toggle";
      toggleIcon.textContent  = "🔴";
      toggleLabel.textContent = "Disable Protection";

      statusBadge.className   = "status-badge active";
      statusDot.className     = "status-dot pulse";
      statusText.textContent  = "Protection Active";
    } else {
      toggleBtn.className   = "btn btn-toggle off";
      toggleIcon.textContent  = "🟢";
      toggleLabel.textContent = "Enable Protection";

      statusBadge.className   = "status-badge inactive";
      statusDot.className     = "status-dot";
      statusText.textContent  = "Protection Disabled";
    }
  } catch (err) {
    console.warn("Redirect Blocker popup — communication error:", err);
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

toggleBtn.addEventListener("click", async () => {
  try {
    // Read current state, then flip it
    const response = await chrome.runtime.sendMessage({ action: "getStatus" });
    const newState = !(response?.isEnabled !== false);
    await chrome.runtime.sendMessage({ action: "toggle", enabled: newState });
    await updateUI();
  } catch (err) {
    console.warn("Toggle error:", err);
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ action: "reset" });
    await updateUI();
  } catch (err) {
    console.warn("Reset error:", err);
  }
});

manageBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});

// ---------------------------------------------------------------------------
// Init — run once on popup open (no polling interval needed)
// ---------------------------------------------------------------------------
updateUI();