import type { LlmFacts } from '../schema';

/**
 * Prompts for the executive summary — T0 stub, B2 fills the text (B2 brief §4, English only).
 * The user prompt carries ONLY the facts JSON, never raw questions.json rows.
 */
export const SYSTEM_PROMPT: string = '';

export function buildUserPrompt(facts: LlmFacts): string {
  void facts;
  throw new Error('not implemented in T0');
}
