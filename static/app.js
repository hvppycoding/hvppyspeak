/* v3.1.2: 1/3 & 2/3 layout, tracking overlay, color controls, theme toggle, mobile API fixes */
const $ = (sel) => document.querySelector(sel);

const tapArea = $("#tapArea");
const coverEl = $("#cover");
const enAnsEl = $("#englishAnswer");
const koEl = $("#korean");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const posEl = $("#pos");
const totalEl = $("#total");
const shuffleBtn = $("#shuffleBtn");
const noticeEl = $("#notice");

const settingsBtn = $("#settingsBtn");
const settingsSheet = $("#settingsSheet");
const v_bg = $("#v_bg");
const v_fg = $("#v_fg");
const v_muted = $("#v_muted");
const v_accent = $("#v_accent");
const v_accent_fg = $("#v_accent_fg");
const v_silhouette = $("#v_silhouette");
const v_block_x = $("#v_block_x");
const v_block_y = $("#v_block_y");
const settingsSave = $("#settingsSave");
const settingsReset = $("#settingsReset");
const settingsClose = $("#settingsClose");

let cards = [];
let idx = 0;

// Global debounce timer (avoid TDZ)
var resizeTimer = null;

function saveLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
function loadLocal(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; } }

/* ---------- Color & variable controls ---------- */
const VARS = ["--bg","--fg","--muted","--accent","--accent-fg","--silhouette","--block-expand-x","--block-expand-y"];
function getVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function setVar(name, val) { document.documentElement.style.setProperty(name, val); }

function openSettings() {
  v_bg.value = toColor(getVar("--bg"));
  v_fg.value = toColor(getVar("--fg"));
  v_muted.value = toColor(getVar("--muted"));
  v_accent.value = toColor(getVar("--accent"));
  v_accent_fg.value = toColor(getVar("--accent-fg"));
  v_silhouette.value = toColor(getVar("--silhouette"));
  v_block_x.value = parseFloat(getVar("--block-expand-x")) || 3;
  v_block_y.value = parseFloat(getVar("--block-expand-y")) || 0.05;
  settingsSheet.hidden = false;
}
function toColor(value) {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = value || "#000000";
  return ctx.fillStyle;
}
function saveSettings() {
  const kv = {
    "--bg": v_bg.value, "--fg": v_fg.value, "--muted": v_muted.value,
    "--accent": v_accent.value, "--accent-fg": v_accent_fg.value,
    "--silhouette": v_silhouette.value,
    "--block-expand-x": String(parseFloat(v_block_x.value) || 0),
    "--block-expand-y": String(parseFloat(v_block_y.value) || 0),
  };
  for (const [k, val] of Object.entries(kv)) setVar(k, val);
  saveLocal("themeVars", kv);
  settingsSheet.hidden = true;
  scheduleRelayout();
}
function resetSettings() {
  document.documentElement.removeAttribute("style");
  localStorage.removeItem("themeVars");
  settingsSheet.hidden = true;
  scheduleRelayout();
}
function loadSettingsOnStart() {
  const kv = loadLocal("themeVars", null);
  if (!kv) return;
  for (const [k, val] of Object.entries(kv)) setVar(k, val);
}

/* ---------- Theme handling (light/dark) ---------- */
const themeBtn = document.getElementById("themeBtn");
const metaTheme = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const bg = getVar("--bg") || (theme === "light" ? "#ffffff" : "#0c0c0c");
  if (metaTheme) metaTheme.setAttribute("content", bg);
  if (themeBtn) {
    const next = theme === "light" ? "다크" : "라이트";
    themeBtn.textContent = next;
    themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    themeBtn.title = `테마 전환 (현재: ${theme === "light" ? "라이트" : "다크"})`;
  }
  try { localStorage.setItem("theme", theme); } catch {}
  scheduleRelayout();
}
function initTheme() {
  loadSettingsOnStart();
  const saved = loadLocal("theme", null);
  if (saved === "light" || saved === "dark") return applyTheme(saved);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}
initTheme();
if (themeBtn) themeBtn.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(cur === "light" ? "dark" : "light");
});
if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
if (settingsSave) settingsSave.addEventListener("click", saveSettings);
if (settingsReset) settingsReset.addEventListener("click", resetSettings);
if (settingsClose) settingsClose.addEventListener("click", () => settingsSheet.hidden = true);

/* ---------- Overlay & rendering ---------- */
function spanifyAnswer(text) {
  enAnsEl.innerHTML = "";
  const parts = (text || "").split(/(\s+)/);
  for (const part of parts) {
    if (/\S/.test(part)) {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = part;
      enAnsEl.appendChild(span);
    } else {
      enAnsEl.appendChild(document.createTextNode(part));
    }
  }
}
function layoutCover() {
  if (!enAnsEl.textContent.trim()) return;
  coverEl.innerHTML = "";

  const areaRect = tapArea.getBoundingClientRect();
  const answerRect = enAnsEl.getBoundingClientRect();

  // Position cover exactly over the answer block
  coverEl.style.left = `${answerRect.left - areaRect.left}px`;
  coverEl.style.top = `${answerRect.top - areaRect.top}px`;
  coverEl.style.width = `${answerRect.width}px`;

  const words = enAnsEl.querySelectorAll(".word");
  const expandX = parseFloat(getVar("--block-expand-x")) || 0;
  const expandY = parseFloat(getVar("--block-expand-y")) || 0;

  let maxBottom = 0;
  for (const w of words) {
    const r = w.getBoundingClientRect();
    const left = (r.left - answerRect.left) - expandX;
    const width = r.width + expandX * 2;
    const fullH = r.height;
    const h = Math.max(10, fullH * (1 + expandY));
    const y = (r.top - answerRect.top) - (h - fullH) / 2;

    const block = document.createElement("div");
    block.className = "block";
    block.style.left = `${left}px`;
    block.style.top = `${y}px`;
    block.style.width = `${width}px`;
    block.style.height = `${h}px`;
    block.style.borderRadius = `${Math.round(h * 0.28)}px`;
    coverEl.appendChild(block);
    maxBottom = Math.max(maxBottom, y + h);
  }
  coverEl.style.height = `${Math.ceil(maxBottom)}px`;
}

/* Render current card and build overlay */
function render() {
  if (!cards.length) return;
  const c = cards[idx];
  spanifyAnswer(c.en);
  koEl.textContent = c.ko;
  posEl.textContent = idx + 1;
  totalEl.textContent = cards.length;
  document.title = `hvppyspeak ${idx+1}/${cards.length}`;
  requestAnimationFrame(() => {
    layoutCover();
    requestAnimationFrame(layoutCover);
  });
}

/* ---------- Interaction ---------- */
function reveal(on) { if (on) tapArea.classList.add("reveal"); else tapArea.classList.remove("reveal"); }
function next() { if (!cards.length) return; idx = (idx + 1) % cards.length; render(); }
function prev() { if (!cards.length) return; idx = (idx - 1 + cards.length) % cards.length; render(); }

["pointerdown","keydown"].forEach(ev => tapArea.addEventListener(ev, (e) => {
  if (e.type === "keydown" && e.code !== "Space") return;
  reveal(true);
}));
["pointerup","pointercancel","pointerleave","keyup","blur"].forEach(ev => tapArea.addEventListener(ev, (e) => {
  if (e.type === "keyup" && e.code !== "Space") return;
  reveal(false);
}));
tapArea.addEventListener("contextmenu", (e) => e.preventDefault());

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

shuffleBtn.addEventListener("click", () => {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  idx = 0;
  saveLocal("cards", cards);
  render();
});

/* ---------- Relayout on env changes ---------- */
function scheduleRelayout() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => requestAnimationFrame(layoutCover), 150);
}
window.addEventListener("resize", scheduleRelayout);
window.addEventListener("orientationchange", scheduleRelayout);
document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRelayout(); });

/* ---------- Data loading (mobile fix + diagnostics) ---------- */
async function loadCards() {
  const url = `${location.origin}/api/cards`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && Array.isArray(json.cards) && json.cards.length) {
      cards = json.cards;
      saveLocal("cards", cards);
      notice(""); // clear
      render();
      return;
    }
    throw new Error("Empty cards from server");
  } catch (e) {
    console.warn("Failed to fetch /api/cards:", e);
    cards = loadLocal("cards", []);
    if (!cards.length) {
      notice(`서버에서 문제를 불러오지 못했습니다.\n같은 Wi‑Fi인지 확인하고, 아래를 점검해 주세요:\n• 주소: http://<맥-IP>:8000 로 접속했는지\n• 서버 실행 중인지 (터미널 확인)\n• 방화벽에서 Python/uvicorn 허용했는지\n\n문제 해결 후 새로고침 해주세요.`);
      posEl.textContent = 0; totalEl.textContent = 0;
      enAnsEl.textContent = ""; coverEl.innerHTML = ""; koEl.textContent = "";
    } else {
      notice("오프라인 모드: 저장된 문제로 학습합니다.", { transient: true, duration: 3000 });
      render();
    }
  }
}
let noticeTimer = null;
function hideNotice(){ if(!noticeEl) return; noticeEl.hidden = true; noticeEl.textContent=''; }
function notice(msg, opts={}) {
  if (!noticeEl) return;
  const { transient=false, duration=2500 } = opts;
  if (!msg) { hideNotice(); return; }
  noticeEl.hidden = false; noticeEl.textContent = msg;
  if (transient) {
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(hideNotice, duration);
  }
}
loadCards();
