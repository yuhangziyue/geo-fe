import type { LlmFacts } from '../schema';

/**
 * Prompts for the executive summary (B2 brief §4, English only).
 * The first six sentences are the brief skeleton verbatim. The last one is added so the number check is fair:
 * dates and day counts are not numeric facts and would always come back unverified.
 */
export const SYSTEM_PROMPT: string =
  'You are the executive-summary writer for an AI-visibility monitoring dashboard. ' +
  'Write ≤120 words, 3 short paragraphs max. ' +
  'Every number MUST come from the FACTS block. ' +
  'Do not invent numbers, product names, or recommendations. ' +
  'If data is thin (e.g., "firstN < 8"), say so instead of guessing. ' +
  'Prefer concrete verbs: "Publish", "Add", "Fix". No marketing fluff. ' +
  'Write percentages as "71%" and point changes as "12 pt"; do not write dates, years or day counts.';

/** The user turn: the facts JSON and nothing else from the data. */
export function buildUserPrompt(facts: LlmFacts): string {
  return `Here are the facts about ${facts.brand} for ${facts.period.from} to ${facts.period.to}:\n${JSON.stringify(facts, null, 2)}\n\nWrite the summary now.`;
}
