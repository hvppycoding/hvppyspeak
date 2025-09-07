/* Core SPA logic: fetch cards, show silhouette, hold-to-reveal, prev/next, theme toggle. */

const $ = (sel) => document.querySelector(sel);

const tapArea = $("#tapArea");
const enSilEl = $("#englishSilhouette");
const enAnsEl = $("#englishAnswer");
const koEl = $("#korean");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const posEl = $("#pos");
const totalEl = $("#total");
const shuffleBtn = $("#shuffleBtn");

let cards = [];
let idx = 0;

function saveLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
function loadLocal(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; } }

// Convert English to silhouette (■ blocks per word length).
function toSilhouette(sentence) {
  if (!sentence) return "";
  const words = sentence.split(/\s+/);
  const blocks = words.map(w => {
    const count = (w.match(/[A-Za-z0-9]/g) || []).length;
    if (count === 0) return "■";
    return "■".repeat(count);
  });
  return blocks.join(" ");
}

function render() {
  if (!cards.length) return;
  const c = cards[idx];
  enSilEl.textContent = toSilhouette(c.en);
  enAnsEl.textContent = c.en;
  koEl.textContent = c.ko;
  posEl.textContent = idx + 1;
  totalEl.textContent = cards.length;
  document.title = `영어 학습 ${idx+1}/${cards.length}`;
}

function reveal(on) {
  if (on) tapArea.classList.add("reveal");
  else tapArea.classList.remove("reveal");
}

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

async function loadCards() {
  try {
    const res = await fetch("/api/cards", {cache: "no-store"});
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.cards)) {
        cards = json.cards;
        saveLocal("cards", cards);
        render();
        return;
      }
    }
    throw new Error("Bad response");
  } catch (e) {
    cards = loadLocal("cards", []);
    if (!cards.length) {
      enSilEl.textContent = "오프라인: 저장된 문제가 없습니다.";
      koEl.textContent = "서버에 접속 후 다시 시도하세요.";
    } else {
      render();
    }
  }
}
loadCards();

/* ---------- Theme handling (light/dark) ---------- */
const themeBtn = document.getElementById("themeBtn");
const metaTheme = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (theme === "light" ? "#ffffff" : "#0c0c0c");
  if (metaTheme) metaTheme.setAttribute("content", bg);
  if (themeBtn) {
    const next = theme === "light" ? "다크" : "라이트";
    themeBtn.textContent = next;
    themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    themeBtn.title = `테마 전환 (현재: ${theme === "light" ? "라이트" : "다크"})`;
  }
  try { localStorage.setItem("theme", theme); } catch {}
}

function initTheme() {
  const saved = loadLocal("theme", null);
  if (saved === "light" || saved === "dark") return applyTheme(saved);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}
initTheme();

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(cur === "light" ? "dark" : "light");
  });
}
