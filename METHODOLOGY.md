# Methodology

## What this extension actually knows
- The visible text of your prompts and the assistant's visible responses,
  tokenized with `gpt-tokenizer` (a real BPE implementation), not a
  word-count heuristic.

## What it does not know, and has to assume
- The system prompt and custom instructions sent with every request.
  OpenAI's web app exposes no token-usage number anywhere (unlike the
  raw API, which returns one), so it is not counted
  (`hiddenOverheadTokens` in `src/constants.js` defaults to 0).
- Any hidden or retrieved older conversation history. OpenAI does not
  necessarily resend the full visible thread verbatim on every turn.
- Hidden work: thinking, reading attachments, and generating images
  happen out of sight and leave no text on the page. ChatGPT shows a
  label such as "Worked for 29s" or "Thought for 7s". The extension
  reads it and converts the seconds to energy at about 0.73 kW per
  request (`workPowerKw`), a figure derived from the utilization and
  power assumptions in Jegham et al. 2025, not a published number. For
  scale, that paper measured GPT-5 high reasoning at 4.8x to 14.8x the
  energy of minimal reasoning. "A few seconds" is counted as 5 s and one
  turn is capped at 15 minutes. As a cross-check for images, a Hugging
  Face and Carnegie Mellon study (Luccioni, Jernite & Strubell, FAccT
  2024) measured open image models at about 2.9 Wh per image on average,
  the same ballpark as the roughly 6 Wh this gives for a 29-second image
  turn. Attachments and images that come without such a label are not
  counted.
- Which physical data center or cooling system handled the request.
  Not every facility uses evaporative cooling; some are closed-loop or
  air-cooled with near-zero direct water use.

Past "tokens in the visible text," everything here is an estimate, not
a measurement, and is presented that way in the UI.

## Related work

This isn't the first attempt at this. Worth knowing before contributing:

- **[GPTFootprint](https://doi.org/10.1145/3706599.3719708)** (Graves,
  Larrieu, Zhang et al., Princeton, CHI EA '25) is a near-identical Chrome
  extension. It deliberately uses a single flat per-query average (2.9 Wh,
  16.9 mL) instead of tokenizing the conversation, specifically to avoid
  reading query content at all. Their week-long user study (9 participants)
  found the extension reliably increased awareness but had limited effect
  on actual usage, people kept using ChatGPT when it was useful to them
  regardless of the eco-feedback. Their own future-work section flags
  exactly the gap this project tries to close: per-query cost estimates
  were not yet available for newer models, chain-of-thought ones in
  particular. We trade their
  stronger privacy guarantee (never reading message content) for a
  token-based estimate, since the text is already visible in the page DOM
  either way.
- **[Jegham et al. 2025](https://arxiv.org/abs/2505.09598)** is the paper
  that answers GPTFootprint's open question (see `jegham-benchmark.js`
  below).
- **[Ren, Tomlinson, Black & Torrance 2024](https://doi.org/10.1038/s41598-024-76682-6)**
  takes a different angle: comparing a flagship LLM's resource cost
  against a human doing the *same writing task*. Their finding, a
  typical LLM can be 40-150x more resource-efficient than a human for
  equivalent output in the US, is a useful counterweight to a tool that,
  by design, only ever shows usage accumulating upward.
- **[Jiang, Sonne, Li, You & You 2024](https://doi.org/10.1016/j.eng.2024.04.002)**
  frames the full life cycle (R&D, hardware manufacturing, training,
  inference, disposal) across 8 phases. Useful context for why
  "per-query water" is only ever a slice of the real picture, this
  extension measures inference only, not the embodied cost of the chip
  that ran it.

## The four methodologies

All four live in `src/methodology/` as independent, swappable modules
with the same `calculate({ inputTokens, outputTokens })` interface. The
user picks one in the popup; none is presented as "the" answer.

### 0. `jegham-benchmark.js` (default)
Interpolates between three real measured points for GPT-4o specifically
(short/medium/long prompts, Table 4 of Jegham et al. 2025), then derives
water and carbon from the same paper's disclosed Azure/OpenAI
infrastructure constants (PUE, on-site and off-site water-use
effectiveness, grid carbon intensity), using their own formula rather
than a flat conversion ratio. The paper's own short-prompt estimate
(0.42 Wh) independently landed within 19% of Sam Altman's disclosed
0.34 Wh average, which is why this is the default: it's the only one of
the four benchmarked against both a real model and another public
disclosure. Between the measured points the energy is interpolated.
Below the smallest one (a 400-token exchange) it scales down
proportionally, so a one-line reply is not charged the cost of a full
answer; this likely underestimates fixed per-request overhead for very
short messages. Above the largest point it stays flat rather than guess
at a slope the paper didn't measure. Limitation: measured for GPT-4o,
not whichever model is currently selected in ChatGPT (see Model
coverage below), and interpolation between three points is still an
approximation, not a fourth measurement.

### 1. `openai-disclosed.js`
Scales Sam Altman's public figure (0.34 Wh / ~0.32 mL per query, blog
post, Jun 2025) by token count, against an assumed ~1000-token average
query, since OpenAI did not define what counts as "a query." No
methodology was published behind the original number.

### 2. `google-fullstack.js`
Scales Google's disclosed Gemini figure (0.24 Wh / 0.26 mL per median
text prompt, technical report, Aug 2025) the same way. Published
methodology: full-stack energy (active accelerators, idle machines,
CPU/memory, datacenter overhead) and water covering on-site cooling
only, excluding upstream generation water. Measures a different model
family (Gemini, not GPT), so treat it as a cross-check, not a GPT number.

### 3. `flops-based.js`
An independent, physics-grounded estimate: roughly 2 x active-parameters
FLOPs per generated token (the standard transformer inference
approximation), times an energy-per-FLOP hardware-efficiency constant.
Input tokens are discounted (processed in parallel during prefill,
unlike autoregressive output generation). The efficiency constant is
derived from published H100 specs (~989 TFLOPS BF16 at ~700 W) at an
assumed ~17% real-world inference utilization, which independently lands
the formula near the ~0.3 Wh reference point at 500 output tokens, it
wasn't reverse-engineered to hit that number. Active parameter count for
current flagship models is not officially disclosed; ~200B is a
third-party estimate, not a confirmed figure.

## Water and carbon conversion
Three different approaches are used across the four modules, deliberately
left inconsistent so the spread itself is visible rather than hidden
behind one chosen ratio:
- **jegham-benchmark** uses the actual formula data centers report
  against: Water(L) = (Energy_kWh / PUE) x WUE_site + Energy_kWh x
  WUE_source; Carbon(kg) = Energy_kWh x grid carbon intensity. Constants
  are Jegham et al.'s cited Azure/OpenAI figures, not a flat ratio.
- **google-fullstack** uses Google's own disclosed energy-to-water ratio
  for on-site cooling only (`waterConversion.directOnly`).
- **openai-disclosed** and **flops-based** use a rough "direct + grid"
  ratio (`waterConversion.directPlusGrid`), a US grid-average estimate
  for upstream electricity-generation water. This is the least certain
  number in the entire chain and swings hardest by region.

Hidden-work energy (the "Worked for ..." seconds) is converted to water
and carbon with the same per-Wh ratios as whichever methodology is
selected.

## Known limitations
- **DOM fragility**: `[data-message-author-role]` is the one hook most
  ChatGPT tooling has relied on. There is no stable public API for this;
  it will break on a frontend redesign and need updating.
- **Work label**: the "Worked for ..." text is read straight from the
  page, so a wording or layout change on ChatGPT's side can stop it
  being picked up.
- **Model coverage**: the default benchmark was measured on GPT-4o,
  which OpenAI retired from ChatGPT in February 2026. The current
  default there is GPT-5.5 Instant, and as of October 2026 no public
  benchmark lists it (the live "How Hungry is AI?" dashboard stops at
  GPT-5 variants). The extension cannot see which model answered, so
  every estimate is calibrated to the closest measured model, not the
  one actually running.
- **No ground truth**: none of this can be checked against OpenAI's
  actual infrastructure numbers, because OpenAI doesn't publish them at
  the per-query level. Treat the output as a plausible order of
  magnitude, not an audited figure.

## Updating a number
Change the value and its `source` field in `src/constants.js`, then run
`npm test`. If a change moves a methodology's output wildly outside the
calibration test's range, the test will fail and say why.