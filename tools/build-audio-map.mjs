// Builds audio-map.js: a real English recording (from Wikimedia Commons, as used on
// Wiktionary) for every word in the word lists, with the author and license of each file.
//
// Usage:  node tools/build-audio-map.mjs
// Needs Node 22+ and network access to en.wiktionary.org and commons.wikimedia.org.
// Requests are batched (50 words at a time) and slowed down to respect Wikimedia's limits.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { normalizeWordKey, pickRecordingFile, makeRecording } = require(path.join(root, "audio.js"));
const words2026 = require(path.join(root, "words-2026-27.js"));
const words2025 = require(path.join(root, "words-data.js"));

const USER_AGENT = "MollySpellingBee/1.0 (https://github.com/emilystat/molly-spelling-bee; audio-map builder)";
const PAUSE_MS = 1500;
const AUDIO_FILE_RE = /\.(ogg|oga|opus|wav|mp3|flac|webm)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// "Speaker: X Recorder: X" -> "X"; drops Commons' "No machine-readable author provided ... assumed" wording.
function cleanAuthor(text) {
  const s = stripHtml(text)
    .replace(/^No machine-readable author provided\.\s*/i, "")
    .replace(/\s*assumed \(based on copyright claims\)\.?$/i, "")
    .trim();
  const m = s.match(/^Speaker:\s*(.+?)\s+Recorder:\s*(.+)$/i);
  if (!m) return s;
  return m[1] === m[2] ? m[1] : `${m[1]} (recorded by ${m[2]})`;
}

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 1; attempt <= 8; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.status === 429 || res.status >= 500) {
      const wait = (Number(res.headers.get("retry-after")) || 5) * 1000 * attempt;
      console.log(`  (busy: HTTP ${res.status}, waiting ${Math.round(wait / 1000)}s)`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    await sleep(PAUSE_MS);
    return data;
  }
  throw new Error(`Gave up after repeated rate limiting: ${url}`);
}

// Audio files used on each word's Wiktionary page: Map(word -> [file titles]).
async function audioFilesOnPages(words) {
  const result = new Map();
  for (let i = 0; i < words.length; i += 50) {
    const batch = words.slice(i, i + 50);
    const pageFiles = new Map();
    const renamed = new Map(); // requested title -> actual page title
    let cont = {};
    do {
      const data = await api("https://en.wiktionary.org/w/api.php", {
        action: "query", titles: batch.join("|"), prop: "images", imlimit: "max", redirects: "1", ...cont
      });
      for (const r of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) renamed.set(r.from, r.to);
      for (const page of data.query?.pages || []) {
        const files = pageFiles.get(page.title) || [];
        (page.images || []).forEach((im) => { if (AUDIO_FILE_RE.test(im.title)) files.push(im.title); });
        pageFiles.set(page.title, files);
      }
      cont = data.continue || null;
    } while (cont);
    for (const w of batch) {
      let title = w;
      for (let hops = 0; renamed.has(title) && hops < 3; hops++) title = renamed.get(title);
      result.set(w, pageFiles.get(title) || []);
    }
    console.log(`  checked ${Math.min(i + 50, words.length)}/${words.length} pages`);
  }
  return result;
}

// URL, author and license for Commons files: Map(file title -> info).
async function fileInfo(titles) {
  const info = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const data = await api("https://commons.wikimedia.org/w/api.php", {
      action: "query", titles: titles.slice(i, i + 50).join("|"), prop: "imageinfo",
      iiprop: "url|extmetadata", iiextmetadatafilter: "Artist|LicenseShortName"
    });
    const renamed = new Map((data.query?.normalized || []).map((r) => [r.to, r.from]));
    for (const page of data.query?.pages || []) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      info.set(renamed.get(page.title) || page.title, {
        url: ii.url,
        page: ii.descriptionurl,
        author: cleanAuthor(ii.extmetadata?.Artist?.value),
        license: stripHtml(ii.extmetadata?.LicenseShortName?.value)
      });
    }
  }
  return info;
}

const entries = [
  ...words2026.map((w) => ({ word: w.word, alts: w.alts || [], pos: w.pos || "" })),
  ...["oneBee", "twoBee", "threeBee"].flatMap((k) => words2025[k].map((w) => ({ word: w.word, alts: [], pos: "" })))
];
const unique = [...new Map(entries.map((e) => [normalizeWordKey(e.word), e])).values()];

console.log(`Finding recordings for ${unique.length} words...`);
const filesByWord = await audioFilesOnPages(unique.map((e) => e.word));
const chosen = new Map(unique.map((e) => [e.word, pickRecordingFile(filesByWord.get(e.word) || [], e.word, e)]));

console.log("Getting file details...");
const info = await fileInfo([...new Set([...chosen.values()].filter(Boolean))]);

const map = {};
for (const e of unique) {
  const title = chosen.get(e.word);
  const details = title && info.get(title);
  map[normalizeWordKey(e.word)] = details
    ? { ...makeRecording(title, details.url, details.page), author: details.author, license: details.license }
    : null;
}

const lines = Object.entries(map).map(([key, rec]) => `  ${JSON.stringify(key)}: ${JSON.stringify(rec)}`);
fs.writeFileSync(path.join(root, "audio-map.js"), `// Real-voice recordings for the word lists (Wikimedia Commons files used by Wiktionary).
// Generated by tools/build-audio-map.mjs - do not edit by hand.
// Keys are lowercase words without accents; null means no English recording was found.
// Words missing from this map are looked up live in the browser (see audio.js).
const AUDIO_MAP = {
${lines.join(",\n")}
};
`);

const found = Object.values(map).filter(Boolean).length;
const missing = words2026.filter((w) => !map[normalizeWordKey(w.word)]).map((w) => w.word);
console.log(`Wrote audio-map.js: ${found} of ${unique.length} words have a real recording.`);
console.log(`2026-27 words with no recording (${missing.length}): ${missing.join(", ")}`);
