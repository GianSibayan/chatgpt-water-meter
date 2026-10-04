# ChatGPT Water Meter
stop it with da water yochacho

A small browser extension that shows roughly how much water your ChatGPT chats use.

It puts a little tank on chatgpt.com, and the tank fills as you chat.

## What you'll see
- **This chat:** water used by the chat you're in.
- **All chats today:** the same, added up across every chat.
- Under that, the energy (Wh) and carbon (g CO2e) that come with it.
- Click the toolbar icon for today, this week, and all-time totals.

These are estimates, not measurements. OpenAI doesn't publish per-chat numbers, so treat everything as a rough guide.

## Install
Works in Edge and Chrome. It's waiting for review on the Edge Add-ons store, so for now you build it yourself (needs [Node.js](https://nodejs.org)):

```
git clone https://github.com/GianSibayan/chatgpt-water-meter.git
cd chatgpt-water-meter
npm install
npm run build
```

Then:
1. Open `edge://extensions` (`chrome://extensions` on Chrome).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the `chatgpt-water-meter` folder.
4. Open chatgpt.com and start chatting.

## Privacy
Everything stays in your browser. No accounts, no analytics, no network requests. Details in [PRIVACY.md](PRIVACY.md).

## What it counts
- Your messages and ChatGPT's replies, by token count.
- Thinking time, when ChatGPT shows "Worked for 29s".
- Each generated image, at a flat estimate.

Not counted: uploaded files like PDFs, and ChatGPT's hidden system prompt.

## How accurate is it?
Rough. The same chat can read about 10x apart depending on whose research you use and whether you count the water power plants use to make the electricity. The default numbers come from a benchmark of GPT-4o, an older model, because it's the closest one measured. Every number has a source in `src/constants.js`, and the full reasoning is in [METHODOLOGY.md](METHODOLOGY.md).

## For developers
```
npm install
npm run build   # bundles the extension
npm test        # runs the tests
npm run watch   # rebuilds on save (reload the extension after each change)
```

```
manifest.json          extension settings
popup.html             toolbar popup
widget.css             the on-page tank
src/constants.js       every number, with its source
src/methodology/       four ways to turn tokens into energy and water
src/content-script.js  reads the chat page and does the counting
src/lib/               tokenizer, storage, widget, hidden-work detection
icons/ fonts/          assets (Zen Kurenaido font, SIL OFL)
tests/                 tests
```

**Got a better number?** Change the value and its `source` in `src/constants.js`, then run `npm test`. That's the whole change.

## Credits
- Research behind the numbers: [Jegham et al. 2025](https://arxiv.org/abs/2505.09598), Luccioni et al. 2024, and Altman's and Google's published per-query figures.
- Prior art: Princeton's [GPTFootprint](https://doi.org/10.1145/3706599.3719708) (CHI 2025).
- Made by @euginini06_. Not affiliated with or endorsed by OpenAI. License in [LICENSE](LICENSE).