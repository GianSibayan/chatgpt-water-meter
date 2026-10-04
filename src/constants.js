// Every number below traces to a public, dated source. Update the
// "source" field and date when a better figure gets published; that
// should be the only edit a methodology update ever needs.
// Full writeup: ../METHODOLOGY.md

export default {
  lastReviewed: '2026-10-04',

  openaiDisclosed: {
    source: "Sam Altman, 'The Gentle Singularity' (blog.samaltman.com, Jun 2025)",
    energyWhPerQuery: 0.34,
    waterMlPerQuery: 0.32,
    assumedTokensPerQuery: 1000,
    note: 'No methodology or token basis was published alongside this figure.',
  },

  googleFullStack: {
    source: 'Google, "Measuring the environmental impact of delivering AI at Google Scale" (Aug 2025)',
    energyWhPerPrompt: 0.24,
    waterMlPerPrompt: 0.26,
    assumedTokensPerPrompt: 1000,
    note: 'Full-stack energy accounting (idle machines, CPU/memory, overhead). Water covers on-site cooling only.',
  },

  flopsBased: {
    source: 'Epoch AI-style FLOPs heuristic, ~200B active-parameter model (Feb 2025 estimate)',
    assumedActiveParamsBillion: 200,
    flopsPerTokenMultiplier: 2,
    // Derived, not fudged: an H100-class GPU does ~989 TFLOPS (BF16) at
    // ~700 W peak, i.e. ~7.1e-13 J/FLOP at 100% utilization. Real-world
    // inference serving runs at a fraction of peak (batching gaps, memory
    // stalls); ~17% assumed utilization gives ~4.15e-12 J/FLOP effective,
    // which also happens to land the 500in/500out case near the 0.3 Wh
    // reference point independently cited by multiple sources.
    peakJPerFlopH100: 7.1e-13,
    assumedUtilization: 0.17,
    hardwareEfficiencyJPerFlop: 4.15e-12,
  },

  waterConversion: {
    directOnly: {
      mlPerWh: 1.08,
      note: "Back-calculated from Google's 0.24 Wh -> 0.26 mL ratio (on-site cooling only).",
    },
    directPlusGrid: {
      mlPerWh: 1.8,
      note: 'Adds thermoelectric generation water intensity (~1.8-2 L/kWh, US grid average). Varies heavily by region; the least certain number in the chain.',
    },
  },

  // Jegham, Abdelatti, Koh, Elmoubarki & Hendawi, "How Hungry is AI?
  // Benchmarking Energy, Water, and Carbon Footprint of LLM Inference"
  // (arXiv:2505.09598, 2025). Directly benchmarks GPT-4o on Azure/OpenAI
  // infrastructure at three measured prompt sizes (their Table 4), and
  // independently validates against Sam Altman's disclosed 0.34 Wh average
  // (their short-prompt estimate of 0.42 Wh landed within 19% of it). This
  // is the most specific, most recently validated source we have for an
  // actual ChatGPT-class model, which is why it's the default methodology.
  jeghamBenchmark: {
    source: 'Jegham et al., "How Hungry is AI?" (arXiv:2505.09598, 2025), GPT-4o on Azure/OpenAI infra',
    // totalTokens -> measured energyWh, piecewise-linear interpolated between these.
    anchors: [
      { totalTokens: 400, energyWh: 0.423 }, // 100 in / 300 out (their "short")
      { totalTokens: 2000, energyWh: 1.215 }, // 1000 in / 1000 out ("medium")
      { totalTokens: 11500, energyWh: 2.875 }, // 10000 in / 1500 out ("long")
    ],
    note: 'Benchmarked specifically for GPT-4o, the ChatGPT default model through most of 2024-2025; other models will differ.',
  },

  // Same paper's cited infrastructure figures for Azure/OpenAI datacenters,
  // used to derive water (Eq. 4) and carbon (Eq. 5): Water(L) =
  // (E_kWh/PUE)*WUEsite + E_kWh*WUEsource ; Carbon(kg) = E_kWh*CIF.
  infrastructure: {
    source: 'Jegham et al. 2025, citing Microsoft Azure sustainability disclosures (PUE, on-site WUE) and World Resources Institute grid-water guidance (off-site WUE)',
    pue: 1.12,
    wueSiteLPerKwh: 0.3, // on-site cooling water
    wueSourceLPerKwh: 4.35, // off-site electricity-generation water
    cifKgPerKwh: 0.35, // grid carbon intensity
  },

  // Chain-of-thought / "reasoning" tokens are generated but never shown.
  // Applied to output tokens only when a reasoning indicator is detected.
  // Jegham et al. 2025 measured GPT-5's actual high-vs-minimal-reasoning
  // ratio at 4.8x (long prompts) to 14.8x (short prompts) for the same
  // prompt length. 5x is a deliberately conservative pick near the low
  // (long-prompt) end of that measured range, not an invented guess.
  reasoningMultiplier: 5,

  // The hidden system prompt and custom instructions are invisible to the page
  // and unmeasured, so by default only visible text is counted. Raise this to
  // add your own per-exchange guess.
  hiddenOverheadTokens: 0,
};
