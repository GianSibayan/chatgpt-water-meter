# ChatGPT Water Meter

Estimates, never measures, the energy and water footprint of your ChatGPT
usage. Every constant it uses is cited and swappable. Full writeup of what
it knows, what it has to guess, and why: see METHODOLOGY.md.

Not the first tool like this: Princeton's [GPTFootprint](https://doi.org/10.1145/3706599.3719708)
(CHI 2025) did a flat per-query average and a user study ahead of us. This
project's main addition is a token-based estimate (default methodology
benchmarked specifically against GPT-4o and independently validated
against OpenAI's own disclosed figure, see METHODOLOGY.md) plus visible,
swappable, cited math rather than one fixed number.

## Setup

```
npm install
npm run build
```

Then in Chrome: `chrome://extensions` -> enable Developer mode -> Load
unpacked -> select this folder.

## Develop

```
npm run watch
```

Rebuilds on every save. Reload the extension in `chrome://extensions`
after each change (Chrome doesn't hot-reload unpacked extensions).

## Test

```
npm test
```

Runs the calibration suite: checks that each methodology still lands in
a defensible range and scales linearly with token count. Run this after
touching anything in `src/constants.js` or `src/methodology/`.

## Project layout

```
manifest.json              MV3 manifest
src/constants.js           every number used, with source + date
src/methodology/           four independent, swappable calculation models (default: jegham-benchmark)
src/content-script.js      detects messages on chatgpt.com, tokenizes, computes
src/lib/tokenizer.js       real BPE tokenizer (gpt-tokenizer), not a word-count guess
src/lib/storage.js         daily/weekly/all-time aggregation
src/lib/widget.js          floating in-page widget
popup.html / src/popup.js  totals + methodology picker
tests/                     calibration tests
```

## Contributing a better number

Open `src/constants.js`, change the value and its `source` field, run
`npm test`. That's the whole review surface for a methodology update,
no other file should need to change.

## Known limitations

See METHODOLOGY.md, but headline ones: DOM selectors will break on a
ChatGPT frontend redesign, reasoning-mode tokens are invisible and only
roughly compensated for, and the hidden system-prompt overhead is a
flat guess. This is an order-of-magnitude tool, not a utility bill.
