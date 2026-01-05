// ------------------------------
// Fullscreen dashboard + filter modal
// DST-correct via Intl IANA zones
// FIX: Per-timezone "next New Year" (no year chooser)
// FIX: Show "Happy New Year" for the whole Jan 1 in that timezone,
//      then countdown to next year's Jan 1.
// Fireworks remain 10 minutes (FIREWORKS_DURATION_MS).
// ------------------------------
const FIREWORKS_DURATION_MS = 600_000; // 10 minute

const DEFAULT_ZONES = [
  { label: "Hawaii, USA (HST)", tz: "Pacific/Honolulu" },
  { label: "Alaska, USA (AKST/AKDT)", tz: "America/Anchorage" },
  { label: "Pacific, USA (PST/PDT)", tz: "America/Los_Angeles" },
  { label: "Mountain, USA (MST/MDT)", tz: "America/Denver" },
  { label: "Central, USA (CST/CDT)", tz: "America/Chicago" },
  { label: "Eastern, USA (EST/EDT)", tz: "America/New_York" },
  { label: "Atlantic, Canada (AST/ADT)", tz: "America/Halifax" },
  { label: "UTC (Coordinated Universal Time)", tz: "UTC" },
  { label: "India (IST)", tz: "Asia/Kolkata" }
];

// Picklist for the multi-select (deduped by tz)
const PICKLIST = [
  ...DEFAULT_ZONES,
  { label: "Singapore", tz: "Asia/Singapore" },
  { label: "Hong Kong", tz: "Asia/Hong_Kong" },
  { label: "Shanghai, China", tz: "Asia/Shanghai" },
  { label: "Seoul, South Korea", tz: "Asia/Seoul" },
  { label: "Bangkok, Thailand", tz: "Asia/Bangkok" },
  { label: "Jakarta, Indonesia", tz: "Asia/Jakarta" },
  { label: "Karachi, Pakistan", tz: "Asia/Karachi" },
  { label: "Kathmandu, Nepal", tz: "Asia/Kathmandu" },
  { label: "Tehran, Iran", tz: "Asia/Tehran" },
  { label: "Moscow, Russia", tz: "Europe/Moscow" },
  { label: "Berlin, Germany", tz: "Europe/Berlin" },
  { label: "Rome, Italy", tz: "Europe/Rome" },
  { label: "Madrid, Spain", tz: "Europe/Madrid" },
  { label: "Cairo, Egypt", tz: "Africa/Cairo" },
  { label: "Nairobi, Kenya", tz: "Africa/Nairobi" },
  { label: "Johannesburg, South Africa", tz: "Africa/Johannesburg" },
  { label: "São Paulo, Brazil", tz: "America/Sao_Paulo" },
  { label: "Buenos Aires, Argentina", tz: "America/Argentina/Buenos_Aires" },
  { label: "Mexico City, Mexico", tz: "America/Mexico_City" },
  { label: "Toronto, Canada", tz: "America/Toronto" },
  { label: "Vancouver, Canada", tz: "America/Vancouver" },
  { label: "Auckland, New Zealand", tz: "Pacific/Auckland" }
];

// DOM
// (NOTE: year chooser removed — no yearInput used)
const searchInput = document.getElementById("search");
const tzSelect = document.getElementById("tzSelect");
const addSelectedBtn = document.getElementById("addSelected");
const addCustomBtn = document.getElementById("addCustom");
const customTzInput = document.getElementById("customTz");
const chipWrap = document.getElementById("chipWrap");
const tbody = document.getElementById("countdownTable");
const sortSoonest = document.getElementById("sortSoonest");
const pinBrowser = document.getElementById("pinBrowser");
const browserTzEl = document.getElementById("browserTz");
const browserNowEl = document.getElementById("browserNow");
const toastEl = document.getElementById("toast");

const openFiltersBtn = document.getElementById("openFilters");
const closeFiltersBtn = document.getElementById("closeFilters");
const doneFiltersBtn = document.getElementById("doneFilters");
const filterModal = document.getElementById("filterModal");
const modalBackdrop = document.getElementById("modalBackdrop");

const celebrationOverlay = document.getElementById("celebration-overlay");
const celebrateSubtitle = document.getElementById("celebrate-subtitle");

// Browser timezone
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
browserTzEl.textContent = BROWSER_TZ;

// State
let mode = "all"; // "all" = defaults + selected, "selected" = only selected
const selectedZones = new Map(); // tz -> label (user-selected)

// For detecting entry into Jan 1 (midnight) per timezone
const lastIsJan1 = new Map(); // tz -> boolean

// Fireworks
let fireworks = null;
let fireworksTimer = null;

function ensureFireworks() {
  if (fireworks) return fireworks;
  const container = document.getElementById("fireworks-overlay");

  const Ctor =
    window.Fireworks && window.Fireworks.default
      ? window.Fireworks.default
      : window.Fireworks;
  if (!Ctor) return null;

  fireworks = new Ctor(container, {
    autoresize: true,
    opacity: 0.7,
    particles: 130,
    traceLength: 3,
    traceSpeed: 6,
    explosion: 6,
    intensity: 45,
    gravity: 1.2,
    friction: 0.98,
    acceleration: 1.04,
    hue: { min: 0, max: 360 },
    delay: { min: 12, max: 22 },
    rocketsPoint: { min: 20, max: 80 },
    sound: { enabled: false }
  });

  return fireworks;
}

function celebrateNow(message) {
  // fireworks burst
  const fw = ensureFireworks();
  if (fw) {
    try {
      fw.start();
    } catch (_) {}
    clearTimeout(fireworksTimer);
    fireworksTimer = setTimeout(() => {
      try {
        fw.stop();
      } catch (_) {}
      try {
        fw.clear && fw.clear();
      } catch (_) {}
    }, FIREWORKS_DURATION_MS);
  }

  // overlay message
  celebrateSubtitle.textContent = message;
  celebrationOverlay.classList.remove("hidden");
  celebrationOverlay.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    celebrationOverlay.classList.add("hidden");
    celebrationOverlay.setAttribute("aria-hidden", "true");
  }, 2200);
}

// Utilities
const pad2 = (n) => String(n).padStart(2, "0");

function showToast(msg, kind = "info") {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastEl.style.borderColor =
    kind === "ok"
      ? "rgba(120,255,170,.35)"
      : kind === "err"
      ? "rgba(255,120,120,.35)"
      : "rgba(255,255,255,.16)";

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch (e) {
    return false;
  }
}

function formatNowInZone(timeZone, date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

function getLocalParts(timeZone, utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: +m.year,
    month: +m.month, // 1..12
    day: +m.day, // 1..31
    hour: +m.hour,
    minute: +m.minute,
    second: +m.second
  };
}

function getOffsetMinutes(timeZone, utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const wallAsUtc = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour,
    +m.minute,
    +m.second
  );
  return (wallAsUtc - utcMs) / 60000;
}

// Convert local wall time in a timezone -> UTC ms (DST-correct)
function zonedToUtcMs({
  year,
  monthIndex,
  day,
  hour,
  minute,
  second,
  timeZone
}) {
  let guess = Date.UTC(year, monthIndex, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const offMin = getOffsetMinutes(timeZone, guess);
    const next =
      Date.UTC(year, monthIndex, day, hour, minute, second) - offMin * 60000;
    if (Math.abs(next - guess) < 1000) return next;
    guess = next;
  }
  return guess;
}

// Friendly region label fallback from IANA TZ (if user adds custom)
function humanizeTz(tz) {
  if (tz === "UTC") return "UTC (Global)";
  const parts = tz.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  const region = parts[0].replace(/_/g, " ");
  return `${city} (${region})`;
}

function barStyle(pct) {
  const t = Math.max(0, Math.min(1, pct / 100));

  let hue, sat, light;

  if (t < 0.5) {
    const k = t / 0.5; // 0..1
    hue = 55; // yellow
    sat = 10 + 70 * k; // 10% -> 80%
    light = 92 - 18 * k; // 92% -> 74%
  } else {
    const k = (t - 0.5) / 0.5; // 0..1
    hue = 55 + (120 - 55) * k; // yellow -> green
    sat = 80;
    light = 74 - 10 * k; // 74% -> 64%
  }

  const c1 = `hsla(${hue}, ${sat}%, ${light}%, 0.35)`;
  const c2 = `hsla(${hue}, ${sat}%, ${Math.max(45, light - 10)}%, 0.95)`;
  const glow = `0 0 12px hsla(${hue}, ${sat}%, ${light}%, 0.28)`;

  return `width:${pct}%; background: linear-gradient(90deg, ${c1}, ${c2}); box-shadow:${glow};`;
}

// Dedupe picklist
const picklistUnique = (() => {
  const seen = new Set();
  const out = [];
  for (const z of PICKLIST) {
    if (!seen.has(z.tz)) {
      seen.add(z.tz);
      out.push(z);
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
})();

function renderPicklist(filterText = "") {
  const q = filterText.trim().toLowerCase();
  tzSelect.innerHTML = "";
  for (const z of picklistUnique) {
    const hay = `${z.label} ${z.tz}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    const opt = document.createElement("option");
    opt.value = z.tz;
    opt.textContent = `${z.label} — ${z.tz}`;
    tzSelect.appendChild(opt);
  }
}

// displayed zones = defaults + selected + optional browser, deduped by tz
function getDisplayedZones() {
  const map = new Map(); // tz -> label

  if (mode === "all") {
    for (const z of DEFAULT_ZONES) map.set(z.tz, z.label);
  }
  for (const [tz, label] of selectedZones.entries()) map.set(tz, label);

  if (pinBrowser.checked && isValidTimeZone(BROWSER_TZ)) {
    if (!map.has(BROWSER_TZ)) map.set(BROWSER_TZ, "My timezone");
  }

  return [...map.entries()].map(([tz, label]) => ({ tz, label }));
}

function renderChips() {
  const zones = getDisplayedZones();
  chipWrap.innerHTML = "";

  zones.forEach(({ tz, label }) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span><b>${label}</b> <small>${tz}</small></span>
      <button title="Remove">×</button>
    `;

    chip.querySelector("button").addEventListener("click", () => {
      if (selectedZones.has(tz)) {
        selectedZones.delete(tz);
        showToast(`Removed ${label}`, "ok");
      } else if (tz === BROWSER_TZ && pinBrowser.checked) {
        pinBrowser.checked = false;
        showToast(`Unpinned your timezone`, "ok");
      } else {
        showToast(
          `Default zone can't be removed (switch to selected-only mode).`,
          "info"
        );
      }
      updateAll();
    });

    chipWrap.appendChild(chip);
  });
}

function updateCountdown() {
  const now = Date.now();
  browserNowEl.textContent = formatNowInZone(BROWSER_TZ, new Date(now));

  const rows = [];
  const zones = getDisplayedZones();

  for (const z of zones) {
    const tz = z.tz;

    const lp = getLocalParts(tz, now);

    // Celebration is the whole local Jan 1
    const isJan1 = lp.month === 1 && lp.day === 1;

    // Fireworks when entering Jan 1 (midnight) only
    const prevIsJan1 = lastIsJan1.get(tz);
    const enteredJan1 = prevIsJan1 === false && isJan1;

    if (prevIsJan1 === undefined) {
      // first render: don't trigger fireworks even if already Jan 1
      lastIsJan1.set(tz, isJan1);
    } else {
      lastIsJan1.set(tz, isJan1);
      if (enteredJan1) {
        celebrateNow(`It’s midnight in ${z.label} — Happy New Year!`);
      }
    }

    // Target is next year's Jan 1 in that timezone (always in the future)
    const targetYear = lp.year + 1;

    const targetUtcMs = zonedToUtcMs({
      year: targetYear,
      monthIndex: 0,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: tz
    });

    const timeLeft = targetUtcMs - now;

    rows.push({ ...z, tz, now, timeLeft, isJan1 });
  }

  if (sortSoonest.checked) {
    rows.sort((a, b) => {
      // Put celebrating zones first
      const aKey = a.isJan1 ? -1 : a.timeLeft;
      const bKey = b.isJan1 ? -1 : b.timeLeft;
      return aKey - bKey;
    });
  }

  tbody.innerHTML = "";

  for (const r of rows) {
    const currentTime = formatNowInZone(r.tz, new Date(r.now));

    let countdownHTML = "";
    if (r.isJan1) {
      countdownHTML = `<span class="newyear">🎉 Happy New Year, ${r.label}! 🎉</span>`;
    } else {
      const days = Math.floor(r.timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((r.timeLeft / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((r.timeLeft / (1000 * 60)) % 60);
      const seconds = Math.floor((r.timeLeft / 1000) % 60);

      const oneDay = 24 * 60 * 60 * 1000; // 1 day window => 100% at midnight
      const urgency = Math.max(0, Math.min(1, 1 - r.timeLeft / oneDay));
      const pct = Math.round(urgency * 100);

      countdownHTML = `
        <div class="parts mono">
          <span class="part"><span class="num">${pad2(
            days
          )}</span><span class="unit">days</span></span>
          <span class="part"><span class="num">${pad2(
            hours
          )}</span><span class="unit">hrs</span></span>
          <span class="part"><span class="num">${pad2(
            minutes
          )}</span><span class="unit">min</span></span>
          <span class="part"><span class="num">${pad2(
            seconds
          )}</span><span class="unit">sec</span></span>
        </div>
        <div class="progress" title="Urgency (fills in last 24h)">
          <div class="bar" style="${barStyle(pct)}"></div>
        </div>
      `;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge">${r.label}</span></td>
      <td class="muted">${r.tz}</td>
      <td class="muted mono">${currentTime}</td>
      <td class="countdown-cell">${countdownHTML}</td>
    `;
    tbody.appendChild(tr);
  }
}

function addZone(tz, label) {
  tz = (tz || "").trim();
  if (!tz) return;

  if (!isValidTimeZone(tz)) {
    showToast(`Invalid timezone: ${tz}`, "err");
    return;
  }

  const niceLabel = label?.trim() || humanizeTz(tz);

  if (!selectedZones.has(tz)) {
    selectedZones.set(tz, niceLabel);
    showToast(`Added ${niceLabel}`, "ok");
  } else {
    showToast(`Already added: ${niceLabel}`, "info");
  }

  updateAll();
}

function addSelected() {
  const values = [...tzSelect.selectedOptions].map((o) => o.value);
  if (!values.length) {
    showToast("Select one or more timezones first.", "info");
    return;
  }
  for (const tz of values) {
    const match = picklistUnique.find((x) => x.tz === tz);
    addZone(tz, match?.label || humanizeTz(tz));
  }
}

function updateAll() {
  renderChips();
  updateCountdown();
}

// Modal show/hide
function openModal() {
  filterModal.classList.remove("hidden");
  filterModal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  filterModal.classList.add("hidden");
  filterModal.setAttribute("aria-hidden", "true");
}
openFiltersBtn.addEventListener("click", openModal);
closeFiltersBtn.addEventListener("click", closeModal);
doneFiltersBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !filterModal.classList.contains("hidden"))
    closeModal();
});

// Wiring
renderPicklist("");
searchInput.addEventListener("input", () => renderPicklist(searchInput.value));
addSelectedBtn.addEventListener("click", addSelected);

addCustomBtn.addEventListener("click", () => addZone(customTzInput.value, ""));
customTzInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addZone(customTzInput.value, "");
});

document.getElementById("showSelectedOnly").addEventListener("click", () => {
  mode = "selected";
  showToast("Showing selected only.", "ok");
  updateAll();
});

document.getElementById("showAll").addEventListener("click", () => {
  mode = "all";
  showToast("Showing defaults + selected.", "ok");
  updateAll();
});

sortSoonest.addEventListener("change", updateAll);
pinBrowser.addEventListener("change", updateAll);

// Init
if (!isValidTimeZone(BROWSER_TZ)) {
  showToast("Browser timezone not detected — falling back to UTC.", "err");
}

setInterval(updateCountdown, 1000);
updateAll();
