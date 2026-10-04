import { encode } from 'gpt-tokenizer';

export function countTokens(text) {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    // Crude fallback if the tokenizer chokes on something (emoji runs, etc).
    return Math.ceil(text.length / 4);
  }
}
