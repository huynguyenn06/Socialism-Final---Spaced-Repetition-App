const STORAGE_KEY = "scientific-socialism-srs-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  cards: [],
  progress: {},
  mode: "due",
  currentCard: null,
  answerVisible: false,
};

const els = {
  dueCount: document.querySelector("#due-count"),
  todayCount: document.querySelector("#today-count"),
  newCount: document.querySelector("#new-count"),
  inProgressCount: document.querySelector("#in-progress-count"),
  masteredCount: document.querySelector("#mastered-count"),
  deckCount: document.querySelector("#deck-count"),
  questionMap: document.querySelector("#question-map"),
  reviewView: document.querySelector("#review-view"),
  emptyState: document.querySelector("#empty-state"),
  browseView: document.querySelector("#browse-view"),
  cardSource: document.querySelector("#card-source"),
  cardType: document.querySelector("#card-type"),
  cardPrompt: document.querySelector("#card-prompt"),
  cardAnswer: document.querySelector("#card-answer"),
  revealCard: document.querySelector("#reveal-card"),
  ratingGrid: document.querySelector("#rating-grid"),
  sourceFilter: document.querySelector("#source-filter"),
  searchCards: document.querySelector("#search-cards"),
  browseList: document.querySelector("#browse-list"),
  browseTemplate: document.querySelector("#browse-card-template"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  loadProgress();

  try {
    const response = await fetch("cards.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Deck request failed with ${response.status}`);
    state.cards = await response.json();
  } catch (error) {
    showDeckError(error);
    return;
  }

  registerServiceWorker();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  els.revealCard.addEventListener("click", revealAnswer);
  els.ratingGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rating]");
    if (button) rateCurrentCard(button.dataset.rating);
  });

  document.querySelector("#reset-progress").addEventListener("click", resetProgress);
  document.querySelector("#export-progress").addEventListener("click", exportProgress);
  document.querySelector("#import-progress").addEventListener("change", importProgress);
  els.sourceFilter.addEventListener("change", renderBrowseList);
  els.searchCards.addEventListener("input", renderBrowseList);
}

function setMode(mode) {
  state.mode = mode;
  state.answerVisible = false;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  renderAll();
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.progress = saved.progress || {};
  } catch {
    state.progress = {};
  }
}

function saveProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: state.progress,
    })
  );
}

function renderAll() {
  renderStats();
  renderQuestionMap();
  renderSourceFilter();

  if (state.mode === "browse") {
    els.reviewView.classList.add("hidden");
    els.emptyState.classList.add("hidden");
    els.browseView.classList.remove("hidden");
    renderBrowseList();
    return;
  }

  els.browseView.classList.add("hidden");
  const queue = getQueue();
  state.currentCard = queue[0] || null;
  renderReviewCard();
}

function renderStats() {
  const now = Date.now();
  const todayKey = getDayKey(now);
  const due = state.cards.filter((card) => isDue(card, now)).length;
  const reviewedToday = Object.values(state.progress).filter((item) => item.lastReviewedDay === todayKey).length;
  const fresh = state.cards.filter((card) => !state.progress[card.id]?.reviews).length;
  const mastered = state.cards.filter((card) => (state.progress[card.id]?.intervalDays || 0) >= 7).length;
  const inProgress = Math.max(0, state.cards.length - fresh - mastered);

  els.dueCount.textContent = due;
  els.todayCount.textContent = reviewedToday;
  els.newCount.textContent = fresh;
  els.inProgressCount.textContent = inProgress;
  els.masteredCount.textContent = mastered;
  els.deckCount.textContent = `${state.cards.length} cards`;
}

function renderQuestionMap() {
  const sources = [...new Set(state.cards.map((card) => card.source))].filter((source) => /^Question \d/.test(source));
  els.questionMap.replaceChildren(
    ...sources.map((source) => {
      const cards = state.cards.filter((card) => card.source === source);
      const reviewed = cards.filter((card) => state.progress[card.id]?.reviews).length;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "map-tile";
      tile.innerHTML = `
        <strong>${escapeHtml(source.replace("Question ", "Q"))}</strong>
        <span>${reviewed}/${cards.length} reviewed</span>
        <div class="map-progress"><i style="--progress: ${(reviewed / cards.length) * 100}%"></i></div>
      `;
      tile.addEventListener("click", () => {
        setMode("browse");
        els.sourceFilter.value = source;
        renderBrowseList();
      });
      return tile;
    })
  );
}

function renderSourceFilter() {
  if (els.sourceFilter.options.length) return;
  const sources = ["All sources", ...new Set(state.cards.map((card) => card.source))];
  els.sourceFilter.replaceChildren(
    ...sources.map((source) => {
      const option = document.createElement("option");
      option.value = source === "All sources" ? "all" : source;
      option.textContent = source;
      return option;
    })
  );
}

function renderReviewCard() {
  if (!state.currentCard) {
    els.reviewView.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.reviewView.classList.remove("hidden");
  els.emptyState.classList.add("hidden");
  els.cardSource.textContent = state.currentCard.source;
  els.cardType.textContent = formatType(state.currentCard.type);
  els.cardPrompt.textContent = state.currentCard.prompt;
  els.cardAnswer.innerHTML = formatAnswer(state.currentCard.answer);
  els.cardAnswer.classList.toggle("hidden", !state.answerVisible);
  els.ratingGrid.classList.toggle("hidden", !state.answerVisible);
  els.revealCard.classList.toggle("hidden", state.answerVisible);
}

function renderBrowseList() {
  const source = els.sourceFilter.value || "all";
  const query = els.searchCards.value.trim().toLowerCase();
  const cards = state.cards.filter((card) => {
    const matchesSource = source === "all" || card.source === source;
    const haystack = `${card.prompt} ${card.answer} ${card.tags.join(" ")}`.toLowerCase();
    return matchesSource && (!query || haystack.includes(query));
  });

  els.browseList.replaceChildren(
    ...cards.map((card) => {
      const node = els.browseTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".browse-source").textContent = `${card.source} / ${formatType(card.type)}`;
      node.querySelector("h3").textContent = card.prompt;
      node.querySelector(".browse-answer").textContent = card.answer.replace(/\n+/g, " ").slice(0, 240);
      node.addEventListener("click", () => {
        state.currentCard = card;
        state.answerVisible = true;
        state.mode = "cram";
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === "cram"));
        els.browseView.classList.add("hidden");
        renderReviewCard();
      });
      return node;
    })
  );
}

function revealAnswer() {
  state.answerVisible = true;
  renderReviewCard();
}

function rateCurrentCard(rating) {
  if (!state.currentCard) return;
  const next = scheduleCard(state.currentCard.id, rating, Date.now());
  state.progress[state.currentCard.id] = next;
  saveProgress();
  state.answerVisible = false;
  renderAll();
}

function scheduleCard(cardId, rating, now) {
  const previous = state.progress[cardId] || {
    intervalDays: 0,
    ease: 2.3,
    reviews: 0,
    lapses: 0,
  };

  const reviews = previous.reviews + 1;
  let ease = previous.ease;
  let intervalDays = previous.intervalDays || 0;
  let lapses = previous.lapses || 0;
  let delayMs;

  if (rating === "again") {
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    intervalDays = 0;
    delayMs = 20 * 60 * 1000;
  } else if (rating === "hard") {
    ease = Math.max(1.3, ease - 0.1);
    intervalDays = Math.max(1, Math.ceil(intervalDays * 1.2));
    delayMs = DAY_MS;
  } else if (rating === "easy") {
    ease += 0.15;
    intervalDays = intervalDays === 0 ? 5 : Math.ceil(intervalDays * (ease + 0.35));
    delayMs = intervalDays * DAY_MS;
  } else {
    intervalDays = intervalDays === 0 ? (reviews <= 2 ? 2 : 3) : Math.ceil(intervalDays * ease);
    delayMs = intervalDays * DAY_MS;
  }

  return {
    dueAt: now + delayMs,
    intervalDays,
    ease: Number(ease.toFixed(2)),
    reviews,
    lapses,
    lastRating: rating,
    lastReviewedAt: new Date(now).toISOString(),
    lastReviewedDay: getDayKey(now),
  };
}

function getQueue() {
  const now = Date.now();
  const cards = state.mode === "cram"
    ? [...state.cards]
    : state.cards.filter((card) => isDue(card, now));

  return cards.sort((a, b) => {
    const aProgress = state.progress[a.id];
    const bProgress = state.progress[b.id];
    const aDue = aProgress?.dueAt || 0;
    const bDue = bProgress?.dueAt || 0;
    if (aDue !== bDue) return aDue - bDue;
    return a.id.localeCompare(b.id);
  });
}

function isDue(card, now) {
  const progress = state.progress[card.id];
  return !progress || !progress.dueAt || progress.dueAt <= now;
}

function resetProgress() {
  const confirmed = window.confirm("Reset all local review progress? The study deck will stay unchanged.");
  if (!confirmed) return;
  state.progress = {};
  saveProgress();
  renderAll();
}

function exportProgress() {
  const blob = new Blob([localStorage.getItem(STORAGE_KEY) || "{}"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "scientific-socialism-progress.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importProgress(event) {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!imported.progress || typeof imported.progress !== "object") {
      throw new Error("Missing progress object");
    }
    state.progress = imported.progress;
    saveProgress();
    renderAll();
  } catch (error) {
    window.alert(`Could not import progress: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function showDeckError(error) {
  els.cardPrompt.textContent = "Could not load cards.json";
  els.cardAnswer.classList.remove("hidden");
  els.cardAnswer.innerHTML = formatAnswer(
    `The app needs to be served as static files so the browser can read cards.json.\n\nTry running a simple local server in this folder, then open the local URL.\n\nDetails: ${error.message}`
  );
  els.revealCard.classList.add("hidden");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function getDayKey(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function formatType(type) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAnswer(answer) {
  const blocks = escapeHtml(answer)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^- /.test(line))) {
      return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+\. /.test(line))) {
      return `<ol>${lines.map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`).join("")}</ol>`;
    }
    return `<p>${lines.join("<br>")}</p>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.srsTest = {
  scheduleCard,
  getDayKey,
};
