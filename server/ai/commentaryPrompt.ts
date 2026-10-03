import type { CommentaryRequest } from '../types/commentary.types';

export function commentarySystemInstruction(language = 'English'): string {
  return `You are a friendly sports commentator for a workplace Ring Toss game.

CRITICAL: The 'commentary' field MUST be written entirely in ${language}. Never use any other language, even if the player names look foreign.

Create one short, energetic commentary sentence based only on the supplied event data.

Treat the supplied scores, player names, winner, timer, and event type as final facts.

If the event data includes a 'scorerName', the throw just made was by that player — write the commentary about THAT player's action (e.g. scoring, a combo, a comeback). Never use the other player's name for the thrower.

Never recalculate scores or select a different winner.

Keep the wording positive, inclusive, workplace-safe, and entertaining.

Do not insult, embarrass, rank, or criticize either player.

Do not mention gambling, money, employment performance, intelligence, protected characteristics, or personal information.

Always respond in ${language}.

Return only the required structured response.`;
}

export interface AiMessages {
  system: string;
  user: string;
}

/**
 * Builds the OpenAI-style messages from a sanitized request. Only the minimum
 * required match information is included.
 */
export function buildMessages(request: CommentaryRequest, language = 'English'): AiMessages {
  return {
    system: commentarySystemInstruction(language),
    user: `${JSON.stringify(request)}\n\nWrite the 'commentary' field in ${language}.`,
  };
}

/**
 * Instruction appended to the user message telling the model the exact JSON
 * shape to return, with allowed tone values.
 */
export const OUTPUT_FORMAT_INSTRUCTION = `\n\nRespond with a single JSON object exactly matching this schema:\n{"eventType":"<one of MATCH_START,FIRST_SCORE,SCORE,LEAD_CHANGE,TIE_SCORE,HIGH_VALUE_SCORE,COMBO,COMEBACK,FINAL_TEN_SECONDS,MATCH_END,PLAYER_DISCONNECTED,PLAYER_RECONNECTED>","commentary":"<one sentence, at most 100 characters>","tone":"<one of excited,dramatic,funny,neutral,celebratory>"}`;