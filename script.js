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

// Study Mode State
let studyPhase = "none"; // "none" | "studying" | "testing"
let studyGroupIndex = 0; // Which group of 10 (0-14 for 150 words)
let studyCurrentWordIndex = 0; // Position within group (0-9)
let studyWords = []; // Current 10 words for study
let studyProgress = null; // Loaded from localStorage
let studyTestResults = []; // Track test performance

// DOM elements
const modeSelect = document.getElementById("modeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startQuizBtn = document.getElementById("startQuizBtn");
const playWordBtn = document.getElementById("playWordBtn");
const repeatBtn = document.getElementById("repeatBtn");
const hintBtn = document.getElementById("hintBtn");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");
const nextWordBtn = document.getElementById("nextWordBtn");

const resultText = document.getElementById("resultText");
const definitionText = document.getElementById("definitionText");
const sentenceText = document.getElementById("sentenceText");
const scoreText = document.getElementById("scoreText");
const progressText = document.getElementById("progressText");

// Study Mode DOM elements (will be added to HTML)
let studyPhaseIndicator = null;
let studyProgressText = null;
let studyControls = null;
let prevStudyWordBtn = null;
let nextStudyWordBtn = null;
let startTestBtn = null;
let studyCard = null;
let studyWordText = null;
let hearStudyWordBtn = null;
let studyDefinition = null;
let studySentence = null;
let studyDashboard = null;
let progressBars = null;
let continueStudyBtn = null;
let bookmarkBtn = null;

// =============================
//  Helpers
// =============================

function speak(text) {
  if (!window.speechSynthesis) {
    alert("Speech not supported in this browser.");
    return;
  }

  console.log('Attempting to speak:', text);

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Chrome bug fix: resume if paused
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  // Create utterance
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.85; // slightly slower for clarity
  utter.pitch = 1;
  utter.volume = 1;
  utter.lang = 'en-US';

  // Get voices
  let voices = window.speechSynthesis.getVoices();
  console.log('Available voices:', voices.length);

  if (voices.length > 0) {
    // Try to find a good English voice
    const englishVoice = voices.find(v => v.lang === 'en-US' && v.localService === true) ||
                         voices.find(v => v.lang === 'en-US') ||
                         voices.find(v => v.lang.startsWith('en')) ||
                         voices[0];
    if (englishVoice) {
      utter.voice = englishVoice;
      console.log('Using voice:', englishVoice.name);
    }
  }

  // Event handlers for debugging
  utter.onstart = () => {
    console.log('Speech started');
  };

  utter.onend = () => {
    console.log('Speech ended');
  };

  utter.onerror = (event) => {
    console.error('Speech error:', event.error, event);
    alert('Speech error: ' + event.error + '. Please check browser permissions.');
  };

  // Speak
  console.log('Calling speechSynthesis.speak()');
  window.speechSynthesis.speak(utter);

  // Chrome workaround: if not speaking after 100ms, try again
  setTimeout(() => {
    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      console.log('Speech did not start, retrying...');
      window.speechSynthesis.speak(utter);
    }
  }, 100);
}

// Voice loading - crucial for Chrome
let voicesLoaded = false;

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  console.log('Voices loaded:', voices.length);
  if (voices.length > 0) {
    voicesLoaded = true;
  }
  return voices;
}

// Ensure voices are loaded
if (window.speechSynthesis) {
  loadVoices();

  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Force load voices for Chrome
  setTimeout(loadVoices, 100);
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

// =============================
//  Study Mode - localStorage Functions
// =============================

function initializeStudyProgress() {
  const progress = {
    oneBee: {
      completedGroups: [],
      currentGroup: 0,
      totalGroups: calculateTotalGroups("oneBee"),
      lastStudiedDate: null,
      bookmark: null,
      difficultWords: []
    },
    twoBee: {
      completedGroups: [],
      currentGroup: 0,
      totalGroups: calculateTotalGroups("twoBee"),
      lastStudiedDate: null,
      bookmark: null,
      difficultWords: []
    },
    threeBee: {
      completedGroups: [],
      currentGroup: 0,
      totalGroups: calculateTotalGroups("threeBee"),
      lastStudiedDate: null,
      bookmark: null,
      difficultWords: []
    },
    globalSettings: {}
  };
  return progress;
}

function loadStudyProgress() {
  try {
    const saved = localStorage.getItem("mollySpellingBee_studyProgress");
    if (saved) {
      studyProgress = JSON.parse(saved);
    } else {
      studyProgress = initializeStudyProgress();
      saveStudyProgress();
    }
  } catch (e) {
    console.error("Error loading study progress:", e);
    studyProgress = initializeStudyProgress();
  }
}

function saveStudyProgress() {
  try {
    localStorage.setItem("mollySpellingBee_studyProgress", JSON.stringify(studyProgress));
  } catch (e) {
    console.error("Error saving study progress:", e);
  }
}

function calculateTotalGroups(difficulty) {
  const words = wordsData[difficulty];
  if (!words) return 0;
  return Math.ceil(words.length / 10);
}

function getStudyGroupWords(difficulty, groupIndex) {
  const words = wordsData[difficulty];
  if (!words) return [];

  const startIdx = groupIndex * 10;
  const endIdx = Math.min(startIdx + 10, words.length);
  return words.slice(startIdx, endIdx);
}

function markGroupComplete(difficulty, groupIndex) {
  if (!studyProgress[difficulty].completedGroups.includes(groupIndex)) {
    studyProgress[difficulty].completedGroups.push(groupIndex);
  }
  studyProgress[difficulty].lastStudiedDate = new Date().toISOString().split('T')[0];

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
//  Reset Progress Functions
// =============================

function resetDifficultyProgress(difficulty) {
  if (!studyProgress[difficulty]) {
    console.error(`Invalid difficulty: ${difficulty}`);
    return;
  }

  // Preserve difficult words if they exist
  const preservedDifficultWords = studyProgress[difficulty].difficultWords || [];

  // Reset progress
  studyProgress[difficulty] = {
    completedGroups: [],
    currentGroup: 0,
    totalGroups: calculateTotalGroups(difficulty),
    lastStudiedDate: null,
    bookmark: null,
    difficultWords: preservedDifficultWords  // Preserve this
  };

  // Update global settings
  if (!studyProgress.globalSettings) {
    studyProgress.globalSettings = {};
  }
  studyProgress.globalSettings.lastResetDate = new Date().toISOString().split('T')[0];

  saveStudyProgress();

  // Show success message
  const labels = {
    oneBee: "One Bee (Easy)",
    twoBee: "Two Bee (Medium)",
    threeBee: "Three Bee (Hard)"
  };

  resultText.textContent = `✅ ${labels[difficulty]} progress has been reset!`;
  resultText.className = "result-text correct";

  // Re-render dashboard
  renderProgressDashboard();

  setTimeout(() => {
    resultText.textContent = "";
  }, 3000);
}

function resetAllProgress() {
  resetDifficultyProgress("oneBee");
  resetDifficultyProgress("twoBee");
  resetDifficultyProgress("threeBee");

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
    message.textContent = "This will reset ALL study progress across all difficulty levels. Your difficult words will be preserved. This action cannot be undone.";
  } else {
    const labels = {
      oneBee: "One Bee (Easy)",
      twoBee: "Two Bee (Medium)",
      threeBee: "Three Bee (Hard)"
    };
    title.textContent = `Reset ${labels[difficulty]}?`;
    message.textContent = `This will reset your progress for ${labels[difficulty]}. Your difficult words will be preserved. This action cannot be undone.`;
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

  const cleanup = () => {
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      handleCancel();
    }
  });
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
    markedDate: new Date().toISOString().split('T')[0],
    reviewCount: 0,
    lastReviewDate: null
  });

  saveStudyProgress();
  return true; // Successfully marked
}

function unmarkWordAsDifficult(word, difficulty) {
  if (!studyProgress[difficulty].difficultWords) return false;

  const index = studyProgress[difficulty].difficultWords.findIndex(
    w => w.word.toLowerCase() === word.toLowerCase()
  );

  if (index === -1) return false;

  studyProgress[difficulty].difficultWords.splice(index, 1);
  saveStudyProgress();
  return true;
}

function isWordMarkedDifficult(wordObj, difficulty) {
  if (!studyProgress[difficulty].difficultWords) return false;

  return studyProgress[difficulty].difficultWords.some(
    w => w.word.toLowerCase() === wordObj.word.toLowerCase()
  );
}

function getAllDifficultWords(filterDifficulty = "all") {
  let difficultWords = [];

  if (filterDifficulty === "all") {
    ["oneBee", "twoBee", "threeBee"].forEach(diff => {
      if (studyProgress[diff].difficultWords) {
        difficultWords = difficultWords.concat(studyProgress[diff].difficultWords);
      }
    });
  } else {
    if (studyProgress[filterDifficulty].difficultWords) {
      difficultWords = studyProgress[filterDifficulty].difficultWords;
    }
  }

  return difficultWords;
}

function getDifficultWordsCount() {
  return getAllDifficultWords("all").length;
}

function clearAllDifficultWords(filterDifficulty = "all") {
  if (filterDifficulty === "all") {
    ["oneBee", "twoBee", "threeBee"].forEach(diff => {
      studyProgress[diff].difficultWords = [];
    });
  } else {
    studyProgress[filterDifficulty].difficultWords = [];
  }
  saveStudyProgress();
}

function updateDifficultWordReview(word, difficulty) {
  if (!studyProgress[difficulty].difficultWords) return;

  const wordData = studyProgress[difficulty].difficultWords.find(
    w => w.word.toLowerCase() === word.toLowerCase()
  );

  if (wordData) {
    wordData.reviewCount += 1;
    wordData.lastReviewDate = new Date().toISOString().split('T')[0];
    saveStudyProgress();
  }
}

function setCurrentWord(wordObj) {
  currentWordObj = wordObj;
  resultText.textContent = "";
  resultText.className = "result-text";
  answerInput.value = "";
  answerInput.focus();

  definitionText.textContent = "Listen to the word and try spelling it.";
  sentenceText.textContent = "";

  hideNextWordButton();
}

function updateScoreDisplay() {
  scoreText.textContent = `Score: ${correctCount} / ${totalAttempts}`;
  if (currentMode === "quiz" && quizWords.length > 0) {
    progressText.textContent = `Question ${quizIndex + 1} of ${quizWords.length}`;
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

  if (currentMode === "study") {
    startStudyMode();
    return;
  }

  if (currentMode === "reviewDifficult") {
    startReviewDifficultWords();
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
    // Check if this is a study test or difficult words test
    if (studyPhase === "testing" || studyPhase === "testingDifficult") {
      completeStudyTest();
      return;
    }

    // Regular quiz completion
    resultText.textContent = `Quiz complete! You scored ${correctCount} out of ${totalAttempts}.`;
    resultText.className = "result-text correct";
    definitionText.textContent = "You can switch back to Practice mode or start a new quiz.";
    sentenceText.textContent = "";
    progressText.textContent = "";
    hideNextWordButton();
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
  studyDefinition = document.getElementById("studyDefinition");
  studySentence = document.getElementById("studySentence");
  studyDashboard = document.getElementById("studyDashboard");
  progressBars = document.getElementById("progressBars");
  continueStudyBtn = document.getElementById("continueStudyBtn");
  bookmarkBtn = document.getElementById("bookmarkBtn");
}

function startStudyMode() {
  currentMode = "study";
  studyPhase = "dashboard";

  // Study mode requires a specific difficulty, not "all"
  if (currentDifficulty === "all") {
    currentDifficulty = "oneBee";
    difficultySelect.value = "oneBee";
  }

  // Hide practice/quiz UI
  document.querySelector(".word-controls").style.display = "none";
  document.querySelector(".input-row").style.display = "none";
  document.querySelector(".info").style.display = "none";
  nextWordBtn.style.display = "none";

  // Show dashboard
  renderProgressDashboard();
}

function startStudyGroup(groupIndex) {
  studyPhase = "studying";
  studyGroupIndex = groupIndex;
  studyCurrentWordIndex = 0;
  studyTestResults = [];

  // Ensure we have a valid difficulty (not "all")
  if (currentDifficulty === "all") {
    currentDifficulty = "oneBee";
    difficultySelect.value = "oneBee";
  }

  // Get the 10 words for this group from the CURRENT difficulty
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
  resultText.textContent = "";

  // Show study UI
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "block";
  if (studyControls) studyControls.style.display = "flex";
  if (studyCard) studyCard.style.display = "block";

  // Update phase text
  if (document.getElementById("phaseText")) {
    document.getElementById("phaseText").textContent = "Study Phase";
  }
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
  if (document.getElementById("phaseText")) {
    document.getElementById("phaseText").textContent = "Test Phase";
  }
}

function loadStudyWord(indexInGroup) {
  studyCurrentWordIndex = indexInGroup;
  const wordObj = studyWords[indexInGroup];

  if (!wordObj) return;

  // Display word with all information visible
  if (studyWordText) studyWordText.textContent = wordObj.word;
  if (studyDefinition) studyDefinition.textContent = wordObj.definition || "No definition available.";
  if (studySentence) studySentence.textContent = wordObj.sentence || "";

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

  // Show "Start Test" button if at the end AND not in review mode
  if (startTestBtn) {
    const showTest = (indexInGroup === studyWords.length - 1) && studyPhase !== "reviewingDifficult";
    startTestBtn.style.display = showTest ? "block" : "none";
  }
}

function updateStudyProgressIndicator() {
  if (!studyProgressText) return;

  const groupNum = studyGroupIndex + 1;
  const totalGroups = studyProgress[currentDifficulty].totalGroups;
  const wordNum = studyCurrentWordIndex + 1;
  const totalWords = studyWords.length;

  studyProgressText.textContent = `Group ${groupNum}/${totalGroups} • Word ${wordNum}/${totalWords}`;
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
  // Calculate score
  const score = correctCount;
  const total = studyWords.length;

  // Handle review difficult mode differently
  if (studyPhase === "testingDifficult") {
    completeReviewDifficultTest();
    return;
  }

  // Mark group as complete (only for regular study mode)
  if (studyPhase === "testing") {
    markGroupComplete(currentDifficulty, studyGroupIndex);
  }

  // Show results
  resultText.textContent = `Test complete! You scored ${score} out of ${total}.`;
  resultText.className = "result-text correct";

  // Check if there are more groups
  const nextGroup = getNextStudyGroup(currentDifficulty);
  const totalGroups = studyProgress[currentDifficulty].totalGroups;

  if (nextGroup < totalGroups) {
    definitionText.textContent = `Great job! Moving to next group (${nextGroup + 1}/${totalGroups})...`;
    sentenceText.textContent = "";

    // Auto-advance to next group after 2 seconds
    setTimeout(() => {
      startStudyGroup(nextGroup);
    }, 2000);
  } else {
    definitionText.textContent = `Congratulations! You've completed all ${totalGroups} groups for this difficulty level!`;
    sentenceText.textContent = "You can switch to a different difficulty or review completed groups.";

    // Return to dashboard after 3 seconds
    setTimeout(() => {
      startStudyMode();
    }, 3000);
  }

  progressText.textContent = "";
  hideNextWordButton();
}

// =============================
//  Review Difficult Words Mode
// =============================

function startReviewDifficultWords() {
  const difficultWords = getAllDifficultWords("all");

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

  console.log("Review Difficult Words:", {
    totalWords: difficultWords.length,
    words: difficultWords.map(w => w.word)
  });

  // Show study phase UI
  showStudyPhaseUI();

  // Update phase indicator
  if (document.getElementById("phaseText")) {
    document.getElementById("phaseText").textContent = "Reviewing Difficult Words";
  }

  // Load first word
  loadStudyWord(0);

  // Update button visibility
  if (startTestBtn) {
    startTestBtn.style.display = "none"; // No test in review mode for now, user can cycle through
  }
}

function startReviewDifficultTest() {
  const difficultWords = getAllDifficultWords("all");

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

  console.log("Testing Difficult Words:", {
    totalWords: quizWords.length
  });

  // Show test UI
  showTestPhaseUI();

  // Update phase indicator
  if (document.getElementById("phaseText")) {
    document.getElementById("phaseText").textContent = "Testing Difficult Words";
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

  definitionText.textContent = "Great job reviewing your difficult words!";
  sentenceText.textContent = "Words you got correct will remain in your difficult list. Keep practicing!";

  progressText.textContent = "";
  hideNextWordButton();

  // Return to dashboard after 3 seconds
  setTimeout(() => {
    startStudyMode();
  }, 3000);
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

  const labels = {
    oneBee: "🐝",
    twoBee: "🐝🐝",
    threeBee: "🐝🐝🐝"
  };

  let html = "";
  difficultWords.forEach(wordData => {
    const reviewText = wordData.reviewCount > 0
      ? `Reviewed ${wordData.reviewCount} time${wordData.reviewCount !== 1 ? 's' : ''}`
      : "Not reviewed yet";

    html += `
      <div class="difficult-word-item">
        <div class="difficult-word-info">
          <div class="word">${wordData.word} ${labels[wordData.difficulty]}</div>
          <div class="meta">${reviewText}</div>
        </div>
        <div class="difficult-word-actions">
          <button class="unmark-btn" data-word="${wordData.word}" data-difficulty="${wordData.difficulty}">
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
      const word = e.target.dataset.word;
      const difficulty = e.target.dataset.difficulty;
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
  const isMarked = isWordMarkedDifficult(currentWord, currentDifficulty);

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

function renderProgressDashboard() {
  if (!studyDashboard || !progressBars) return;

  studyDashboard.style.display = "block";

  // Hide other UI
  if (studyPhaseIndicator) studyPhaseIndicator.style.display = "none";
  if (studyControls) studyControls.style.display = "none";
  if (studyCard) studyCard.style.display = "none";

  // Update difficult words display
  updateDifficultWordsDisplay();

  // Generate progress display
  const difficulties = ["oneBee", "twoBee", "threeBee"];
  const labels = {
    oneBee: "One Bee (Easy) 🐝",
    twoBee: "Two Bee (Medium) 🐝🐝",
    threeBee: "Three Bee (Hard) 🐝🐝🐝"
  };

  let html = "";

  difficulties.forEach(diff => {
    const progress = studyProgress[diff];
    const completed = progress.completedGroups.length;
    const total = progress.totalGroups;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    html += `
      <div class="progress-item">
        <div class="progress-header">
          <span class="difficulty-label">${labels[diff]}</span>
          <span class="progress-stats">${completed}/${total} groups</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <button class="reset-difficulty-btn" data-difficulty="${diff}">🔄 Reset</button>
      </div>
    `;
  });

  progressBars.innerHTML = html;

  // Update dashboard message
  const currentProgress = studyProgress[currentDifficulty];
  const nextGroup = currentProgress.currentGroup;
  const totalGroups = currentProgress.totalGroups;

  if (nextGroup < totalGroups) {
    resultText.textContent = `Ready to study! Next up: Group ${nextGroup + 1} of ${totalGroups}`;
    resultText.className = "result-text";
  } else {
    resultText.textContent = `All groups completed for this difficulty! 🎉`;
    resultText.className = "result-text correct";
  }

  definitionText.textContent = "Select a difficulty level and click 'Continue Studying' to begin.";
  sentenceText.textContent = "";
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
    alert("No bookmark found for this difficulty level.");
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
  const isCorrect = userAnswer.toLowerCase() === currentWordObj.word.toLowerCase();

  if (isCorrect) {
    correctCount += 1;
    resultText.textContent = "✅ Correct!";
    resultText.className = "result-text correct";
  } else {
    resultText.textContent = `❌ Incorrect. Correct spelling: ${currentWordObj.word}`;
    resultText.className = "result-text incorrect";

    // Auto-mark incorrect words as difficult during testing
    if (studyPhase === "testing" || studyPhase === "testingDifficult") {
      markWordAsDifficult(currentWordObj, currentWordObj.difficulty || currentDifficulty);
    }
  }

  // Track results for study mode
  if (studyPhase === "testing" || studyPhase === "testingDifficult") {
    studyTestResults.push({
      word: currentWordObj.word,
      correct: isCorrect,
      userAnswer: userAnswer
    });
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

  // Show the Next Word button after checking
  showNextWordButton();
});

nextWordBtn.addEventListener("click", () => {
  // In quiz mode OR study test mode, continue with quiz words
  if (currentMode === "quiz" || studyPhase === "testing") {
    quizIndex += 1;
    loadQuizWord();
  } else {
    // In practice mode, pick a random word
    const wordObj = pickRandomWord();
    if (!wordObj) return;
    setCurrentWord(wordObj);
    speak(`Spell the word: ${wordObj.word}`);
  }
});

startQuizBtn.addEventListener("click", () => {
  startQuiz();
});

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;
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
    checkBtn.click();
  }
});

difficultySelect.addEventListener("change", () => {
  currentDifficulty = difficultySelect.value;

  // Reset the current session when difficulty changes
  if (currentMode === "practice") {
    startPractice();
  } else if (currentMode === "study") {
    // Exit study phase and return to dashboard
    studyPhase = "dashboard";
    renderProgressDashboard();
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
resultText.textContent = 'Choose a mode and click "Play Word" or "Start" to begin.';
definitionText.textContent = "Definitions and sentences will appear after you check your answer.";
sentenceText.textContent = "";

// Initialize study mode
loadStudyProgress();

// Initialize DOM references when HTML is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeStudyModeDOM();

  // Add event listeners for study mode controls
  if (prevStudyWordBtn) {
    prevStudyWordBtn.addEventListener("click", prevStudyWord);
  }

  if (nextStudyWordBtn) {
    nextStudyWordBtn.addEventListener("click", nextStudyWord);
  }

  if (startTestBtn) {
    startTestBtn.addEventListener("click", startStudyTest);
  }

  if (hearStudyWordBtn) {
    hearStudyWordBtn.addEventListener("click", () => {
      if (studyWords[studyCurrentWordIndex]) {
        speak(studyWords[studyCurrentWordIndex].word);
      }
    });
  }

  if (continueStudyBtn) {
    continueStudyBtn.addEventListener("click", () => {
      const nextGroup = getNextStudyGroup(currentDifficulty);
      startStudyGroup(nextGroup);
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener("click", createBookmark);
  }

  // Reset All button
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      showResetModal(null);
    });
  }

  // Reset individual difficulty buttons (delegated)
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
        const success = markWordAsDifficult(currentWord, currentDifficulty);

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
      if (confirm(`Are you sure you want to clear ${filter === "all" ? "all" : filter} difficult words?`)) {
        clearAllDifficultWords(filter);
        renderDifficultWordsList(filter);
        updateDifficultWordsDisplay();
      }
    });
  }
});
