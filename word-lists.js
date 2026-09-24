// =============================
//  Word Lists
// =============================
// Every list the site can practice. A list is split into sets, and each set is
// studied in groups of 10 words. Study progress is saved separately per list.
//
// Loaded after words-data.js (2025-26 list) and words-2026-27.js (2026-27 list).

// Hoover 206 spelling site (https://hoover206.wixsite.com/spelling) study/test slideshows
// for the Scripps 2027 School list. The school's #1-150 are Scripps "Two Bee" (2.01-2.03)
// and #151-300 are "Three Bee" (3.01-3.03), in a different order than the school's list.
const HOOVER_SLIDES_BASE = "https://docs.google.com/presentation/d/e/";
const HOOVER_2027_SLIDES = [
  { name: "2.01", study: "2PACX-1vT6xbaEGRr9fir_wbGuhRvdCabqmVUfgLSX1shSH6n6lNP759Go5N2wbs5X4IlCp6z5N0xIGfYRLWOo", test: "2PACX-1vRDw57C_pArzBJCwnZUHrNZH03n-IvOaABAvQMvlP7s3R_rFZvfP_ZwZXz9Iose6SzoZ3ee1AeYboJA" },
  { name: "2.02", study: "2PACX-1vS4Mtz87dqfr7QpBI4te2QTnkv0fmjcxCHTfSX_vZUHuzawpuWEuC6aShyrUcN0b2mxXLRIEnlf-wet", test: "2PACX-1vTRxT9MwXFpJpAhnwOMbTRhr31oP_nZLYeNMwaJcbPaYhX_VfjChUPb0GrFS_4xWPtMEVrtm8ncfr_g" },
  { name: "2.03", study: "2PACX-1vS6YYpoKE5065r-W6U00lI04jqWLI1QXAiMXaN-dCz89YmtfQ25hCjAXbSDZJFAsf7Z-Cgj2IY2WHrH", test: "2PACX-1vSnRqppjkzWc5hjjoK8_6U9UjkTepQ4wIWTXl_9E7CK6qFBHleTqnZr4hdJmQrK2I3LaVgvmcJT07uc" },
  { name: "3.01", study: "2PACX-1vSrb2nRW8oyjPIgTqxSmGUtUsc_co_Zuhj18anipfmuPl3w7_FGsQdVdhZDKt8XadL23FPCuSJsehVL", test: "2PACX-1vSML_4EYBfUg5X-UvktQRVGeJfTgvHt2UdN6ycWdUEGD_6t3LPeW613lbytLPB2_p3qbViTP6A7AIRq" },
  { name: "3.02", study: "2PACX-1vQKMQdju17SmhHRvfcRdy_NhifeIDQISGK985k19e2hVaQBAAdV0ILIOeS0mC_DWbpoSSBWV4YI20Rb", test: "2PACX-1vRzePGBnj8-fCmtpIVz1RAro93CyAN3B9yjfTl32wdM_fiP9uLurOO0Kk1kjosXk5RpBlEfMIbdNzQP" },
  { name: "3.03", study: "2PACX-1vRW3x_7UELi3lywii18YrcJ37Te6ko9cAEjgGLFTVkj77us1yVCFBm6-IWAihEKLEWS1MxbGzvwT44X", test: "2PACX-1vSA4Mx9neppFknyJ0zu-jNnqdzV6KwxegkEDFq44ZCIL-TlmmqEldRHr9SjXxvnFEr5yPsmvhre42L-" }
];

function hooverSlidesUrl(id) {
  return `${HOOVER_SLIDES_BASE}${id}/pub?start=true&loop=false&delayms=60000`;
}

// Split the 300 school words into six sets of 50, in the school's order.
function buildSchoolSets2026() {
  const sets = [];
  for (let i = 0; i < 6; i++) {
    const first = i * 50 + 1;
    const last = first + 49;
    const twoBee = i < 3;
    sets.push({
      key: `set${i + 1}`,
      label: `Set ${i + 1} · #${first}–${last} ${twoBee ? "🐝🐝" : "🐝🐝🐝"}`,
      short: `#${first}–${last}`,
      badge: `Set ${i + 1}`,
      tier: twoBee ? "Grades 5–7 · Two Bee" : "Grade 8 · Three Bee",
      words: words2026_27.filter(w => w.n >= first && w.n <= last)
    });
  }
  return sets;
}

const WORD_LISTS = {
  "2026-27": {
    id: "2026-27",
    title: "2026–27 School List (300 words)",
    subtitle: "2026–27 School Spelling Bee · 300 words",
    storageKey: "mollySpellingBee_studyProgress_2026-27",
    sets: buildSchoolSets2026(),
    // Which sets each grade starts with (grades 5-7 start at #1, grade 8 at #151).
    grades: [
      { id: "5-7", label: "Grades 5–7 (start at #1)", range: "#1–150", setKeys: ["set1", "set2", "set3"] },
      { id: "8", label: "Grade 8 (start at #151)", range: "#151–300", setKeys: ["set4", "set5", "set6"] }
    ],
    // Dates from the school's list.
    events: [
      { name: "Classroom Bees", start: "2026-11-15", end: "2026-11-18" },
      { name: "Grade Level Bees", start: "2026-12-15", end: "2026-12-16" },
      { name: "Championship Bee", start: "2027-01-20", end: "2027-01-20" }
    ],
    resources: [
      ...HOOVER_2027_SLIDES.map(s => ({
        group: s.name.startsWith("2") ? "Hoover slideshows for #1–150 (Scripps Two Bee)" : "Hoover slideshows for #151–300 (Scripps Three Bee)",
        name: `Set ${s.name}`,
        links: [
          { text: "Study", url: hooverSlidesUrl(s.study) },
          { text: "Test", url: hooverSlidesUrl(s.test) }
        ]
      }))
    ]
  },
  "2025-26": {
    id: "2025-26",
    title: "2025–26 School List (450 words)",
    subtitle: "2025–26 School Spelling Bee · 450 words",
    // Last year's key, so earlier progress is kept.
    storageKey: "mollySpellingBee_studyProgress",
    sets: [
      { key: "oneBee", label: "One Bee (Easy) 🐝", short: "One Bee", badge: "One Bee", tier: "", words: wordsData.oneBee },
      { key: "twoBee", label: "Two Bee (Medium) 🐝🐝", short: "Two Bee", badge: "Two Bee", tier: "", words: wordsData.twoBee },
      { key: "threeBee", label: "Three Bee (Hard) 🐝🐝🐝", short: "Three Bee", badge: "Three Bee", tier: "", words: wordsData.threeBee }
    ],
    grades: null,
    events: [],
    resources: []
  }
};

const DEFAULT_LIST_ID = "2026-27";

// Links shown for every list.
const GENERAL_RESOURCES = [
  { text: "Merriam-Webster (the school's pronunciation guide)", url: "https://www.merriam-webster.com/" },
  { text: "Word Club app from Scripps (free; words recorded by the official pronouncer)", url: "https://spellingbee.com/word-club" },
  { text: "Hoover 206 spelling practice site (2027 words)", url: "https://hoover206.wixsite.com/spelling/copy-of-2025-words-1" }
];
