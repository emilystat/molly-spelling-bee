// =============================
//  Word Data
// =============================
// wordsData is loaded from words-data.js
// It contains oneBee, twoBee, and threeBee arrays

// =============================
//  App State
// =============================

let currentWordObj = null;
let currentMode = "practice"; // "practice" or "quiz"
let currentDifficulty = "all"; // "all", "oneBee", "twoBee", or "threeBee"
let quizWords = [];
let quizIndex = 0;
let correctCount = 0;
let totalAttempts = 0;

// DOM elements
const modeSelect = document.getElementById("modeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startQuizBtn = document.getElementById("startQuizBtn");
const playWordBtn = document.getElementById("playWordBtn");
const repeatBtn = document.getElementById("repeatBtn");
const hintBtn = document.getElementById("hintBtn");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");

const resultText = document.getElementById("resultText");
const definitionText = document.getElementById("definitionText");
const sentenceText = document.getElementById("sentenceText");
const scoreText = document.getElementById("scoreText");
const progressText = document.getElementById("progressText");

// =============================
//  Helpers
// =============================

function speak(text) {
  if (!window.speechSynthesis) {
    alert("Speech not supported in this browser.");
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.9; // slightly slower
  utter.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function pickRandomWord() {
  let availableWords = [];
  if (currentDifficulty === "all") {
    availableWords = [...wordsData.oneBee, ...wordsData.twoBee, ...wordsData.threeBee];
  } else {
    availableWords = wordsData[currentDifficulty];
  }

  if (!availableWords.length) {
    alert("No words available for the selected difficulty.");
    return null;
  }

  const idx = Math.floor(Math.random() * availableWords.length);
  return availableWords[idx];
}

function setCurrentWord(wordObj) {
  currentWordObj = wordObj;
  resultText.textContent = "";
  resultText.className = "result-text";
  answerInput.value = "";
  answerInput.focus();

  definitionText.textContent = "Listen to the word and try spelling it.";
  sentenceText.textContent = "";
}

function updateScoreDisplay() {
  scoreText.textContent = `Score: ${correctCount} / ${totalAttempts}`;
  if (currentMode === "quiz" && quizWords.length > 0) {
    progressText.textContent = `Question ${quizIndex + 1} of ${quizWords.length}`;
  } else {
    progressText.textContent = "";
  }
}

// =============================
//  Mode Logic
// =============================

function startPractice() {
  currentMode = "practice";
  quizWords = [];
  quizIndex = 0;
  updateScoreDisplay();

  const wordObj = pickRandomWord();
  if (!wordObj) return;
  setCurrentWord(wordObj);
  speak(`Spell the word: ${wordObj.word}`);
}

function startQuiz() {
  currentMode = modeSelect.value;

  if (currentMode === "practice") {
    startPractice();
    return;
  }

  let availableWords = [];
  if (currentDifficulty === "all") {
    availableWords = [...wordsData.oneBee, ...wordsData.twoBee, ...wordsData.threeBee];
  } else {
    availableWords = wordsData[currentDifficulty];
  }

  const numQuestions = Math.min(10, availableWords.length);
  quizWords = shuffleArray(availableWords).slice(0, numQuestions);
  quizIndex = 0;
  correctCount = 0;
  totalAttempts = 0;

  loadQuizWord();
}

function loadQuizWord() {
  if (quizIndex >= quizWords.length) {
    resultText.textContent = `Quiz complete! You scored ${correctCount} out of ${totalAttempts}.`;
    resultText.className = "result-text correct";
    definitionText.textContent = "You can switch back to Practice mode or start a new quiz.";
    sentenceText.textContent = "";
    progressText.textContent = "";
    return;
  }

  const wordObj = quizWords[quizIndex];
  setCurrentWord(wordObj);
  updateScoreDisplay();
  speak(`Spell the word: ${wordObj.word}`);
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// =============================
//  Events
// =============================

playWordBtn.addEventListener("click", () => {
  if (!currentWordObj) {
    startPractice();
    return;
  }
  speak(currentWordObj.word);
});

repeatBtn.addEventListener("click", () => {
  if (currentWordObj) {
    speak(currentWordObj.word);
  }
});

hintBtn.addEventListener("click", () => {
  if (!currentWordObj) return;
  const w = currentWordObj.word;
  const hint = `The word has ${w.length} letters and starts with "${w[0]}".`;
  resultText.textContent = hint;
  resultText.className = "result-text";
});

checkBtn.addEventListener("click", () => {
  if (!currentWordObj) return;

  const userAnswer = answerInput.value.trim();
  if (!userAnswer) return;

  totalAttempts += 1;

  if (userAnswer.toLowerCase() === currentWordObj.word.toLowerCase()) {
    correctCount += 1;
    resultText.textContent = "✅ Correct!";
    resultText.className = "result-text correct";
  } else {
    resultText.textContent = `❌ Incorrect. Correct spelling: ${currentWordObj.word}`;
    resultText.className = "result-text incorrect";
  }

  if (currentWordObj.definition) {
    definitionText.textContent = currentWordObj.definition;
  } else {
    definitionText.textContent = "No definition available yet.";
  }

  if (currentWordObj.sentence) {
    sentenceText.textContent = currentWordObj.sentence;
  } else {
    sentenceText.textContent = "";
  }

  updateScoreDisplay();

  if (currentMode === "quiz") {
    setTimeout(() => {
      quizIndex += 1;
      loadQuizWord();
    }, 1200);
  } else {
    setTimeout(() => {
      const wordObj = pickRandomWord();
      if (!wordObj) return;
      setCurrentWord(wordObj);
      speak(`Spell the word: ${wordObj.word}`);
    }, 1200);
  }
});

startQuizBtn.addEventListener("click", () => {
  startQuiz();
});

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;
  if (mode === "practice") {
    currentMode = "practice";
    startPractice();
  } else {
    currentMode = "quiz";
    resultText.textContent = "Quiz mode selected. Click Start to begin a 10-word quiz.";
    resultText.className = "result-text";
  }
});

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    checkBtn.click();
  }
});

difficultySelect.addEventListener("change", () => {
  currentDifficulty = difficultySelect.value;

  // Reset the current session when difficulty changes
  if (currentMode === "practice") {
    startPractice();
  } else {
    resultText.textContent = "Difficulty changed. Click Start to begin a new quiz.";
    resultText.className = "result-text";
    quizWords = [];
    quizIndex = 0;
    correctCount = 0;
    totalAttempts = 0;
    updateScoreDisplay();
  }
});

updateScoreDisplay();
resultText.textContent = "Choose a mode and click "Play Word" or "Start" to begin.";
definitionText.textContent = "Definitions and sentences will appear after you check your answer.";
sentenceText.textContent = "";
