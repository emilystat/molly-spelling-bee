// =============================
//  Word Data
// =============================
// Word lists come from word-lists.js (WORD_LISTS). Each list is split into sets:
// "set1".."set6" for 2026-27 and "oneBee".."threeBee" for 2025-26.
// The set a word belongs to is attached to it as `difficulty`.

// =============================
//  App State
// =============================

const ACTIVE_LIST_KEY = "mollySpellingBee_activeList";
const GRADE_KEY = "mollySpellingBee_grade";

// Spaced review: days until the next review test while scores stay at 90% or better.
// (Hoover 206's advice: leave at least a day before testing, then re-test a few days apart.)
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

let currentListId = loadActiveListId();
let currentWordObj = null;
let currentWordAnswered = false;
let currentMode = "practice"; // "practice", "quiz", "study" or "reviewDifficult"
let currentDifficulty = "all"; // "all" or a set key of the current list
let quizWords = [];
let quizIndex = 0;
let correctCount = 0;
let totalAttempts = 0;
let pendingTransition = null; // timer for automatic moves (e.g. to the next group)

// Study Mode State
let studyPhase = "none"; // "none" | "dashboard" | "studying" | "testing" | "reviewingDifficult" | "testingDifficult" | "testingReview"
let studyGroupIndex = 0; // Which group of 10 in the set
let studyCurrentWordIndex = 0; // Position within group (0-9)
let studyWords = []; // Current 10 words for study
let studyProgress = null; // Loaded from localStorage
let studyTestResults = []; // Track test performance
let reviewTarget = null; // { setKey, groupIndex } during a scheduled review test

// DOM elements
const listSelect = document.getElementById("listSelect");
const headerSubtitle = document.getElementById("headerSubtitle");
const modeSelect = document.getElementById("modeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startQuizBtn = document.getElementById("startQuizBtn");
const playWordBtn = document.getElementById("playWordBtn");
const repeatBtn = document.getElementById("repeatBtn");
const slowBtn = document.getElementById("slowBtn");
const hintBtn = document.getElementById("hintBtn");
const testAudioBadge = document.getElementById("testAudioBadge");
const pronouncerPanel = document.getElementById("pronouncerPanel");
const pronouncerAnswers = document.getElementById("pronouncerAnswers");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");
const nextWordBtn = document.getElementById("nextWordBtn");
const markDifficultTestBtn = document.getElementById("markDifficultTestBtn");

const resultText = document.getElementById("resultText");
const infoMessage = document.getElementById("infoMessage");
const wordDetails = document.getElementById("wordDetails");
const scoreText = document.getElementById("scoreText");
const progressText = document.getElementById("progressText");

// Study Mode DOM elements
let studyPhaseIndicator = null;
let studyProgressText = null;
let studyControls = null;
let prevStudyWordBtn = null;
let nextStudyWordBtn = null;
let startTestBtn = null;
let studyCard = null;
let studyWordText = null;
let hearStudyWordBtn = null;
let studyDetails = null;
let studyDashboard = null;
let progressBars = null;
let continueStudyBtn = null;
let bookmarkBtn = null;

// =============================
//  Helpers
// =============================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAccents(text) {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Local date as "YYYY-MM-DD"
function todayString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateString(text) {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateText, days) {
  const date = parseDateString(dateText);
  date.setDate(date.getDate() + days);
  return todayString(date);
}

function daysBetween(fromText, toText) {
  return Math.round((parseDateString(toText) - parseDateString(fromText)) / 86400000);
}

function formatShortDate(dateText) {
  return parseDateString(dateText).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "Nov 15–18", "Jan 20" or "Nov 30 – Dec 2"
function formatEventDates(event) {
  if (event.start === event.end) return formatShortDate(event.start);
  const start = parseDateString(event.start);
  const end = parseDateString(event.end);
  if (start.getMonth() === end.getMonth()) return `${formatShortDate(event.start)}–${end.getDate()}`;
  return `${formatShortDate(event.start)} – ${formatShortDate(event.end)}`;
}

function describeDue(dateText) {
  const days = daysBetween(todayString(), dateText);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatShortDate(dateText)}`;
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Runs fn after a delay, unless the user starts something else first
function scheduleTransition(fn, delay) {
  cancelTransition();
  pendingTransition = setTimeout(() => {
    pendingTransition = null;
    fn();
  }, delay);
}

function cancelTransition() {
  if (pendingTransition) {
    clearTimeout(pendingTransition);
    pendingTransition = null;
  }
}

function isTestPhase() {
  return studyPhase === "testing" || studyPhase === "testingDifficult" || studyPhase === "testingReview";
}

// True when a word is being asked (practice, quiz, or any test)
function isAnswering() {
  return isTestPhase() || currentMode === "practice" || currentMode === "quiz";
}

function setPhaseText(text) {
  const phaseText = document.getElementById("phaseText");
  if (phaseText) phaseText.textContent = text;
}

function setInfoMessage(message, extra = "") {
  infoMessage.textContent = extra ? `${message} ${extra}` : message;
  infoMessage.style.display = "block";
  wordDetails.style.display = "none";
  wordDetails.innerHTML = "";
}

function showWordDetails(wordObj) {
  infoMessage.style.display = "none";
  wordDetails.innerHTML = renderWordDetails(wordObj, { withAudioCredit: true });
  wordDetails.style.display = "block";
}

// =============================
//  Word Lists & Sets
// =============================

function loadActiveListId() {
  try {
    const saved = localStorage.getItem(ACTIVE_LIST_KEY);
    if (saved && WORD_LISTS[saved]) return saved;
  } catch (e) {
    console.error("Error loading word list choice:", e);
  }
  return DEFAULT_LIST_ID;
}

function getActiveList() {
  return WORD_LISTS[currentListId];
}

function getSetKeys() {
  return getActiveList().sets.map(s => s.key);
}

function getSet(key) {
  return getActiveList().sets.find(s => s.key === key) || null;
}

function getSetLabel(key) {
  const set = getSet(key);
  return set ? set.label : key;
}

function getSetBadge(key) {
  const set = getSet(key);
  return set ? set.badge : "";
}

// Words of one set, each tagged with the set it belongs to
function getSetWords(key) {
  const set = getSet(key);
  if (!set) return [];
  return set.words.map(w => ({...w, difficulty: key}));
}

function getAllWords() {
  return getSetKeys().flatMap(key => getSetWords(key));
}

function getSelectedWords() {
  return currentDifficulty === "all" ? getAllWords() : getSetWords(currentDifficulty);
}

// Full word data for a saved difficult word (only a few fields are saved)
function hydrateWord(saved) {
  const full = getSetWords(saved.difficulty).find(w => w.word.toLowerCase() === saved.word.toLowerCase());
  return full ? {...saved, ...full} : saved;
}

// The chosen grade ({ id, label, range, setKeys }), or null when the list has no grade guidance
function getGrade() {
  const grades = getActiveList().grades;
  if (!grades) return null;
  let saved = null;
  try {
    saved = localStorage.getItem(GRADE_KEY);
  } catch (e) {
    console.error("Error loading grade:", e);
  }
  return grades.find(g => g.id === saved) || grades[0];
}

// Sets to study first for the chosen grade (all sets when the list has no grade guidance)
function getGradeSetKeys() {
  const grade = getGrade();
  return grade ? grade.setKeys : getSetKeys();
}

// First set for the grade that still has groups left to study
function getDefaultStudySet() {
  const keys = getGradeSetKeys();
  return keys.find(key => studyProgress[key].completedGroups.length < studyProgress[key].totalGroups) || keys[0];
}

function populateListSelect() {
  listSelect.innerHTML = Object.values(WORD_LISTS)
    .map(list => `<option value="${list.id}">${escapeHtml(list.title)}</option>`)
    .join("");
  listSelect.value = currentListId;
}

function populateSetSelects() {
  const options = getActiveList().sets
    .map(s => `<option value="${s.key}">${escapeHtml(s.label)}</option>`)
    .join("");

  if (currentDifficulty !== "all" && !getSet(currentDifficulty)) currentDifficulty = "all";
  difficultySelect.innerHTML = `<option value="all">All Words</option>${options}`;
  difficultySelect.value = currentDifficulty;

  const filter = document.getElementById("difficultWordsFilter");
  if (filter) filter.innerHTML = `<option value="all">All Sets</option>${options}`;
}

function populateGradeSelect() {
  const row = document.getElementById("gradeRow");
  const select = document.getElementById("gradeSelect");
  if (!row || !select) return;

  const grades = getActiveList().grades;
  if (!grades) {
    row.style.display = "none";
    return;
  }
  select.innerHTML = grades
    .map(g => `<option value="${g.id}">${escapeHtml(g.label)}</option>`)
    .join("");
  select.value = getGrade().id;
  row.style.display = "flex";
}

function renderResources() {
  const body = document.getElementById("resourcesBody");
  if (!body) return;

  const groups = new Map();
  getActiveList().resources.forEach(r => {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group).push(r);
  });

  let html = "";
  groups.forEach((items, group) => {
    html += `<h4>${escapeHtml(group)}</h4><ul class="resource-sets">`;
    items.forEach(r => {
      const links = r.links
        .map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.text)} ↗</a>`)
        .join(" ");
      html += `<li><span>${escapeHtml(r.name)}</span> ${links}</li>`;
    });
    html += "</ul>";
  });

  html += "<h4>Helpful links</h4><ul>";
  GENERAL_RESOURCES.forEach(r => {
    html += `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.text)} ↗</a></li>`;
  });
  html += "</ul>";
  body.innerHTML = html;
}

function updateListUI() {
  if (headerSubtitle) headerSubtitle.textContent = getActiveList().subtitle;
  populateSetSelects();
  populateGradeSelect();
  renderResources();
}

function switchWordList(listId) {
  if (!WORD_LISTS[listId] || listId === currentListId) return;

  BeeAudio.stop();
  cancelTransition();
  currentListId = listId;
  try {
    localStorage.setItem(ACTIVE_LIST_KEY, listId);
  } catch (e) {
    console.error("Error saving word list choice:", e);
  }

  currentDifficulty = "all";
  loadStudyProgress();
  updateListUI();
  resetSession();

  if (currentMode === "study") {
    startStudyMode();
  } else {
    showPracticeUI();
    resultText.textContent = `Switched to the ${getActiveList().title}.`;
    resultText.className = "result-text";
    setInfoMessage("Click “Play Word” or “Start” to begin.");
  }
}

// Clears the current word, quiz and study session
function resetSession() {
  currentWordObj = null;
  currentWordAnswered = false;
  quizWords = [];
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;
  studyPhase = "none";
  studyWords = [];
  reviewTarget = null;
  answerInput.value = "";
  resultText.textContent = "";
  resultText.className = "result-text";
  hideNextWordButton();
  hideMarkDifficultTestButton();
  hidePronouncer();
  refreshAudioBadges();
  updateScoreDisplay();
}

// Shows the play/answer controls used by Practice and Quiz, hiding the Study Mode screens
function showPracticeUI() {
  if (studyDashboard) studyDashboard.style.display = "none";
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "none";
  if (studyControls) studyControls.style.display = "none";
  if (studyCard) studyCard.style.display = "none";
  document.querySelector(".word-controls").style.display = "flex";
  document.querySelector(".input-row").style.display = "flex";
  document.querySelector(".info").style.display = "block";
}

function pickRandomWord() {
  const availableWords = getSelectedWords();

  if (!availableWords.length) {
    alert("No words available for the selected word set.");
    return null;
  }

  const idx = Math.floor(Math.random() * availableWords.length);
  return availableWords[idx];
}

// =============================
//  Word Card
// =============================

// Where the word (or an accepted spelling) appears in its example sentence
function findWordInSentence(wordObj) {
  const text = String(wordObj.sentence || "").normalize("NFC");
  const plain = stripAccents(text).toLowerCase();
  for (const form of [wordObj.word, ...(wordObj.alts || [])]) {
    const target = stripAccents(form.normalize("NFC")).toLowerCase();
    const match = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(target)})(?![\\p{L}])`, "u").exec(plain);
    if (match) {
      return { text, index: match.index + match[1].length, length: target.length };
    }
  }
  return null;
}

// The example sentence with the word highlighted, or blanked out for tests
function sentenceHtml(wordObj, blank) {
  const found = findWordInSentence(wordObj);
  if (!found) return escapeHtml(wordObj.sentence || "");
  const { text, index, length } = found;
  const middle = blank
    ? '<span class="blank">_____</span>'
    : `<mark>${escapeHtml(text.slice(index, index + length))}</mark>`;
  return escapeHtml(text.slice(0, index)) + middle + escapeHtml(text.slice(index + length));
}

// The sentence as the computer voice should read it (using the sound-it-out spelling for hard words)
function sentenceForSpeech(wordObj) {
  const found = wordObj.say ? findWordInSentence(wordObj) : null;
  if (!found) return wordObj.sentence || "";
  return found.text.slice(0, found.index) + wordObj.say + found.text.slice(found.index + found.length);
}

// Hides the word (and its accepted spellings) inside hints, so hints don't give the answer away
function redactWord(text, wordObj) {
  let result = String(text);
  [wordObj.word, ...(wordObj.alts || [])].forEach(form => {
    const pattern = stripAccents(form).split("").map(ch => {
      const plain = escapeRegExp(ch);
      return /[a-z]/i.test(ch) ? `${plain}[\\u0300-\\u036f]*` : plain;
    }).join("");
    result = result.normalize("NFD").replace(new RegExp(pattern, "gi"), "_____").normalize("NFC");
  });
  return result;
}

function audioBadgeHtml(wordObj, withCredit) {
  const source = BeeAudio.getKnownSource(wordObj);
  if (source === "voice") return "🤖 Computer voice";
  if (source !== "recording") return "";

  const rec = BeeAudio.getRecordingInfo(wordObj) || {};
  let html = `🎙️ Real voice${rec.accent ? ` (${escapeHtml(rec.accent)} speaker)` : ""}`;
  if (withCredit && rec.page) {
    const credit = [rec.author && `by ${rec.author}`, rec.license].filter(Boolean).join(", ");
    html += ` · <a href="${escapeHtml(rec.page)}" target="_blank" rel="noopener">recording${credit ? ` ${escapeHtml(credit)}` : ""} ↗</a>`;
  }
  return html;
}

function renderWordDetails(wordObj, { withAudioCredit = false } = {}) {
  const html = [];

  const meta = [wordObj.pos, wordObj.origin && `🌍 ${wordObj.origin}`].filter(Boolean);
  if (meta.length) html.push(`<p class="wd-meta">${meta.map(escapeHtml).join(" · ")}</p>`);
  if (wordObj.sounds) html.push(`<p class="wd-sounds">Sounds like: <strong>${escapeHtml(wordObj.sounds)}</strong></p>`);

  html.push(`<p><strong>Definition:</strong> ${escapeHtml(wordObj.definition || "No definition available.")}</p>`);
  if (wordObj.sentence) html.push(`<p><strong>Sentence:</strong> ${sentenceHtml(wordObj, false)}</p>`);

  if (wordObj.parts && wordObj.parts.length) {
    const chips = wordObj.parts
      .map(p => `<span class="part-chip"><b>${escapeHtml(p.part)}</b> ${escapeHtml(p.meaning)}</span>`)
      .join('<span class="part-plus">+</span>');
    html.push(`<div class="wd-parts"><strong>Word parts:</strong> ${chips}</div>`);
  }
  if (wordObj.tip) html.push(`<p class="wd-tip">💡 ${escapeHtml(wordObj.tip)}</p>`);
  if (wordObj.confuse) {
    const label = wordObj.flag === "homonym" ? "Homonym" : "Don't mix it up";
    html.push(`<p class="wd-confuse">⚠️ <strong>${label}:</strong> ${escapeHtml(wordObj.confuse)}</p>`);
  }
  if (wordObj.alts && wordObj.alts.length) {
    html.push(`<p class="wd-alts">Also accepted: ${wordObj.alts.map(escapeHtml).join(", ")}</p>`);
  }

  const links = [];
  if (withAudioCredit) {
    const badge = audioBadgeHtml(wordObj, true);
    if (badge) links.push(`<span class="audio-badge">${badge}</span>`);
  }
  links.push(`<a href="https://www.merriam-webster.com/dictionary/${encodeURIComponent(wordObj.word)}" target="_blank" rel="noopener">Check on Merriam-Webster ↗</a>`);
  html.push(`<p class="wd-links">${links.join(" ")}</p>`);

  return html.join("");
}

function refreshAudioBadges() {
  const studyBadge = document.getElementById("studyAudioBadge");
  const studyWord = studyWords[studyCurrentWordIndex];
  if (studyBadge) {
    const showing = studyWord && studyCard && studyCard.style.display !== "none";
    studyBadge.innerHTML = showing ? audioBadgeHtml(studyWord, true) : "";
  }
  if (testAudioBadge) {
    testAudioBadge.innerHTML = currentWordObj ? audioBadgeHtml(currentWordObj, false) : "";
  }
  if (currentWordAnswered && currentWordObj && wordDetails.style.display !== "none") {
    showWordDetails(currentWordObj);
  }
}

function playWord(wordObj, options = {}) {
  if (!wordObj) return;
  BeeAudio.playWord(wordObj, options).then(refreshAudioBadges);
}

// =============================
//  Ask the Pronouncer
// =============================
// Like a real bee: the speller may ask for the definition, a sentence, the part of
// speech and the language of origin. Answers are shown and read aloud.

const PRONOUNCER_LABELS = {
  definition: "Definition",
  sentence: "Sentence",
  pos: "Part of speech",
  origin: "Language of origin",
  parts: "Root hint"
};

// { html, speech } for a question, or null when the word has no such information
function pronouncerAnswer(wordObj, kind) {
  switch (kind) {
    case "definition": {
      if (!wordObj.definition) return null;
      const text = redactWord(wordObj.definition, wordObj);
      return { html: escapeHtml(text), speech: text.replace(/_____/g, "blank") };
    }
    case "sentence":
      if (!wordObj.sentence) return null;
      return { html: sentenceHtml(wordObj, true), speech: sentenceForSpeech(wordObj) };
    case "pos":
      if (!wordObj.pos) return null;
      return { html: escapeHtml(wordObj.pos), speech: `Part of speech: ${wordObj.pos}` };
    case "origin": {
      if (!wordObj.origin) return null;
      const text = redactWord(wordObj.origin, wordObj);
      return { html: escapeHtml(text), speech: `Language of origin: ${text.replace(/→/g, ", then").replace(/_____/g, "blank")}` };
    }
    case "parts": {
      if (!wordObj.parts || !wordObj.parts.length) return null;
      const meanings = wordObj.parts.map(p => `“${redactWord(p.meaning, wordObj)}”`).join(" + ");
      const text = `${wordObj.parts.length} part${wordObj.parts.length === 1 ? "" : "s"}, meaning ${meanings}`;
      return { html: escapeHtml(text), speech: text.replace(/_____/g, "blank") };
    }
    default:
      return null;
  }
}

function showPronouncer(wordObj) {
  if (!pronouncerPanel) return;
  pronouncerAnswers.innerHTML = "";
  pronouncerPanel.querySelectorAll("button[data-ask]").forEach(btn => {
    btn.disabled = !pronouncerAnswer(wordObj, btn.dataset.ask);
  });
  pronouncerPanel.style.display = "block";
}

function hidePronouncer() {
  if (pronouncerPanel) pronouncerPanel.style.display = "none";
  if (pronouncerAnswers) pronouncerAnswers.innerHTML = "";
}

function askPronouncer(kind) {
  if (!currentWordObj || currentWordAnswered) return;
  const answer = pronouncerAnswer(currentWordObj, kind);
  if (!answer) return;

  let line = pronouncerAnswers.querySelector(`[data-kind="${kind}"]`);
  if (!line) {
    line = document.createElement("p");
    line.dataset.kind = kind;
    pronouncerAnswers.appendChild(line);
  }
  line.innerHTML = `<strong>${PRONOUNCER_LABELS[kind]}:</strong> ${answer.html}`;
  BeeAudio.speakText(answer.speech);
}

// =============================
//  Answer Checking
// =============================

// Case, accents and curly apostrophes don't matter; hyphens and spaces do.
function normalizeSpelling(text) {
  return stripAccents(String(text).normalize("NFC"))
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectSpelling(answer, wordObj) {
  const given = normalizeSpelling(answer);
  return [wordObj.word, ...(wordObj.alts || [])].some(form => normalizeSpelling(form) === given);
}

function formatAcceptedSpellings(wordObj) {
  const alts = wordObj.alts || [];
  return alts.length ? `${wordObj.word} (also ${alts.join(" or ")})` : wordObj.word;
}

function spellingHint(word) {
  const letterCount = text => text.replace(/[^\p{L}]/gu, "").length;
  const pieces = word.split(/\s+/).filter(Boolean);
  let hint = pieces.length > 1
    ? `It's ${pieces.length} words (${pieces.map(letterCount).join(" + ")} letters) and starts with "${word[0]}".`
    : `The word has ${letterCount(word)} letters and starts with "${word[0]}".`;
  if (word.includes("-")) hint += " It has a hyphen.";
  return hint;
}

// =============================
//  Study Mode - localStorage Functions
// =============================

function createSetProgress(key) {
  return {
    completedGroups: [],
    currentGroup: 0,
    totalGroups: calculateTotalGroups(key),
    lastStudiedDate: null,
    bookmark: null,
    difficultWords: [],
    groupReviews: {}
  };
}

function initializeStudyProgress() {
  const progress = { globalSettings: {} };
  getSetKeys().forEach(key => {
    progress[key] = createSetProgress(key);
  });
  return progress;
}

// Adds anything missing from saved progress (new sets, new fields)
function completeStudyProgress() {
  getSetKeys().forEach(key => {
    if (!studyProgress[key]) studyProgress[key] = createSetProgress(key);
    const progress = studyProgress[key];
    progress.totalGroups = calculateTotalGroups(key);
    if (!progress.difficultWords) progress.difficultWords = [];
    if (!progress.groupReviews) progress.groupReviews = {};
  });
  if (!studyProgress.globalSettings) studyProgress.globalSettings = {};
}

function loadStudyProgress() {
  try {
    const saved = localStorage.getItem(getActiveList().storageKey);
    if (saved) {
      studyProgress = JSON.parse(saved);
      completeStudyProgress();
      // Clean up any corrupted difficult words data
      cleanupDifficultWords();
    } else {
      studyProgress = initializeStudyProgress();
      saveStudyProgress();
    }
  } catch (e) {
    console.error("Error loading study progress:", e);
    studyProgress = initializeStudyProgress();
  }
}

function cleanupDifficultWords() {
  // Remove any difficult words that have invalid difficulty values
  getSetKeys().forEach(diff => {
    if (studyProgress[diff].difficultWords) {
      const before = studyProgress[diff].difficultWords.length;
      studyProgress[diff].difficultWords = studyProgress[diff].difficultWords.filter(w => {
        // Keep only words with valid difficulty matching this category
        return w.difficulty === diff && w.word && w.definition;
      });
      const after = studyProgress[diff].difficultWords.length;
      if (before !== after) {
        console.log(`Cleaned up ${before - after} invalid difficult words from ${diff}`);
        saveStudyProgress();
      }
    }
  });
}

function saveStudyProgress() {
  try {
    localStorage.setItem(getActiveList().storageKey, JSON.stringify(studyProgress));
  } catch (e) {
    console.error("Error saving study progress:", e);
  }
}

function calculateTotalGroups(difficulty) {
  const words = getSetWords(difficulty);
  return Math.ceil(words.length / 10);
}

function getStudyGroupWords(difficulty, groupIndex) {
  const words = getSetWords(difficulty);
  const startIdx = groupIndex * 10;
  const endIdx = Math.min(startIdx + 10, words.length);
  return words.slice(startIdx, endIdx);
}

function markGroupComplete(difficulty, groupIndex) {
  if (!studyProgress[difficulty].completedGroups.includes(groupIndex)) {
    studyProgress[difficulty].completedGroups.push(groupIndex);
  }
  studyProgress[difficulty].lastStudiedDate = todayString();

  // Move to next group
  const totalGroups = studyProgress[difficulty].totalGroups;
  if (groupIndex + 1 < totalGroups) {
    studyProgress[difficulty].currentGroup = groupIndex + 1;
  }

  saveStudyProgress();
}

function getNextStudyGroup(difficulty) {
  const progress = studyProgress[difficulty];
  return progress.currentGroup;
}

// =============================
//  Spaced Review
// =============================
// After a group's first test it comes back for a review test the next day. Each
// review with 90% or better pushes the next one further out (1, 3, 7, 14, 30 days);
// a lower score brings it back the next day.

function recordGroupTest(setKey, groupIndex, score, total) {
  const reviews = studyProgress[setKey].groupReviews;
  const review = reviews[groupIndex] || { tests: 0, streak: 0 };
  const passed = total > 0 && score / total >= 0.9;

  review.tests += 1;
  review.lastTestDate = todayString();
  review.lastScore = `${score}/${total}`;
  review.streak = passed ? review.streak + 1 : 0;
  const interval = passed ? REVIEW_INTERVALS[Math.min(review.streak - 1, REVIEW_INTERVALS.length - 1)] : 1;
  review.nextDue = addDays(review.lastTestDate, interval);

  reviews[groupIndex] = review;
  saveStudyProgress();
  return review;
}

function getAllReviews() {
  const all = [];
  getSetKeys().forEach(setKey => {
    const reviews = studyProgress[setKey].groupReviews || {};
    Object.keys(reviews).forEach(groupIndex => {
      all.push({ setKey, groupIndex: Number(groupIndex), ...reviews[groupIndex] });
    });
  });
  return all.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

function getDueReviews() {
  const today = todayString();
  return getAllReviews().filter(r => r.nextDue <= today);
}

function startScheduledReview(setKey, groupIndex) {
  cancelTransition();
  currentMode = "study";
  currentDifficulty = setKey;
  difficultySelect.value = setKey;
  studyPhase = "testingReview";
  reviewTarget = { setKey, groupIndex };
  studyGroupIndex = groupIndex;
  studyWords = getStudyGroupWords(setKey, groupIndex);

  quizWords = shuffleArray(studyWords);
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;
  studyTestResults = [];

  if (studyDashboard) studyDashboard.style.display = "none";
  showTestPhaseUI();
  setPhaseText(`Review Test · ${getSetBadge(setKey)} · Group ${groupIndex + 1}`);
  if (studyProgressText) studyProgressText.textContent = `${quizWords.length} words`;

  BeeAudio.prefetch(quizWords);
  loadQuizWord();
}

function completeScheduledReview() {
  const { setKey, groupIndex } = reviewTarget;
  const review = recordGroupTest(setKey, groupIndex, correctCount, quizWords.length);

  resultText.textContent = `Review complete! You scored ${correctCount} out of ${quizWords.length}.`;
  resultText.className = "result-text correct";
  setInfoMessage(
    `Next review for this group: ${describeDue(review.nextDue)}.`,
    review.streak > 0 ? "Great job! The gap before the next review gets longer each time you do well." : "Let's try this group again tomorrow."
  );

  progressText.textContent = "";
  hideNextWordButton();
  hidePronouncer();
  reviewTarget = null;

  // Return to dashboard after a few seconds
  scheduleTransition(() => startStudyMode(), 3500);
}

// =============================
//  Reset Progress Functions
// =============================

function resetDifficultyProgress(difficulty) {
  if (!studyProgress[difficulty]) {
    console.error(`Invalid difficulty: ${difficulty}`);
    return;
  }

  // Preserve difficult words if they exist
  const preservedDifficultWords = studyProgress[difficulty].difficultWords || [];

  // Reset progress (including the review schedule)
  studyProgress[difficulty] = createSetProgress(difficulty);
  studyProgress[difficulty].difficultWords = preservedDifficultWords; // Preserve this

  // Update global settings
  if (!studyProgress.globalSettings) {
    studyProgress.globalSettings = {};
  }
  studyProgress.globalSettings.lastResetDate = todayString();

  saveStudyProgress();

  // Show success message
  resultText.textContent = `✅ ${getSetLabel(difficulty)} progress has been reset!`;
  resultText.className = "result-text correct";

  // Re-render dashboard
  renderProgressDashboard();

  setTimeout(() => {
    resultText.textContent = "";
  }, 3000);
}

function resetAllProgress() {
  getSetKeys().forEach(key => resetDifficultyProgress(key));

  resultText.textContent = `✅ All study progress has been reset!`;
  resultText.className = "result-text correct";

  renderProgressDashboard();

  setTimeout(() => {
    resultText.textContent = "";
  }, 3000);
}

function showResetModal(difficulty = null) {
  const modal = document.getElementById("resetModal");
  const title = document.getElementById("resetModalTitle");
  const message = document.getElementById("resetModalMessage");

  if (difficulty === null) {
    title.textContent = "Reset All Progress?";
    message.textContent = `This will reset ALL study progress for the ${getActiveList().title}. Your difficult words will be preserved. This action cannot be undone.`;
  } else {
    const label = getSetLabel(difficulty);
    title.textContent = `Reset ${label}?`;
    message.textContent = `This will reset your progress for ${label}. Your difficult words will be preserved. This action cannot be undone.`;
  }

  modal.style.display = "flex";

  // Set up one-time handlers
  const confirmBtn = document.getElementById("confirmResetBtn");
  const cancelBtn = document.getElementById("cancelResetBtn");

  const handleConfirm = () => {
    confirmReset(difficulty);
    cleanup();
  };

  const handleCancel = () => {
    hideResetModal();
    cleanup();
  };

  const handleBackground = (e) => {
    if (e.target === modal) {
      handleCancel();
    }
  };

  const cleanup = () => {
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
    modal.removeEventListener("click", handleBackground);
  };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);

  // Close on background click
  modal.addEventListener("click", handleBackground);
}

function hideResetModal() {
  const modal = document.getElementById("resetModal");
  modal.style.display = "none";
}

function confirmReset(difficulty) {
  if (difficulty === null) {
    resetAllProgress();
  } else {
    resetDifficultyProgress(difficulty);
  }
  hideResetModal();
}

// =============================
//  Difficult Words Functions
// =============================

function initializeDifficultWords(difficulty) {
  if (!studyProgress[difficulty].difficultWords) {
    studyProgress[difficulty].difficultWords = [];
  }
}

function markWordAsDifficult(wordObj, difficulty) {
  // Safeguard: never allow difficulty="all"
  if (difficulty === "all" || !difficulty) {
    console.error("Invalid difficulty:", difficulty, "for word:", wordObj.word);
    alert("Error: Cannot mark word without a word set. Please choose a specific word set.");
    return false;
  }

  // Validate difficulty is valid
  if (!studyProgress[difficulty]) {
    console.error("Invalid difficulty level:", difficulty);
    return false;
  }

  initializeDifficultWords(difficulty);

  // Check if already marked
  const existing = studyProgress[difficulty].difficultWords.find(
    w => w.word.toLowerCase() === wordObj.word.toLowerCase()
  );

  if (existing) {
    return false; // Already marked
  }

  // Add to difficult words
  studyProgress[difficulty].difficultWords.push({
    word: wordObj.word,
    definition: wordObj.definition,
    sentence: wordObj.sentence,
    difficulty: difficulty,
    markedDate: todayString(),
    reviewCount: 0,
    lastReviewDate: null
  });

  saveStudyProgress();

  console.log("Word marked as difficult:", wordObj.word, "Difficulty:", difficulty);

  return true; // Successfully marked
}

function unmarkWordAsDifficult(word, difficulty) {
  if (!studyProgress[difficulty] || !studyProgress[difficulty].difficultWords) return false;

  const index = studyProgress[difficulty].difficultWords.findIndex(
    w => w.word.toLowerCase() === word.toLowerCase()
  );

  if (index === -1) return false;

  studyProgress[difficulty].difficultWords.splice(index, 1);
  saveStudyProgress();
  return true;
}

function isWordMarkedDifficult(wordObj, difficulty) {
  if (!studyProgress[difficulty] || !studyProgress[difficulty].difficultWords) return false;

  return studyProgress[difficulty].difficultWords.some(
    w => w.word.toLowerCase() === wordObj.word.toLowerCase()
  );
}

function getAllDifficultWords(filterDifficulty = "all") {
  let difficultWords = [];

  if (filterDifficulty === "all") {
    getSetKeys().forEach(diff => {
      if (studyProgress[diff].difficultWords) {
        difficultWords = difficultWords.concat(studyProgress[diff].difficultWords);
      }
    });
  } else if (studyProgress[filterDifficulty] && studyProgress[filterDifficulty].difficultWords) {
    difficultWords = studyProgress[filterDifficulty].difficultWords;
  }

  return difficultWords;
}

function getDifficultWordsCount() {
  return getAllDifficultWords("all").length;
}

function clearAllDifficultWords(filterDifficulty = "all") {
  if (filterDifficulty === "all") {
    getSetKeys().forEach(diff => {
      studyProgress[diff].difficultWords = [];
    });
  } else {
    studyProgress[filterDifficulty].difficultWords = [];
  }
  saveStudyProgress();
}

function updateDifficultWordReview(word, difficulty) {
  if (!studyProgress[difficulty] || !studyProgress[difficulty].difficultWords) return;

  const wordData = studyProgress[difficulty].difficultWords.find(
    w => w.word.toLowerCase() === word.toLowerCase()
  );

  if (wordData) {
    wordData.reviewCount += 1;
    wordData.lastReviewDate = todayString();
    saveStudyProgress();
  }
}

function setCurrentWord(wordObj) {
  currentWordObj = wordObj;
  currentWordAnswered = false;
  resultText.textContent = "";
  resultText.className = "result-text";
  answerInput.value = "";
  answerInput.focus();

  setInfoMessage("Listen to the word and type the spelling. Stuck? Ask the pronouncer.");
  showPronouncer(wordObj);
  refreshAudioBadges();

  hideNextWordButton();
  hideMarkDifficultTestButton();
}

function updateScoreDisplay() {
  scoreText.textContent = `Score: ${correctCount} / ${totalAttempts}`;
  if ((currentMode === "quiz" || isTestPhase()) && quizWords.length > 0) {
    progressText.textContent = `Question ${Math.min(quizIndex + 1, quizWords.length)} of ${quizWords.length}`;
  } else {
    progressText.textContent = "";
  }
}

function showNextWordButton() {
  nextWordBtn.style.display = "block";
}

function hideNextWordButton() {
  nextWordBtn.style.display = "none";
}

function showMarkDifficultTestButton() {
  if (!markDifficultTestBtn) return;
  markDifficultTestBtn.style.display = "block";
  updateMarkDifficultTestButton();
}

function hideMarkDifficultTestButton() {
  if (!markDifficultTestBtn) return;
  markDifficultTestBtn.style.display = "none";
}

function updateMarkDifficultTestButton() {
  if (!markDifficultTestBtn || !currentWordObj) return;

  const difficulty = currentWordObj.difficulty || currentDifficulty;
  const isMarked = isWordMarkedDifficult(currentWordObj, difficulty);

  if (isMarked) {
    markDifficultTestBtn.textContent = "⭐ Already Marked as Difficult";
    markDifficultTestBtn.classList.add("marked");
    markDifficultTestBtn.disabled = true;
  } else {
    markDifficultTestBtn.textContent = "⭐ Mark as Difficult";
    markDifficultTestBtn.classList.remove("marked");
    markDifficultTestBtn.disabled = false;
  }
}

// =============================
//  Mode Logic
// =============================

function startPractice() {
  cancelTransition();
  currentMode = "practice";
  studyPhase = "none";
  reviewTarget = null;
  quizWords = [];
  quizIndex = 0;
  showPracticeUI();
  updateScoreDisplay();

  const wordObj = pickRandomWord();
  if (!wordObj) return;
  setCurrentWord(wordObj);
  playWord(wordObj);
}

function startQuiz() {
  cancelTransition();
  currentMode = modeSelect.value;

  if (currentMode === "practice") {
    startPractice();
    return;
  }

  if (currentMode === "study") {
    startStudyMode();
    return;
  }

  if (currentMode === "reviewDifficult") {
    startReviewDifficultWords();
    return;
  }

  studyPhase = "none";
  reviewTarget = null;
  showPracticeUI();

  const availableWords = getSelectedWords();
  const numQuestions = Math.min(10, availableWords.length);
  quizWords = shuffleArray(availableWords).slice(0, numQuestions);
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;

  BeeAudio.prefetch(quizWords);
  loadQuizWord();
}

function loadQuizWord() {
  if (quizIndex >= quizWords.length) {
    // Check if this is a study test, review test or difficult words test
    if (isTestPhase()) {
      completeStudyTest();
      return;
    }

    // Regular quiz completion
    resultText.textContent = `Quiz complete! You scored ${correctCount} out of ${totalAttempts}.`;
    resultText.className = "result-text correct";
    setInfoMessage("You can switch back to Practice mode or start a new quiz.");
    progressText.textContent = "";
    hideNextWordButton();
    hidePronouncer();
    return;
  }

  const wordObj = quizWords[quizIndex];
  setCurrentWord(wordObj);
  updateScoreDisplay();
  playWord(wordObj);
}

// =============================
//  Study Mode Functions
// =============================

function initializeStudyModeDOM() {
  // Get references to study mode elements after HTML is loaded
  studyPhaseIndicator = document.getElementById("studyPhaseIndicator");
  studyProgressText = document.getElementById("studyProgressText");
  studyControls = document.getElementById("studyControls");
  prevStudyWordBtn = document.getElementById("prevStudyWordBtn");
  nextStudyWordBtn = document.getElementById("nextStudyWordBtn");
  startTestBtn = document.getElementById("startTestBtn");
  studyCard = document.getElementById("studyCard");
  studyWordText = document.getElementById("studyWordText");
  hearStudyWordBtn = document.getElementById("hearStudyWordBtn");
  studyDetails = document.getElementById("studyDetails");
  studyDashboard = document.getElementById("studyDashboard");
  progressBars = document.getElementById("progressBars");
  continueStudyBtn = document.getElementById("continueStudyBtn");
  bookmarkBtn = document.getElementById("bookmarkBtn");
}

function startStudyMode() {
  cancelTransition();
  currentMode = "study";
  studyPhase = "dashboard";
  reviewTarget = null;

  // Study mode requires a specific set, not "all"
  if (currentDifficulty === "all") {
    currentDifficulty = getDefaultStudySet();
    difficultySelect.value = currentDifficulty;
  }

  // Hide practice/quiz UI
  document.querySelector(".word-controls").style.display = "none";
  document.querySelector(".input-row").style.display = "none";
  document.querySelector(".info").style.display = "none";
  nextWordBtn.style.display = "none";
  hideMarkDifficultTestButton();
  hidePronouncer();

  // Show dashboard
  renderProgressDashboard();
}

function startStudyGroup(groupIndex) {
  cancelTransition();
  studyPhase = "studying";
  studyGroupIndex = groupIndex;
  studyCurrentWordIndex = 0;
  studyTestResults = [];

  // Ensure we have a valid set (not "all")
  if (currentDifficulty === "all") {
    currentDifficulty = getDefaultStudySet();
    difficultySelect.value = currentDifficulty;
  }

  // Get the 10 words for this group from the CURRENT set
  studyWords = getStudyGroupWords(currentDifficulty, groupIndex);

  if (studyWords.length === 0) {
    alert("No words available for this group.");
    return;
  }

  console.log("Study Group Started:", {
    difficulty: currentDifficulty,
    groupIndex: groupIndex,
    wordsInGroup: studyWords.length,
    words: studyWords.map(w => w.word)
  });

  // Start finding real recordings for the group
  BeeAudio.prefetch(studyWords);

  // Show study phase UI
  showStudyPhaseUI();

  // Load first word
  loadStudyWord(0);
}

function showStudyPhaseUI() {
  // Hide dashboard, practice, and quiz UI
  if (studyDashboard) studyDashboard.style.display = "none";
  document.querySelector(".word-controls").style.display = "none";
  document.querySelector(".input-row").style.display = "none";
  document.querySelector(".info").style.display = "none";
  nextWordBtn.style.display = "none";
  hideMarkDifficultTestButton();
  hidePronouncer();
  resultText.textContent = "";

  // Show study UI
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "block";
  if (studyControls) studyControls.style.display = "flex";
  if (studyCard) studyCard.style.display = "block";

  // Update phase text
  setPhaseText("Study Phase");
}

function showTestPhaseUI() {
  // Hide study UI
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "block";
  if (studyControls) studyControls.style.display = "none";
  if (studyCard) studyCard.style.display = "none";

  // Show quiz UI
  document.querySelector(".word-controls").style.display = "flex";
  document.querySelector(".input-row").style.display = "flex";
  document.querySelector(".info").style.display = "block";

  // Update phase text
  setPhaseText("Test Phase");
}

function loadStudyWord(indexInGroup) {
  studyCurrentWordIndex = indexInGroup;
  const wordObj = studyWords[indexInGroup];

  if (!wordObj) return;

  // Display word with all information visible
  if (studyWordText) studyWordText.textContent = wordObj.word;
  if (studyDetails) studyDetails.innerHTML = renderWordDetails(wordObj);
  refreshAudioBadges();

  // Update progress indicator
  updateStudyProgressIndicator();

  // Update mark difficult button state
  updateMarkDifficultButton();

  // Enable/disable navigation buttons
  if (prevStudyWordBtn) {
    prevStudyWordBtn.disabled = (indexInGroup === 0);
  }
  if (nextStudyWordBtn) {
    nextStudyWordBtn.disabled = (indexInGroup === studyWords.length - 1);
  }

  // Show "Start Test" button if at the end of study or review phase
  if (startTestBtn) {
    const showTest = (indexInGroup === studyWords.length - 1) &&
                      (studyPhase === "studying" || studyPhase === "reviewingDifficult");
    startTestBtn.style.display = showTest ? "block" : "none";
  }
}

function updateStudyProgressIndicator() {
  if (!studyProgressText) return;

  const wordNum = studyCurrentWordIndex + 1;
  const totalWords = studyWords.length;

  if (studyPhase === "reviewingDifficult") {
    studyProgressText.textContent = `Word ${wordNum}/${totalWords}`;
    return;
  }

  const groupNum = studyGroupIndex + 1;
  const totalGroups = studyProgress[currentDifficulty].totalGroups;
  studyProgressText.textContent = `${getSetBadge(currentDifficulty)} • Group ${groupNum}/${totalGroups} • Word ${wordNum}/${totalWords}`;
}

function nextStudyWord() {
  if (studyCurrentWordIndex < studyWords.length - 1) {
    loadStudyWord(studyCurrentWordIndex + 1);
  }
}

function prevStudyWord() {
  if (studyCurrentWordIndex > 0) {
    loadStudyWord(studyCurrentWordIndex - 1);
  }
}

function startStudyTest() {
  studyPhase = "testing";

  // Make sure we have study words
  if (!studyWords || studyWords.length === 0) {
    alert("No study words available. Please study a group first.");
    return;
  }

  // Create a shuffled copy of ONLY the study words for testing
  quizWords = shuffleArray(studyWords.slice()); // .slice() creates a copy
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;
  studyTestResults = [];

  console.log("Study Test Starting:", {
    studyWordsCount: studyWords.length,
    quizWordsCount: quizWords.length,
    studyWords: studyWords.map(w => w.word),
    quizWords: quizWords.map(w => w.word)
  });

  // Show test UI
  showTestPhaseUI();

  // Load first test word
  loadQuizWord();
}

function completeStudyTest() {
  // Handle review difficult mode differently
  if (studyPhase === "testingDifficult") {
    completeReviewDifficultTest();
    return;
  }

  // Scheduled review tests update the review schedule only
  if (studyPhase === "testingReview") {
    completeScheduledReview();
    return;
  }

  // Calculate score
  const score = correctCount;
  const total = studyWords.length;

  // Mark group as complete and schedule its first review test
  markGroupComplete(currentDifficulty, studyGroupIndex);
  const review = recordGroupTest(currentDifficulty, studyGroupIndex, score, total);
  const reviewNote = `This group will be ready for a review test ${describeDue(review.nextDue)}.`;

  // Show results
  resultText.textContent = `Test complete! You scored ${score} out of ${total}.`;
  resultText.className = "result-text correct";

  // Check if there are more groups
  const nextGroup = getNextStudyGroup(currentDifficulty);
  const totalGroups = studyProgress[currentDifficulty].totalGroups;
  const allDone = studyProgress[currentDifficulty].completedGroups.length >= totalGroups;

  if (!allDone && nextGroup < totalGroups) {
    setInfoMessage(`Great job! Moving to next group (${nextGroup + 1}/${totalGroups})...`, reviewNote);

    // Auto-advance to next group after a few seconds
    scheduleTransition(() => startStudyGroup(nextGroup), 3000);
  } else {
    setInfoMessage(`Congratulations! You've completed all ${totalGroups} groups in ${getSetLabel(currentDifficulty)}!`, reviewNote);

    // Return to dashboard after a few seconds
    scheduleTransition(() => startStudyMode(), 3500);
  }

  progressText.textContent = "";
  hideNextWordButton();
  hidePronouncer();
}

// =============================
//  Review Difficult Words Mode
// =============================

function startReviewDifficultWords() {
  cancelTransition();
  const difficultWords = getAllDifficultWords("all").map(hydrateWord);

  console.log("Starting Review Difficult Words Mode:", {
    total: difficultWords.length,
    words: difficultWords.map(w => `${w.word} (${w.difficulty})`)
  });

  if (difficultWords.length === 0) {
    alert("No difficult words to review yet. Mark words as difficult during study or test phases.");
    return;
  }

  // Set up review mode
  studyPhase = "reviewingDifficult";
  studyGroupIndex = 0;
  studyCurrentWordIndex = 0;

  // Use all difficult words as study words
  studyWords = difficultWords;
  BeeAudio.prefetch(studyWords);

  // Show study phase UI
  showStudyPhaseUI();

  // Update phase indicator
  setPhaseText("Reviewing Difficult Words");

  // Load first word
  loadStudyWord(0);

  // Note: Test button visibility is managed by loadStudyWord()
  // It will show when user reaches the last word in the review
}

function startReviewDifficultTest() {
  const difficultWords = getAllDifficultWords("all").map(hydrateWord);

  if (difficultWords.length === 0) {
    alert("No difficult words to test.");
    return;
  }

  studyPhase = "testingDifficult";

  // Create shuffled copy for testing
  quizWords = shuffleArray(difficultWords.slice());
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;
  studyTestResults = [];

  console.log("Starting Difficult Words Test:", {
    totalWords: quizWords.length,
    words: quizWords.map(w => `${w.word} (${w.difficulty})`)
  });

  // Show test UI
  showTestPhaseUI();

  // Update phase indicator
  setPhaseText("Testing Difficult Words");

  // Update progress text
  if (studyProgressText) {
    studyProgressText.textContent = `Testing all ${quizWords.length} difficult words`;
  }

  // Load first test word
  loadQuizWord();
}

function completeReviewDifficultTest() {
  const score = correctCount;
  const total = quizWords.length;

  // Show results
  resultText.textContent = `Test complete! You scored ${score} out of ${total}.`;
  resultText.className = "result-text correct";

  setInfoMessage("Great job reviewing your difficult words!", "Words you got correct will remain in your difficult list. Keep practicing!");

  progressText.textContent = "";
  hideNextWordButton();
  hidePronouncer();

  // Return to dashboard after a few seconds
  scheduleTransition(() => startStudyMode(), 3000);
}

// =============================
//  Difficult Words UI Functions
// =============================

function updateDifficultWordsDisplay() {
  const countEl = document.getElementById("difficultWordsCount");
  if (!countEl) return;

  const count = getDifficultWordsCount();
  countEl.textContent = `${count} word${count !== 1 ? 's' : ''}`;

  // Update button states
  const reviewBtn = document.getElementById("reviewDifficultBtn");
  const manageBtn = document.getElementById("manageDifficultBtn");

  if (reviewBtn) {
    reviewBtn.disabled = count === 0;
    reviewBtn.style.opacity = count === 0 ? "0.5" : "1";
  }

  if (manageBtn) {
    manageBtn.disabled = count === 0;
    manageBtn.style.opacity = count === 0 ? "0.5" : "1";
  }
}

function showDifficultWordsModal() {
  const modal = document.getElementById("difficultWordsModal");
  modal.style.display = "flex";

  // Render list
  const filter = document.getElementById("difficultWordsFilter");
  if (filter) filter.value = "all";
  renderDifficultWordsList("all");
}

function hideDifficultWordsModal() {
  const modal = document.getElementById("difficultWordsModal");
  modal.style.display = "none";
}

function renderDifficultWordsList(filterDifficulty) {
  const listContainer = document.getElementById("difficultWordsList");
  if (!listContainer) return;

  const difficultWords = getAllDifficultWords(filterDifficulty);

  if (difficultWords.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <h4>No difficult words</h4>
        <p>Mark words as difficult during study or test to build your practice list.</p>
      </div>
    `;
    return;
  }

  let html = "";
  difficultWords.forEach(wordData => {
    const reviewText = wordData.reviewCount > 0
      ? `Reviewed ${wordData.reviewCount} time${wordData.reviewCount !== 1 ? 's' : ''}`
      : "Not reviewed yet";

    html += `
      <div class="difficult-word-item">
        <div class="difficult-word-info">
          <div class="word">${escapeHtml(wordData.word)} <small>${escapeHtml(getSetBadge(wordData.difficulty))}</small></div>
          <div class="meta">${reviewText}</div>
        </div>
        <div class="difficult-word-actions">
          <button class="unmark-btn" data-word="${escapeHtml(wordData.word)}" data-difficulty="${wordData.difficulty}">
            ✓ Remove
          </button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  // Add event listeners for unmark buttons
  listContainer.querySelectorAll(".unmark-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const word = e.currentTarget.dataset.word;
      const difficulty = e.currentTarget.dataset.difficulty;
      unmarkWordAsDifficult(word, difficulty);
      renderDifficultWordsList(filterDifficulty);
      updateDifficultWordsDisplay();
    });
  });
}

function updateMarkDifficultButton() {
  const markBtn = document.getElementById("markDifficultBtn");
  if (!markBtn || !studyWords[studyCurrentWordIndex]) return;

  const currentWord = studyWords[studyCurrentWordIndex];
  const isMarked = isWordMarkedDifficult(currentWord, currentWord.difficulty || currentDifficulty);

  if (isMarked) {
    markBtn.textContent = "⭐ Marked as Difficult";
    markBtn.classList.add("marked");
    markBtn.disabled = true;
  } else {
    markBtn.textContent = "⭐ Mark as Difficult";
    markBtn.classList.remove("marked");
    markBtn.disabled = false;
  }
}

// =============================
//  Dashboard
// =============================

// Words in a set whose groups haven't been studied and tested yet
function wordsLeftToStudy(key) {
  const progress = studyProgress[key];
  const done = progress.completedGroups.reduce((sum, g) => sum + getStudyGroupWords(key, g).length, 0);
  return Math.max(0, getSetWords(key).length - done);
}

function renderBeeCountdown() {
  const box = document.getElementById("beeCountdown");
  if (!box) return;

  const today = todayString();
  const nextBee = (getActiveList().events || []).find(e => e.end >= today);
  if (!nextBee) {
    box.style.display = "none";
    return;
  }

  const days = daysBetween(today, nextBee.start);
  const when = days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : "now — good luck!";

  const grade = getGrade();
  const wordsLeft = getGradeSetKeys().reduce((sum, key) => sum + wordsLeftToStudy(key), 0);
  const range = grade ? ` (${grade.range})` : "";
  let pace;
  if (wordsLeft === 0) {
    pace = `You've studied every word${range}. Keep up the review tests! 🎉`;
  } else if (days > 0) {
    pace = `${wordsLeft} words left to study${range} — about ${Math.ceil(wordsLeft / days)} new words a day.`;
  } else {
    pace = `${wordsLeft} words left to study${range}.`;
  }

  box.innerHTML = `
    <div class="countdown-title">🏆 ${escapeHtml(nextBee.name)} ${escapeHtml(when)}</div>
    <div class="countdown-dates">${escapeHtml(formatEventDates(nextBee))}</div>
    <div class="countdown-pace">${escapeHtml(pace)}</div>
  `;
  box.style.display = "block";
}

function renderDueReviews() {
  const box = document.getElementById("dueReviews");
  if (!box) return;

  const today = todayString();
  const due = getDueReviews();
  const upcoming = getAllReviews().find(r => r.nextDue > today);

  let html = "<h4>📅 Review Tests</h4>";
  if (due.length) {
    html += '<p class="due-note">Testing again a few days after studying helps the words stick. Ready now:</p><ul class="due-list">';
    due.forEach(r => {
      html += `
        <li>
          <span>${escapeHtml(getSetBadge(r.setKey))} · Group ${r.groupIndex + 1} <small>(last score ${escapeHtml(r.lastScore)})</small></span>
          <button class="review-test-btn" data-set="${r.setKey}" data-group="${r.groupIndex}">Test now</button>
        </li>
      `;
    });
    html += "</ul>";
  } else if (upcoming) {
    html += `<p class="due-note">Nothing due today. Next review: ${escapeHtml(getSetBadge(upcoming.setKey))} · Group ${upcoming.groupIndex + 1} ${escapeHtml(describeDue(upcoming.nextDue))}.</p>`;
  } else {
    html += '<p class="due-note">After you study and test a group, it comes back for a review test the next day.</p>';
  }
  box.innerHTML = html;
}

function renderProgressDashboard() {
  if (!studyDashboard || !progressBars) return;

  studyDashboard.style.display = "block";

  // Hide other UI
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "none";
  if (studyControls) studyControls.style.display = "none";
  if (studyCard) studyCard.style.display = "none";

  // Update difficult words display
  updateDifficultWordsDisplay();

  // Countdown, grade, and review tests
  renderBeeCountdown();
  populateGradeSelect();
  renderDueReviews();

  // Generate progress display
  let html = "";

  getActiveList().sets.forEach(set => {
    const progress = studyProgress[set.key];
    const completed = progress.completedGroups.length;
    const total = progress.totalGroups;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    html += `
      <div class="progress-item">
        <div class="progress-header">
          <span class="difficulty-label">${escapeHtml(set.label)}${set.tier ? ` <small class="set-tier">${escapeHtml(set.tier)}</small>` : ""}</span>
          <span class="progress-stats">${completed}/${total} groups</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <button class="reset-difficulty-btn" data-difficulty="${set.key}">🔄 Reset</button>
      </div>
    `;
  });

  progressBars.innerHTML = html;

  // Update dashboard message
  const studySet = currentDifficulty !== "all" ? currentDifficulty : getDefaultStudySet();
  const currentProgress = studyProgress[studySet];
  const nextGroup = currentProgress.currentGroup;
  const totalGroups = currentProgress.totalGroups;

  if (currentProgress.completedGroups.length < totalGroups && nextGroup < totalGroups) {
    resultText.textContent = `Ready to study! Next up: ${getSetLabel(studySet)} · Group ${nextGroup + 1} of ${totalGroups}`;
    resultText.className = "result-text";
  } else {
    resultText.textContent = `All groups completed for ${getSetLabel(studySet)}! 🎉`;
    resultText.className = "result-text correct";
  }

  setInfoMessage("Pick a word set and click “Continue Studying” to begin.");
}

// =============================
//  Bookmark Functions
// =============================

function createBookmark() {
  if (studyPhase !== "studying") {
    alert("You can only bookmark during study phase.");
    return;
  }

  const groupNum = studyGroupIndex + 1;
  const totalGroups = studyProgress[currentDifficulty].totalGroups;

  studyProgress[currentDifficulty].bookmark = {
    groupIndex: studyGroupIndex,
    description: `Group ${groupNum}/${totalGroups}: words ${studyGroupIndex * 10 + 1}-${studyGroupIndex * 10 + studyWords.length}`
  };

  saveStudyProgress();

  resultText.textContent = `📌 Bookmarked! Group ${groupNum} saved for later.`;
  resultText.className = "result-text correct";

  setTimeout(() => {
    resultText.textContent = "";
  }, 2000);
}

function resumeFromBookmark() {
  const bookmark = studyProgress[currentDifficulty].bookmark;

  if (!bookmark) {
    alert("No bookmark found for this word set.");
    return;
  }

  startStudyGroup(bookmark.groupIndex);
}

function clearBookmark(difficulty) {
  if (studyProgress[difficulty]) {
    studyProgress[difficulty].bookmark = null;
    saveStudyProgress();
  }
}

// =============================
//  Events
// =============================

listSelect.addEventListener("change", () => {
  switchWordList(listSelect.value);
});

playWordBtn.addEventListener("click", () => {
  if (!currentWordObj) {
    startPractice();
    return;
  }
  playWord(currentWordObj);
});

repeatBtn.addEventListener("click", () => {
  if (currentWordObj) {
    playWord(currentWordObj);
  }
});

slowBtn.addEventListener("click", () => {
  if (currentWordObj) {
    playWord(currentWordObj, { slow: true });
  }
});

hintBtn.addEventListener("click", () => {
  if (!currentWordObj || currentWordAnswered) return;
  resultText.textContent = spellingHint(currentWordObj.word);
  resultText.className = "result-text";
});

pronouncerPanel.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-ask]");
  if (btn) askPronouncer(btn.dataset.ask);
});

checkBtn.addEventListener("click", () => {
  if (!currentWordObj || currentWordAnswered) return;

  const userAnswer = answerInput.value.trim();
  if (!userAnswer) return;

  currentWordAnswered = true;
  totalAttempts += 1;
  const isCorrect = isCorrectSpelling(userAnswer, currentWordObj);

  if (isCorrect) {
    correctCount += 1;
    const accentNote = userAnswer.normalize("NFC").toLowerCase() !== currentWordObj.word.normalize("NFC").toLowerCase() &&
      stripAccents(currentWordObj.word) !== currentWordObj.word
      ? ` (With its accent it's written “${currentWordObj.word}”.)`
      : "";
    const altsNote = currentWordObj.alts && currentWordObj.alts.length
      ? ` Accepted spellings: ${formatAcceptedSpellings(currentWordObj)}.`
      : "";
    resultText.textContent = `✅ Correct!${accentNote}${altsNote}`;
    resultText.className = "result-text correct";
  } else {
    resultText.textContent = `❌ Incorrect. Correct spelling: ${formatAcceptedSpellings(currentWordObj)}`;
    resultText.className = "result-text incorrect";

    // Auto-mark incorrect words as difficult during tests and in practice/quiz modes
    if (isAnswering()) {
      const difficulty = currentWordObj.difficulty || currentDifficulty;
      console.log("Auto-marking incorrect word:", currentWordObj.word, "Difficulty:", difficulty);
      const marked = markWordAsDifficult(currentWordObj, difficulty);
      if (marked) {
        updateDifficultWordsDisplay(); // Update count immediately
      }
    }
  }

  // Track results for study mode
  if (isTestPhase()) {
    studyTestResults.push({
      word: currentWordObj.word,
      correct: isCorrect,
      userAnswer: userAnswer
    });
  }

  // Reveal the full word card
  hidePronouncer();
  showWordDetails(currentWordObj);
  refreshAudioBadges();

  updateScoreDisplay();

  // Show the Next Word button after checking
  showNextWordButton();

  // Show Mark as Difficult button in test phases and practice/quiz modes
  if (isAnswering()) {
    showMarkDifficultTestButton();
  }
});

nextWordBtn.addEventListener("click", () => {
  // In quiz mode OR any test phase, continue with quiz words
  if (currentMode === "quiz" || isTestPhase()) {
    quizIndex += 1;
    loadQuizWord();
  } else {
    // In practice mode, pick a random word
    const wordObj = pickRandomWord();
    if (!wordObj) return;
    setCurrentWord(wordObj);
    playWord(wordObj);
  }
});

startQuizBtn.addEventListener("click", () => {
  startQuiz();
});

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;
  cancelTransition();
  if (mode === "practice") {
    currentMode = "practice";
    studyPhase = "none";
    startPractice();
  } else if (mode === "study") {
    currentMode = "study";
    studyPhase = "none";
    resultText.textContent = "Study mode selected. Click Start to begin studying.";
    resultText.className = "result-text";
  } else if (mode === "reviewDifficult") {
    currentMode = "reviewDifficult";
    studyPhase = "none";
    resultText.textContent = "Review difficult words selected. Click Start to begin.";
    resultText.className = "result-text";
  } else {
    currentMode = "quiz";
    studyPhase = "none";
    resultText.textContent = "Quiz mode selected. Click Start to begin a 10-word quiz.";
    resultText.className = "result-text";
  }
});

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // After checking, Enter moves on to the next word
    if (currentWordAnswered && nextWordBtn.style.display !== "none") {
      nextWordBtn.click();
    } else {
      checkBtn.click();
    }
  }
});

difficultySelect.addEventListener("change", () => {
  currentDifficulty = difficultySelect.value;

  // Reset the current session when the word set changes
  if (currentMode === "practice") {
    startPractice();
  } else if (currentMode === "study") {
    // Exit study phase and return to dashboard
    startStudyMode();
  } else {
    resultText.textContent = "Word set changed. Click Start to begin a new quiz.";
    resultText.className = "result-text";
    quizWords = [];
    quizIndex = 0;
    correctCount = 0;
    totalAttempts = 0;
    updateScoreDisplay();
  }
});

BeeAudio.init();
BeeAudio.onChange(() => refreshAudioBadges());

// Initialize study mode
loadStudyProgress();
populateListSelect();
updateListUI();

updateScoreDisplay();
resultText.textContent = 'Choose a mode and click "Play Word" or "Start" to begin.';
setInfoMessage("Definitions, sentences and word parts will appear after you check your answer.");

// Initialize DOM references when HTML is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeStudyModeDOM();

  BeeAudio.initSettingsUI({
    voiceSelect: document.getElementById("voiceSelect"),
    rateInput: document.getElementById("rateInput"),
    rateValue: document.getElementById("rateValue"),
    recordingsToggle: document.getElementById("useRecordingsToggle"),
    testBtn: document.getElementById("testVoiceBtn")
  });

  // Add event listeners for study mode controls
  if (prevStudyWordBtn) {
    prevStudyWordBtn.addEventListener("click", prevStudyWord);
  }

  if (nextStudyWordBtn) {
    nextStudyWordBtn.addEventListener("click", nextStudyWord);
  }

  if (startTestBtn) {
    startTestBtn.addEventListener("click", () => {
      if (studyPhase === "studying") {
        startStudyTest();
      } else if (studyPhase === "reviewingDifficult") {
        startReviewDifficultTest();
      }
    });
  }

  if (hearStudyWordBtn) {
    hearStudyWordBtn.addEventListener("click", () => {
      playWord(studyWords[studyCurrentWordIndex]);
    });
  }

  const slowStudyWordBtn = document.getElementById("slowStudyWordBtn");
  if (slowStudyWordBtn) {
    slowStudyWordBtn.addEventListener("click", () => {
      playWord(studyWords[studyCurrentWordIndex], { slow: true });
    });
  }

  const sayStudySentenceBtn = document.getElementById("sayStudySentenceBtn");
  if (sayStudySentenceBtn) {
    sayStudySentenceBtn.addEventListener("click", () => {
      const wordObj = studyWords[studyCurrentWordIndex];
      if (wordObj && wordObj.sentence) BeeAudio.speakText(sentenceForSpeech(wordObj));
    });
  }

  if (continueStudyBtn) {
    continueStudyBtn.addEventListener("click", () => {
      if (currentDifficulty === "all") {
        currentDifficulty = getDefaultStudySet();
        difficultySelect.value = currentDifficulty;
      }
      const nextGroup = getNextStudyGroup(currentDifficulty);
      startStudyGroup(nextGroup);
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener("click", createBookmark);
  }

  // Grade choice (which part of the list to study first)
  const gradeSelect = document.getElementById("gradeSelect");
  if (gradeSelect) {
    gradeSelect.addEventListener("change", () => {
      try {
        localStorage.setItem(GRADE_KEY, gradeSelect.value);
      } catch (e) {
        console.error("Error saving grade:", e);
      }
      currentDifficulty = getDefaultStudySet();
      difficultySelect.value = currentDifficulty;
      renderProgressDashboard();
    });
  }

  // Review test buttons (delegated)
  const dueReviews = document.getElementById("dueReviews");
  if (dueReviews) {
    dueReviews.addEventListener("click", (e) => {
      const btn = e.target.closest(".review-test-btn");
      if (btn) startScheduledReview(btn.dataset.set, Number(btn.dataset.group));
    });
  }

  // Reset All button
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      showResetModal(null);
    });
  }

  // Reset individual set buttons (delegated)
  if (progressBars) {
    progressBars.addEventListener("click", (e) => {
      if (e.target.classList.contains("reset-difficulty-btn")) {
        const difficulty = e.target.dataset.difficulty;
        showResetModal(difficulty);
      }
    });
  }

  // Mark difficult button
  const markDifficultBtn = document.getElementById("markDifficultBtn");
  if (markDifficultBtn) {
    markDifficultBtn.addEventListener("click", () => {
      if (studyWords[studyCurrentWordIndex]) {
        const currentWord = studyWords[studyCurrentWordIndex];
        const success = markWordAsDifficult(currentWord, currentWord.difficulty || currentDifficulty);

        if (success) {
          updateMarkDifficultButton();
          resultText.textContent = "⭐ Word marked as difficult!";
          resultText.className = "result-text correct";

          setTimeout(() => {
            resultText.textContent = "";
          }, 2000);
        }
      }
    });
  }

  // Mark as Difficult button for test phase
  if (markDifficultTestBtn) {
    markDifficultTestBtn.addEventListener("click", () => {
      if (!currentWordObj) return;

      const difficulty = currentWordObj.difficulty || currentDifficulty;
      console.log("Marking word as difficult:", currentWordObj.word, "Difficulty:", difficulty);
      const success = markWordAsDifficult(currentWordObj, difficulty);

      if (success) {
        updateMarkDifficultTestButton();
        updateDifficultWordsDisplay(); // Update count immediately
        resultText.textContent = resultText.textContent + " ⭐ Marked as difficult!";
        resultText.className = "result-text correct";
      } else {
        updateMarkDifficultTestButton();
      }
    });
  }

  // Review difficult words button
  const reviewDifficultBtn = document.getElementById("reviewDifficultBtn");
  if (reviewDifficultBtn) {
    reviewDifficultBtn.addEventListener("click", () => {
      startReviewDifficultWords();
    });
  }

  // Manage difficult words button
  const manageDifficultBtn = document.getElementById("manageDifficultBtn");
  if (manageDifficultBtn) {
    manageDifficultBtn.addEventListener("click", () => {
      showDifficultWordsModal();
    });
  }

  // Close difficult words modal
  const closeDifficultModal = document.getElementById("closeDifficultModal");
  if (closeDifficultModal) {
    closeDifficultModal.addEventListener("click", hideDifficultWordsModal);
  }

  // Difficult words filter
  const difficultWordsFilter = document.getElementById("difficultWordsFilter");
  if (difficultWordsFilter) {
    difficultWordsFilter.addEventListener("change", (e) => {
      renderDifficultWordsList(e.target.value);
    });
  }

  // Clear all difficult words
  const clearAllDifficultBtn = document.getElementById("clearAllDifficultBtn");
  if (clearAllDifficultBtn) {
    clearAllDifficultBtn.addEventListener("click", () => {
      const filter = document.getElementById("difficultWordsFilter").value;
      const which = filter === "all" ? "all" : getSetLabel(filter);
      if (confirm(`Are you sure you want to clear ${which} difficult words?`)) {
        clearAllDifficultWords(filter);
        renderDifficultWordsList(filter);
        updateDifficultWordsDisplay();
      }
    });
  }
});
