 
// =======================
// CONSTANTS
// =======================
const FIREWORKS_DURATION_MS = 600_000;

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

// =======================
// DOM
// =======================
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

// =======================
// STATE
// =======================
const BROWSER_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
browserTzEl.textContent = BROWSER_TZ;

let mode = "all";                       // "all" | "selected"
const selectedZones = new Map();        // tz -> label
const lastIsJan1 = new Map();           // tz -> boolean
let fireworks = null;
let fireworksTimer = null;

// =======================
// UTILITIES
// =======================
const pad2 = (n) => String(n).padStart(2, "0");

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function toast(msg, kind = "info") {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastEl.style.borderColor =
    kind === "ok"
      ? "rgba(120,255,170,.35)"
      : kind === "err"
      ? "rgba(255,120,120,.35)"
      : "rgba(255,255,255,.16)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
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
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
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
  const m = Object.fromEntries(
    dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
  );
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
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
  const m = Object.fromEntries(
    dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
  );
  const wallUtc = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour,
    +m.minute,
    +m.second
  );
  return (wallUtc - utcMs) / 60000;
}

function zonedToUtcMs({ year, monthIndex, day, hour, minute, second, timeZone }) {
  let guess = Date.UTC(year, monthIndex, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const off = getOffsetMinutes(timeZone, guess);
    const next =
      Date.UTC(year, monthIndex, day, hour, minute, second) - off * 60000;
    if (Math.abs(next - guess) < 1000) return next;
    guess = next;
  }
  return guess;
}

function humanizeTz(tz) {
  if (tz === "UTC") return "UTC (Global)";
  const parts = tz.split("/");
  return `${parts.pop().replace(/_/g, " ")} (${parts[0].replace(/_/g, " ")})`;
}

function barStyle(percent) {
  const t = Math.max(0, Math.min(1, percent / 100));
  let hue, sat, light;
  if (t < 0.5) {
    const k = t / 0.5;
    hue = 55;
    sat = 10 + 70 * k;
    light = 92 - 18 * k;
  } else {
    const k = (t - 0.5) / 0.5;
    hue = 55 + (120 - 55) * k;
    sat = 80;
    light = 74 - 10 * k;
  }
  const c1 = `hsla(${hue},${sat}%,${light}%,0.35)`;
  const c2 = `hsla(${hue},${sat}%,${Math.max(45, light - 10)}%,0.95)`;
  const glow = `0 0 12px hsla(${hue},${sat}%,${light}%,0.28)`;
  return `width:${percent}%;background:linear-gradient(90deg,${c1},${c2});box-shadow:${glow};`;
}

// =======================
// PICKLIST
// =======================
const picklistUnique = (() => {
  const seen = new Set();
  return PICKLIST.filter((z) => !seen.has(z.tz) && seen.add(z.tz)).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
})();

function renderPicklist(filter = "") {
  const q = filter.trim().toLowerCase();
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

// =======================
// CELEBRATION
// =======================
function ensureFireworks() {
  if (fireworks) return fireworks;

  const container = document.getElementById("fireworks-overlay");
  const Ctor =
    (window.Fireworks && window.Fireworks.default) || window.Fireworks;
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
  const fw = ensureFireworks();
  if (fw) {
    try { fw.start(); } catch {}
    clearTimeout(fireworksTimer);
    fireworksTimer = setTimeout(() => {
      try { fw.stop(); } catch {}
      try { fw.clear && fw.clear(); } catch {}
    }, FIREWORKS_DURATION_MS);
  }

  celebrateSubtitle.textContent = message;
  celebrationOverlay.classList.remove("hidden");
  celebrationOverlay.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    celebrationOverlay.classList.add("hidden");
    celebrationOverlay.setAttribute("aria-hidden", "true");
  }, 2200);
}

// =======================
// CORE DATA VIEWS
// =======================
function getDisplayedZones() {
  const map = new Map();

  if (mode === "all") for (const z of DEFAULT_ZONES) map.set(z.tz, z.label);
  for (const [tz, label] of selectedZones) map.set(tz, label);

  if (pinBrowser.checked && isValidTimeZone(BROWSER_TZ) && !map.has(BROWSER_TZ))
    map.set(BROWSER_TZ, "My timezone");

  return [...map.entries()].map(([tz, label]) => ({ tz, label }));
}

// =======================
// RENDERING
// =======================
function renderChips() {
  chipWrap.innerHTML = "";
  for (const { tz, label } of getDisplayedZones()) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span><b>${label}</b> <small>${tz}</small></span>
      <button title="Remove">×</button>
    `;
    chip.querySelector("button").addEventListener("click", () => {
      if (selectedZones.has(tz)) {
        selectedZones.delete(tz);
        toast(`Removed ${label}`, "ok");
      } else if (tz === BROWSER_TZ && pinBrowser.checked) {
        pinBrowser.checked = false;
        toast("Unpinned your timezone", "ok");
      } else {
        toast("Default zone can't be removed (switch to selected-only mode).", "info");
      }
      updateAll();
    });
    chipWrap.appendChild(chip);
  }
}

function updateCountdown() {
  const now = Date.now();
  browserNowEl.textContent = formatNowInZone(BROWSER_TZ, new Date(now));
  const zones = getDisplayedZones();
  const rows = [];

  for (const z of zones) {
    const lp = getLocalParts(z.tz, now);
    const isJan1 = lp.month === 1 && lp.day === 1;
    const prev = lastIsJan1.get(z.tz);

    if (prev === undefined) {
      lastIsJan1.set(z.tz, isJan1);
    } else {
      lastIsJan1.set(z.tz, isJan1);
      if (prev === false && isJan1)
        celebrateNow(`It’s midnight in ${z.label} — Happy New Year!`);
    }

    const targetUtc = zonedToUtcMs({
      year: lp.year + 1,
      monthIndex: 0,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: z.tz
    });

    rows.push({
      ...z,
      now,
      isJan1,
      timeLeft: targetUtc - now
    });
  }

  if (sortSoonest.checked) {
    rows.sort((a, b) => {
      const aKey = a.isJan1 ? -1 : a.timeLeft;
      const bKey = b.isJan1 ? -1 : b.timeLeft;
      return aKey - bKey;
    });
  }

  tbody.innerHTML = "";
  for (const r of rows) {
    const current = formatNowInZone(r.tz, new Date(r.now));
    let content = "";

    if (r.isJan1) {
      content = `<span class="newyear">🎉 Happy New Year, ${r.label}! 🎉</span>`;
    } else {
      const days = Math.floor(r.timeLeft / 86400000);
      const hours = Math.floor((r.timeLeft / 3600000) % 24);
      const mins = Math.floor((r.timeLeft / 60000) % 60);
      const secs = Math.floor((r.timeLeft / 1000) % 60);
      const pct = Math.round(
        Math.max(0, Math.min(1, 1 - r.timeLeft / 86400000)) * 100
      );

      content = `
        <div class="parts mono">
          <span class="part"><span class="num">${pad2(days)}</span><span class="unit">days</span></span>
          <span class="part"><span class="num">${pad2(hours)}</span><span class="unit">hrs</span></span>
          <span class="part"><span class="num">${pad2(mins)}</span><span class="unit">min</span></span>
          <span class="part"><span class="num">${pad2(secs)}</span><span class="unit">sec</span></span>
        </div>
        <div class="progress" title="Urgency (fills in last 24h)">
          <div class="bar" style="${barStyle(pct)}"></div>
        </div>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge">${r.label}</span></td>
      <td class="muted">${r.tz}</td>
      <td class="muted mono">${current}</td>
      <td class="countdown-cell">${content}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Single refresh entry point
function updateAll() {
  renderChips();
  updateCountdown();
}

// =======================
// ACTIONS
// =======================
function addZone(tz, label) {
  tz = (tz || "").trim();
  if (!tz) return;

  if (!isValidTimeZone(tz)) {
    toast(`Invalid timezone: ${tz}`, "err");
    return;
  }

  const nice = label?.trim() || humanizeTz(tz);
  if (!selectedZones.has(tz)) {
    selectedZones.set(tz, nice);
    toast(`Added ${nice}`, "ok");
  } else {
    toast(`Already added: ${nice}`, "info");
  }

  updateAll();
}

function addSelected() {
  const values = [...tzSelect.selectedOptions].map((o) => o.value);
  if (!values.length) return toast("Select one or more timezones first.", "info");

  for (const tz of values) {
    const match = picklistUnique.find((x) => x.tz === tz);
    addZone(tz, match?.label || humanizeTz(tz));
  }
}

// =======================
// MODAL
// =======================
function openModal() {
  filterModal.classList.remove("hidden");
  filterModal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  filterModal.classList.add("hidden");
  filterModal.setAttribute("aria-hidden", "true");
}

// =======================
// EVENTS
// =======================
renderPicklist("");
searchInput.addEventListener("input", () => renderPicklist(searchInput.value));
addSelectedBtn.addEventListener("click", addSelected);

addCustomBtn.addEventListener("click", () => addZone(customTzInput.value, ""));
customTzInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addZone(customTzInput.value, "");
});

document.getElementById("showSelectedOnly").addEventListener("click", () => {
  mode = "selected";
  toast("Showing selected only.", "ok");
  updateAll();
});

document.getElementById("showAll").addEventListener("click", () => {
  mode = "all";
  toast("Showing defaults + selected.", "ok");
  updateAll();
});

sortSoonest.addEventListener("change", updateAll);
pinBrowser.addEventListener("change", updateAll);

openFiltersBtn.addEventListener("click", openModal);
closeFiltersBtn.addEventListener("click", closeModal);
doneFiltersBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !filterModal.classList.contains("hidden"))
    closeModal();
});

// =======================
// INIT
// =======================
if (!isValidTimeZone(BROWSER_TZ)) {
  toast("Browser timezone not detected — falling back to UTC.", "err");
}

setInterval(updateCountdown, 1000);
updateAll();
 
