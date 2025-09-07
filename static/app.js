/* Core SPA logic: fetch cards, show silhouette, hold-to-reveal, prev/next. */

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
    // count letters/numbers only for block count
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

// Pointer (touch/mouse/pen) hold-to-reveal
["pointerdown","keydown"].forEach(ev => tapArea.addEventListener(ev, (e) => {
  if (e.type === "keydown" && e.code !== "Space") return;
  reveal(true);
}));
["pointerup","pointercancel","pointerleave","keyup","blur"].forEach(ev => tapArea.addEventListener(ev, (e) => {
  if (e.type === "keyup" && e.code !== "Space") return;
  reveal(false);
}));

// Prevent accidental text selection / context menu
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
  // Try network first
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
    // Offline fallback from localStorage
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
