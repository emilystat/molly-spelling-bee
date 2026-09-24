// =============================
//  Audio: real recordings first, computer voice as a fallback
// =============================
// 1. A person saying the word: the Wikimedia Commons recordings that Wiktionary uses.
//    Checked in audio-map.js first (built with tools/build-audio-map.mjs), then looked up
//    live from Wiktionary in the browser and remembered in localStorage.
// 2. Otherwise the best-sounding text-to-speech voice the browser offers
//    (natural/neural voices are preferred over the robotic defaults).

// ---------- Recording lookup (also used by tools/build-audio-map.mjs) ----------

const WIKTIONARY_API = "https://en.wiktionary.org/w/api.php";
const AUDIO_FILE_RE = /\.(ogg|oga|opus|wav|mp3|flac|webm)$/i;

function normalizeWordKey(word) {
  return String(word)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

const ACCENTS = { us: "US", ca: "Canadian", uk: "British", gb: "British", au: "Australian", nz: "New Zealand", ie: "Irish" };

// Reads a Commons file name like "En-us-lullaby.ogg" or "LL-Q1860 (eng)-Speaker-lullaby.wav".
function parseRecordingName(fileTitle) {
  const name = fileTitle.replace(/^File:/i, "");
  if (!AUDIO_FILE_RE.test(name)) return null;
  const base = normalizeWordKey(name.replace(AUDIO_FILE_RE, ""));
  let m = base.match(/^en-([a-z]{2})-(.+)$/);
  if (m && ACCENTS[m[1]]) return { kind: m[1] === "us" ? "us" : "regional", accent: ACCENTS[m[1]], spoken: m[2] };
  // Lingua Libre recordings: "<speaker>-<word>" (speaker's accent not in the name)
  if (base.startsWith("ll-q1860 (eng)-")) return { kind: "lingualibre", accent: "", spoken: base.slice("ll-q1860 (eng)-".length) };
  m = base.match(/^en-(.+)$/);
  if (m) return { kind: "generic", accent: "", spoken: m[1] };
  return null;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// A file name that is one letter off (e.g. "lullabye"), but not a plural or past tense of the word.
function isNearMiss(spoken, target) {
  if (Math.abs(spoken.length - target.length) > 1 || editDistance(spoken, target) !== 1) return false;
  const [shorter, longer] = spoken.length < target.length ? [spoken, target] : [target, spoken];
  return !(longer === `${shorter}s` || longer === `${shorter}d`);
}

const POS_QUALIFIERS = { noun: ["noun", "n"], verb: ["verb", "v"], adjective: ["adjective", "adj"], adverb: ["adverb", "adv"] };

// How good a Commons file is as a recording of the word (higher is better, -1 = not usable).
// `alts` are accepted alternate spellings; `pos` picks between e.g. "permit-noun" and "permit-verb".
function rankRecordingFile(fileTitle, word, { alts = [], pos = "" } = {}) {
  const rec = parseRecordingName(fileTitle);
  if (!rec) return -1;
  const targets = [word, ...alts].map(normalizeWordKey);
  const posHead = Object.keys(POS_QUALIFIERS).find(h => String(pos).toLowerCase().includes(h));

  if (rec.kind === "lingualibre") {
    return targets.some(t => rec.spoken.endsWith(`-${t}`)) ? 9 : -1;
  }
  const exact = { us: 10, generic: 8, regional: rec.accent === "Canadian" ? 7 : 5 }[rec.kind];
  if (targets.includes(rec.spoken)) return exact;

  // "permit-noun", "permit (verb)", ...
  for (const t of targets) {
    const m = rec.spoken.match(new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[- ]\\(?([a-z]+)\\)?$`));
    if (m) {
      const matches = posHead && POS_QUALIFIERS[posHead].includes(m[1]);
      return matches ? exact - 1 : -1;
    }
  }
  if (targets.some(t => isNearMiss(rec.spoken, t))) return exact - 6;
  return -1;
}

function recordingAccent(fileTitle) {
  const rec = parseRecordingName(fileTitle);
  return rec && rec.accent !== "US" ? rec.accent : "";
}

// Commons also serves an MP3 copy of Ogg recordings (Safari can't always play Ogg).
function mp3TranscodeUrl(url) {
  const m = String(url).match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)([0-9a-f]\/[0-9a-f]{2}\/)([^/]+)$/);
  if (!m || /\.(mp3|wav)$/i.test(m[3])) return null;
  return `${m[1]}transcoded/${m[2]}${m[3]}/${m[3]}.mp3`;
}

// The best file for a word from a list of Commons file titles, or null.
function pickRecordingFile(fileTitles, word, opts) {
  let best = null;
  fileTitles.forEach(title => {
    const rank = rankRecordingFile(title, word, opts);
    if (rank >= 0 && (!best || rank > best.rank)) best = { rank, title };
  });
  return best ? best.title : null;
}

// Finds the best English recording on the word's Wiktionary page.
// Resolves to { file, url, mp3, page, accent } or null when the page has no usable recording.
// Rejects on network errors, so callers can tell "no recording" from "couldn't check".
async function lookupRecording(word, fetchImpl, timeoutMs = 6000, opts = {}) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    titles: word,
    generator: "images",
    gimlimit: "max",
    prop: "imageinfo",
    iiprop: "url"
  });
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(`${WIKTIONARY_API}?${params}`, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error(`Wiktionary lookup failed: HTTP ${res.status}`);
    const data = await res.json();
    const pages = ((data.query && data.query.pages) || []).filter(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url);
    const title = pickRecordingFile(pages.map(p => p.title || ""), word, opts);
    if (!title) return null;
    const info = pages.find(p => p.title === title).imageinfo[0];
    return makeRecording(title, info.url, info.descriptionurl);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function makeRecording(fileTitle, url, page) {
  const cleanUrl = String(url).split("?")[0]; // drop tracking parameters
  return {
    file: fileTitle.replace(/^File:/i, ""),
    url: cleanUrl,
    mp3: mp3TranscodeUrl(cleanUrl),
    page: page ? String(page).split("?")[0] : "",
    accent: recordingAccent(fileTitle)
  };
}

// ---------- Browser playback ----------

const BeeAudio = (() => {
  const SETTINGS_KEY = "mollySpellingBee_audioSettings";
  const CACHE_KEY = "mollySpellingBee_audioCache";
  const RECHECK_MS = 14 * 24 * 60 * 60 * 1000; // look again after two weeks for words with no recording
  const OFFLINE_PAUSE_MS = 5 * 60 * 1000;      // stop trying live lookups for a while after a network error
  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  // Joke/novelty voices some systems ship with - never pick these automatically.
  const NOVELTY_VOICES = /(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical)/i;
  // Voices that usually sound natural, best first.
  const GOOD_VOICES = [/natural/i, /neural/i, /premium/i, /enhanced/i, /google us english/i, /\bonline\b/i,
    /samantha/i, /\bava\b/i, /allison/i, /\baria\b/i, /jenny/i, /\bzoe\b/i, /susan/i];

  const settings = { voiceURI: "", rate: 0.85, useRecordings: true };
  let cache = {};
  const pending = {};
  const listeners = [];
  let audioEl = null;
  let lookupsPausedUntil = 0;

  function loadJSON(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Could not save", key, e);
    }
  }

  function init() {
    Object.assign(settings, loadJSON(SETTINGS_KEY, {}));
    cache = loadJSON(CACHE_KEY, {});

    // Browsers (iPhone/iPad Safari especially) only allow sound after a tap, so unlock
    // audio and speech on the first tap or key press.
    const unlock = () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      const el = getAudioEl();
      if (!el.src) {
        el.src = SILENT_WAV;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      }
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      // Chrome loads voices asynchronously
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener("voiceschanged", () => window.speechSynthesis.getVoices());
      }
    }
  }

  function getAudioEl() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = "auto";
    }
    return audioEl;
  }

  function onChange(callback) {
    listeners.push(callback);
  }

  function notify(key) {
    listeners.forEach(cb => {
      try { cb(key); } catch (e) { console.error(e); }
    });
  }

  // ---------- Voices ----------

  function voiceScore(v) {
    if (!/^en([-_]|$)/i.test(v.lang)) return -1000;
    if (NOVELTY_VOICES.test(v.name)) return -500;
    let score = 0;
    if (/^en[-_]us$/i.test(v.lang)) score += 40;
    else if (/^en[-_]ca$/i.test(v.lang)) score += 25;
    else score += 10;
    const idx = GOOD_VOICES.findIndex(re => re.test(v.name));
    if (idx >= 0) score += 30 - idx;
    if (!v.localService) score += 5; // online voices (Google, Microsoft Online) usually sound better
    return score;
  }

  // English voices, best first (joke voices left out)
  function getEnglishVoices() {
    if (!window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices()
      .filter(v => voiceScore(v) > -500)
      .sort((a, b) => voiceScore(b) - voiceScore(a));
  }

  function bestVoice() {
    return getEnglishVoices()[0] || null;
  }

  function pickVoice() {
    if (settings.voiceURI) {
      const chosen = getEnglishVoices().find(v => v.voiceURI === settings.voiceURI);
      if (chosen) return chosen;
    }
    return bestVoice();
  }

  function stop() {
    if (audioEl) audioEl.pause();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // Speaks text with the computer voice. Resolves when finished (true) or on error (false).
  function speakText(text, { slow = false } = {}) {
    return new Promise(resolve => {
      if (!window.speechSynthesis) {
        resolve(false);
        return;
      }
      if (audioEl) audioEl.pause();
      const synth = window.speechSynthesis;
      synth.cancel();
      // Chrome bug fix: resume if paused
      if (synth.paused) synth.resume();

      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = "en-US";
      }
      utter.rate = slow ? Math.max(0.4, settings.rate * 0.7) : settings.rate;
      utter.pitch = 1;
      utter.volume = 1;

      let done = false;
      const finish = ok => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      utter.onend = () => finish(true);
      utter.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") {
          console.warn("Speech error:", event.error);
        }
        finish(false);
      };
      synth.speak(utter);

      // Chrome workaround: if not speaking shortly after, try again
      setTimeout(() => {
        if (!done && !synth.speaking && !synth.pending) synth.speak(utter);
      }, 150);
    });
  }

  // ---------- Recordings ----------

  // A recording object, null when the word is known to have none, or undefined when unknown.
  function knownRecording(word) {
    const key = normalizeWordKey(word);
    if (typeof AUDIO_MAP !== "undefined" && Object.prototype.hasOwnProperty.call(AUDIO_MAP, key)) {
      return AUDIO_MAP[key];
    }
    const c = cache[key];
    if (!c) return undefined;
    if (c.url) return c;
    if (c.none && Date.now() - c.checked < RECHECK_MS) return null;
    return undefined;
  }

  // Looks the word up (once at a time per word). Resolves to a recording, null, or undefined (couldn't check).
  function lookupWithCache(wordObj, waitMs) {
    const word = wordObj.word;
    const key = normalizeWordKey(word);
    const known = knownRecording(word);
    if (known !== undefined) return Promise.resolve(known);
    if (Date.now() < lookupsPausedUntil || typeof fetch === "undefined") return Promise.resolve(undefined);

    if (!pending[key]) {
      const opts = { alts: wordObj.alts || [], pos: wordObj.pos || "" };
      pending[key] = lookupRecording(word, (url, fetchOpts) => fetch(url, fetchOpts), 6000, opts)
        .then(found => {
          cache[key] = found ? { ...found, checked: Date.now() } : { none: true, checked: Date.now() };
          saveJSON(CACHE_KEY, cache);
          notify(key);
          return found;
        })
        .catch(err => {
          // Offline or blocked: don't remember, try again later
          console.warn("Recording lookup failed for", word, err.message || err);
          lookupsPausedUntil = Date.now() + OFFLINE_PAUSE_MS;
          return undefined;
        })
        .finally(() => {
          delete pending[key];
        });
    }
    if (!waitMs) return pending[key];
    return Promise.race([pending[key], new Promise(r => setTimeout(() => r(undefined), waitMs))]);
  }

  // Starts looking up recordings for upcoming words, a couple at a time.
  async function prefetch(wordObjs) {
    if (!settings.useRecordings) return;
    const queue = wordObjs.filter(w => w && knownRecording(w.word) === undefined);
    const worker = async () => {
      while (queue.length) {
        const w = queue.shift();
        await lookupWithCache(w);
      }
    };
    await Promise.all([worker(), worker()]);
  }

  function recordingUrls(rec) {
    const el = getAudioEl();
    const canOgg = el.canPlayType('audio/ogg; codecs="vorbis"') !== "";
    const urls = [];
    if (rec.mp3 && !canOgg) urls.push(rec.mp3);
    urls.push(rec.url);
    if (rec.mp3 && canOgg) urls.push(rec.mp3);
    return urls;
  }

  // Plays one URL. Resolves true when it finished playing, false if it couldn't play.
  function playUrl(url, slow) {
    return new Promise(resolve => {
      const el = getAudioEl();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      el.pause();

      let settled = false;
      let startTimer = null;
      const finish = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimer);
        el.onended = el.onerror = el.onplaying = null;
        resolve(ok);
      };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.onplaying = () => clearTimeout(startTimer);
      startTimer = setTimeout(() => finish(false), 8000);

      el.src = url;
      el.defaultPlaybackRate = slow ? 0.7 : 1;
      el.playbackRate = slow ? 0.7 : 1;
      const p = el.play();
      if (p && p.catch) p.catch(() => finish(false));
    });
  }

  async function playRecording(rec, slow) {
    for (const url of recordingUrls(rec)) {
      if (await playUrl(url, slow)) return true;
    }
    return false;
  }

  // Says the word: a real recording when there is one, otherwise the computer voice.
  // Resolves to "recording" or "voice".
  async function playWord(wordObj, { slow = false } = {}) {
    if (!wordObj) return "voice";
    if (settings.useRecordings) {
      let rec = knownRecording(wordObj.word);
      if (rec === undefined) rec = await lookupWithCache(wordObj, 2500);
      if (rec && await playRecording(rec, slow)) return "recording";
    }
    await speakText(wordObj.say || wordObj.word, { slow });
    return "voice";
  }

  // "recording", "voice", or "unknown" (not looked up yet).
  function getKnownSource(wordObj) {
    if (!wordObj) return "unknown";
    if (!settings.useRecordings) return "voice";
    const rec = knownRecording(wordObj.word);
    if (rec === undefined) return "unknown";
    return rec ? "recording" : "voice";
  }

  function getRecordingInfo(wordObj) {
    if (!wordObj || !settings.useRecordings) return null;
    return knownRecording(wordObj.word) || null;
  }

  function getSettings() {
    return { ...settings };
  }

  function updateSettings(changes) {
    Object.assign(settings, changes);
    saveJSON(SETTINGS_KEY, settings);
    notify(null);
  }

  // Wires up the voice settings panel.
  function initSettingsUI({ voiceSelect, rateInput, rateValue, recordingsToggle, testBtn }) {
    const fillVoices = () => {
      const voices = getEnglishVoices();
      const best = bestVoice();
      voiceSelect.innerHTML = "";
      const auto = document.createElement("option");
      auto.value = "";
      auto.textContent = best ? `Automatic (${best.name})` : "Automatic";
      voiceSelect.appendChild(auto);
      voices.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        voiceSelect.appendChild(opt);
      });
      voiceSelect.value = voices.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : "";
    };
    fillVoices();
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener("voiceschanged", fillVoices);
    }

    voiceSelect.addEventListener("change", () => updateSettings({ voiceURI: voiceSelect.value }));

    const showRate = () => {
      rateValue.textContent = `${Number(settings.rate).toFixed(2)}×`;
    };
    rateInput.value = settings.rate;
    showRate();
    rateInput.addEventListener("input", () => {
      updateSettings({ rate: parseFloat(rateInput.value) });
      showRate();
    });

    recordingsToggle.checked = settings.useRecordings;
    recordingsToggle.addEventListener("change", () => updateSettings({ useRecordings: recordingsToggle.checked }));

    testBtn.addEventListener("click", () => {
      speakText("This is the computer voice you will hear when a word has no recording.");
    });
  }

  return {
    init,
    onChange,
    playWord,
    speakText,
    stop,
    prefetch,
    getKnownSource,
    getRecordingInfo,
    getSettings,
    updateSettings,
    initSettingsUI
  };
})();

// For use in Node tools
if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeWordKey, rankRecordingFile, pickRecordingFile, makeRecording, mp3TranscodeUrl, lookupRecording };
}
