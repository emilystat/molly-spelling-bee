# Spelling Bee Practice Website

A web-based spelling practice tool for the school spelling bee, featuring multiple practice modes, real-voice pronunciations, study cards with word parts, and spaced review tests.

## Word Lists

- **2026–27 School List (default)**: the 300 words of the *2026-2027 School Spelling Bee List for Classroom and Grade Level Bees*, in the school's order. These are the same words as the Scripps 2027 School Spelling Bee Study List: #1–150 are "Two Bee" words (grades 5–7 start at #1) and #151–300 are "Three Bee" words (grade 8 starts at #151). The list is split into six sets of 50. For extra practice it also has the 150 Scripps 2027 "One Bee" words (Hoover 206 sets 1.01–1.03), which are not on the school's list.
- **2025–26 School List**: last year's 450 words (One Bee, Two Bee, Three Bee). Progress saved last year is kept.

Switch lists with the **Word list** menu. Study progress is saved separately for each list.

## Features

- **Practice Mode**: Unlimited practice that doesn't repeat itself: new words first, then words you missed, then the ones you practiced longest ago (your history is saved, so this carries over between visits)
- **Quiz Mode**: 10 words chosen the same way
- **Study Mode**: Study 10 words at a time on word cards, then take a test
- **Review Tests**: Each studied group comes back for a review test the next day; good scores push the next review further out (1, 3, 7, 14, 30 days)
- **Review Difficult Words**: Missed words go into a difficult-words bank; review them 10 at a time, and a word leaves the bank after you spell it right 2 times in a row
- **Ask the Pronouncer**: Like a real bee, ask for the definition, a sentence (with the word blanked out), the part of speech, the language of origin, or a root hint
- **Word Cards**: Definition, example sentence, "sounds like" respelling, language of origin, word parts (prefixes, roots, suffixes), spelling tips, homonym warnings, and a link to Merriam-Webster
- **Real-Voice Pronunciation**: Recordings of real people from Wikimedia Commons when available, otherwise the best computer voice on the device (voice and speed can be changed; 🐢 Slow plays the word slower)
- **Bee Countdown**: Days until the next school bee and a suggested number of new words per day
- **Answer Checking**: Capital letters and accents are optional (piñata = pinata), alternate spellings on the list are accepted (fertilizer/fertiliser), hyphens and spaces count (cul-de-sac)
- **More Practice**: Links to the Hoover 206 study/test slideshows, Merriam-Webster, and the free Scripps Word Club app

## Usage

Simply open `index.html` in a web browser to start practicing. Your progress is saved automatically in your browser's local storage.

## Files

- `index.html` - Main application interface
- `script.js` - Application logic (practice, quiz, study mode, review tests, word cards)
- `audio.js` - Pronunciation: real recordings with a computer-voice fallback
- `style.css` - Styling and layout
- `word-lists.js` - The word lists, their sets, bee dates, and resource links
- `words-2026-27.js` - 2026–27 words with definitions, sentences, origins, word parts and tips
- `words-2026-27-onebee.js` - the extra One Bee words, with the same details
- `words-data.js` - 2025–26 words with definitions and example sentences
- `audio-map.js` - Recordings found for each word (generated)
- `tools/school-list-2026-27.txt` - The school's list, transcribed from the PDF
- `tools/validate-words.mjs` - Checks `words-2026-27.js` against the school's list: `node tools/validate-words.mjs`
- `tools/build-audio-map.mjs` - Finds a real recording for every word and rebuilds `audio-map.js`: `node tools/build-audio-map.mjs` (needs Node 22+ and internet access)

## Credits

- Definitions, example sentences, word-part notes and tips for the 2026–27 list were written for this site.
- Pronunciation recordings come from [Wikimedia Commons](https://commons.wikimedia.org/) (the recordings Wiktionary uses, including [Lingua Libre](https://lingualibre.org/) volunteers). Each word card links to its recording and credits the speaker and license.
- The study → wait a day → test again approach and the "Ask the pronouncer" test style were inspired by the [Hoover 206 spelling site](https://hoover206.wixsite.com/spelling), which the site links to for extra practice.

## Copyright and License

Copyright (c) 2026 Emily

This work is licensed under a [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-nc-sa/4.0/).

This means you are free to:
- Share and use this website for personal, educational, and non-commercial purposes
- Adapt and build upon this work

Under these conditions:
- **Attribution**: You must give appropriate credit to the original author
- **NonCommercial**: You may not use this material for commercial purposes
- **ShareAlike**: If you modify this work, you must distribute it under the same license

See the [LICENSE](LICENSE) file for full license text.

## Disclaimer

This is an educational project created for personal use. Definitions for the 2025–26 list are sourced from public APIs and may not be suitable for all contexts. Recordings are from volunteers and may use different accents; check [Merriam-Webster](https://www.merriam-webster.com/) (the school's pronunciation guide) when in doubt.

---

Made with 🐝 for Molly
