# Methodology

These are estimates, not measurements. OpenAI publishes no per-chat figures, so every number is a rough guide.

## How a number is made
1. Count tokens in your visible messages and ChatGPT's replies with `gpt-tokenizer` (a real BPE tokenizer).
2. Convert to energy with the selected methodology (default: `jegham-benchmark`).
3. Convert to water and carbon with that methodology's per-Wh ratios.
4. Add hidden work: thinking time and generated images (below).

## What it can't see
- The system prompt, custom instructions, and any retrieved history. The web app shows no token usage, so these are not counted (`hiddenOverheadTokens`, default 0).
- Which data center or cooling system handled the request. Some use little or no water for cooling.
- Uploaded attachments such as PDFs. They are not counted.

## Hidden work
- **Thinking.** When ChatGPT shows "Worked for 29s" or "Thought for 7s", the seconds are converted at about 0.73 kW per request (`workPowerKw`). That figure is derived from the utilization and power assumptions in Jegham et al. 2025, not published. "A few seconds" counts as 5 s, and one turn is capped at 15 minutes. ChatGPT doesn't always show the label, and then nothing extra is counted.
- **Images.** Each new generated image (found by its "Generated image" alt text) counts a flat 2.9 Wh (`imageEnergyWh`), the average Luccioni, Jernite & Strubell (FAccT 2024) measured for open image models. OpenAI hasn't published its own figure, so this is a stand-in. A turn with an image is not also counted by its time label.

## Methodologies
Four swappable modules in `src/methodology/` with the same interface.
- **`jegham-benchmark.js` (default).** Interpolates three measured GPT-4o points (Table 4, Jegham et al. 2025), then converts to water and carbon with the paper's Azure/OpenAI figures (PUE, on-site and off-site water, grid carbon). Its short-prompt result (0.42 Wh) landed within 19% of Sam Altman's 0.34 Wh. Below the smallest measured point (400 tokens) it scales down proportionally, so a one-line reply isn't charged a full answer. That likely underestimates fixed per-request cost. Above the largest point it stays flat.
- **`openai-disclosed.js`.** Scales Altman's figure (0.34 Wh, about 0.32 mL per query, Jun 2025) by tokens, assuming a 1,000-token average query. No methodology was published.
- **`google-fullstack.js`.** Scales Google's Gemini figure (0.24 Wh, 0.26 mL per median prompt, Aug 2025). Full-stack energy, with water for on-site cooling only. A different model family, so treat it as a cross-check.
- **`flops-based.js`.** A physics estimate: about 2 x active parameters in FLOPs per output token (input discounted, since it is processed in parallel), times an energy-per-FLOP figure from H100 specs at about 17% utilization. It assumes about 200B active parameters, a third-party estimate.

## Water and carbon
- **jegham-benchmark:** Water (L) = Energy (kWh) / PUE x on-site WUE + Energy (kWh) x off-site WUE. Carbon (kg) = Energy (kWh) x grid carbon intensity. About 94% of the water comes from electricity generation, not cooling.
- **google-fullstack:** Google's own ratio, on-site cooling only.
- **openai-disclosed, flops-based:** a rough "direct + grid" US average. This is the least certain number in the chain.
- Hidden-work energy uses the selected methodology's ratios.

The methodologies are deliberately left inconsistent so the spread stays visible.

## Limitations
- **Model coverage.** The default benchmark was measured on GPT-4o, which OpenAI retired from ChatGPT in February 2026. ChatGPT's default is now GPT-5.5 Instant, and as of October 2026 no public benchmark lists it. The extension can't see which model answered, so numbers are calibrated to the closest measured model.
- **Page markers.** Chat messages, the "Worked for ..." label, and the "Generated image" alt text are read from the page. A redesign, or a non-English ChatGPT, can break them.
- **No ground truth.** Nothing here can be checked against OpenAI's real figures. Treat the output as a plausible order of magnitude.

## Related work
- **[GPTFootprint](https://doi.org/10.1145/3706599.3719708)** (Graves et al., Princeton, CHI EA '25): a near-identical extension that uses a flat per-query average (2.9 Wh, 16.9 mL) so it never reads message text. Its user study found more awareness but little change in usage. We trade that privacy guarantee for a token-based estimate, since the text is already on the page.
- **[Jegham et al. 2025](https://arxiv.org/abs/2505.09598):** the benchmark behind the default methodology.
- **[Ren, Tomlinson, Black & Torrance 2024](https://doi.org/10.1038/s41598-024-76682-6):** a typical LLM can be 40-150x more resource-efficient than a human writing the same page in the US.
- **[Jiang, Sonne, Li, You & You 2024](https://doi.org/10.1016/j.eng.2024.04.002):** a life-cycle view across 8 phases. This extension covers inference only, not the embodied cost of the chips.
- **Luccioni, Jernite & Strubell, "Power Hungry Processing" (FAccT 2024):** the source for the image energy figure.

## Updating a number
Change the value and its `source` in `src/constants.js`, then run `npm test`.