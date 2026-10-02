import type { CommentaryRequest } from '../types/commentary.types';

export const COMMENTATOR_SYSTEM_INSTRUCTION = `You are a friendly sports commentator for a workplace Ring Toss game.

Create one short, energetic commentary sentence based only on the supplied event data.

Treat the supplied scores, player names, winner, timer, and event type as final facts.

Never recalculate scores or select a different winner.

Keep the wording positive, inclusive, workplace-safe, and entertaining.

Do not insult, embarrass, rank, or criticize either player.

Do not mention gambling, money, employment performance, intelligence, protected characteristics, or personal information.

Return only the required structured response.`;

export interface AiMessages {
  system: string;
  user: string;
}

/**
 * Builds the OpenAI-style messages from a sanitized request. Only the minimum
 * required match information is included.
 */
export function buildMessages(request: CommentaryRequest): AiMessages {
  return {
    system: COMMENTATOR_SYSTEM_INSTRUCTION,
    user: JSON.stringify(request),
  };
}

/**
 * Instruction appended to the user message telling the model the exact JSON
 * shape to return, with allowed tone values.
 */
export const OUTPUT_FORMAT_INSTRUCTION = `\n\nRespond with a single JSON object exactly matching this schema:\n{"eventType":"<one of MATCH_START,FIRST_SCORE,LEAD_CHANGE,TIE_SCORE,HIGH_VALUE_SCORE,COMBO,COMEBACK,FINAL_TEN_SECONDS,MATCH_END,PLAYER_DISCONNECTED,PLAYER_RECONNECTED>","commentary":"<one sentence, at most 100 characters>","tone":"<one of excited,dramatic,funny,neutral,celebratory>"}`;