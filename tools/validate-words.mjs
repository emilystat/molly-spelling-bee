// Checks words-2026-27.js against the school's list (tools/school-list-2026-27.txt).
//
// Usage:  node tools/validate-words.mjs
// Exits with an error if anything is wrong. No npm packages needed.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const words = require(path.join(root, "words-2026-27.js"));

const school = fs.readFileSync(path.join(root, "tools", "school-list-2026-27.txt"), "utf8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .map((line) => {
    const [n, word, alts, mark] = line.split("\t");
    return { n: Number(n), word, alts: alts ? alts.split(",") : [], mark: (mark || "").trim() };
  });

const POS_HEADS = ["noun", "plural noun", "verb", "adjective", "adverb", "proper noun", "preposition", "interjection", "pronoun", "conjunction"];
const FIELDS = new Set(["n", "word", "alts", "pos", "definition", "sentence", "origin", "parts", "tip", "flag", "confuse", "sounds", "say"]);
const FLAGS = { "**": "homonym", "*": "confusable", "": null };

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsWord = (sentence, word) =>
  new RegExp(`(^|[^\\p{L}])${escapeRe(stripAccents(word).toLowerCase())}([^\\p{L}]|$)`, "u").test(stripAccents(sentence).toLowerCase());
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

const errors = [];
const err = (w, msg) => errors.push(`#${w && w.n} ${w && w.word}: ${msg}`);

if (!Array.isArray(words)) {
  console.error("words-2026-27.js must export an array");
  process.exit(1);
}
if (words.length !== school.length) errors.push(`expected ${school.length} words, found ${words.length}`);

const seen = new Set();
school.forEach((s, i) => {
  const w = words[i];
  if (!w) {
    errors.push(`#${s.n} ${s.word}: missing`);
    return;
  }
  if (w.n !== s.n) err(w, `number should be ${s.n}`);
  if (w.word !== s.word) err(w, `word should be "${s.word}" (school list order)`);
  if (JSON.stringify(w.alts || []) !== JSON.stringify(s.alts)) err(w, `alts should be ${JSON.stringify(s.alts)}`);
  if ((w.flag ?? null) !== FLAGS[s.mark]) err(w, `flag should be ${JSON.stringify(FLAGS[s.mark])} (PDF mark "${s.mark}")`);

  const key = stripAccents(w.word).toLowerCase();
  if (seen.has(key)) err(w, "duplicate word");
  seen.add(key);

  Object.keys(w).forEach((k) => { if (!FIELDS.has(k)) err(w, `unknown field "${k}"`); });
  ["pos", "definition", "sentence", "origin", "sounds"].forEach((f) => { if (!nonEmpty(w[f])) err(w, `"${f}" is required`); });
  if (nonEmpty(w.pos) && !POS_HEADS.some((h) => w.pos === h || w.pos.startsWith(`${h} `))) err(w, `pos "${w.pos}" is not a known part of speech`);
  if (nonEmpty(w.sentence) && ![w.word, ...(w.alts || [])].some((f) => containsWord(w.sentence, f))) err(w, "sentence must contain the word (the test blanks it out)");
  if (!Array.isArray(w.parts)) err(w, `"parts" must be an array`);
  else w.parts.forEach((p, j) => { if (!p || !nonEmpty(p.part) || !nonEmpty(p.meaning)) err(w, `parts[${j}] needs "part" and "meaning"`); });
  if (w.tip != null && !nonEmpty(w.tip)) err(w, `"tip" must be text or null`);
  if (w.flag && !nonEmpty(w.confuse)) err(w, `"confuse" is required for ${w.flag} words`);
  if (w.confuse != null && !nonEmpty(w.confuse)) err(w, `"confuse" must be text or null`);
  if (w.say != null && (!nonEmpty(w.say) || /[A-Z]{2,}/.test(w.say))) err(w, `"say" must be lowercase text for the computer voice`);
});

if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

const count = (fn) => words.filter(fn).length;
console.log(`✓ ${words.length} words match the school list, in order.`);
console.log(`  word parts: ${count((w) => w.parts.length > 0)}, tips: ${count((w) => w.tip)}, ` +
  `homonym/confusable notes: ${count((w) => w.confuse)}, computer-voice respellings: ${count((w) => w.say)}`);
