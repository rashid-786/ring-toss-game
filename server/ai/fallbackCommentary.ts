import type { CommentaryEventType, CommentaryTone } from '../../shared/commentary';
import type {
  CommentaryRequest,
  CommentaryResult,
} from '../types/commentary.types';

interface FallbackTemplate {
  messages: string[];
  tone: CommentaryTone;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

const FALLBACKS: Record<CommentaryEventType, FallbackTemplate> = {
  MATCH_START: {
    messages: ['Both players are ready. Let the Ring Toss Duel begin!'],
    tone: 'excited',
  },
  FIRST_SCORE: {
    messages: ['{playerName} opens the scoring with a clean throw!'],
    tone: 'excited',
  },
  LEAD_CHANGE: {
    messages: ['{playerName} takes the lead!', 'The lead has changed. What a close match!'],
    tone: 'dramatic',
  },
  TIE_SCORE: {
    messages: ['We are level! Neither player is giving an inch.', 'A tie! This match is wide open.'],
    tone: 'dramatic',
  },
  HIGH_VALUE_SCORE: {
    messages: [
      'Excellent throw! {playerName} lands a big score.',
      'A huge shot from {playerName}!',
    ],
    tone: 'excited',
  },
  COMBO: {
    messages: ['{playerName} is on fire! Back-to-back scores!'],
    tone: 'excited',
  },
  COMEBACK: {
    messages: ['Outstanding comeback! {playerName} has closed the gap.'],
    tone: 'celebratory',
  },
  FINAL_TEN_SECONDS: {
    messages: ['Ten seconds remaining. Every throw matters now!'],
    tone: 'dramatic',
  },
  MATCH_END: {
    messages: ['{winnerName} wins the Ring Toss Duel!'],
    tone: 'celebratory',
  },
  PLAYER_DISCONNECTED: {
    messages: ['A player stepped away. The match is on hold.'],
    tone: 'neutral',
  },
  PLAYER_RECONNECTED: {
    messages: ['And {playerName} is back in the game!'],
    tone: 'excited',
  },
};

export const DRAW_COMMENTARY = 'It ends in a draw. Both players were evenly matched!';

/**
 * Local fallback provider. Used when the AI service is unavailable, fails,
 * times out, or returns invalid/unsafe content. The game never depends on AI.
 */
export class FallbackCommentaryProvider {
  generate(request: CommentaryRequest): CommentaryResult {
    if (request.eventType === 'MATCH_END' && request.isDraw) {
      return {
        eventType: 'MATCH_END',
        commentary: DRAW_COMMENTARY,
        tone: 'dramatic',
      };
    }

    const template = FALLBACKS[request.eventType];
    const pick = template.messages[Math.floor(Math.random() * template.messages.length)];
    const winnerName = request.winner ?? request.leaderName ?? '';
    const playerName = this.activePlayerName(request);

    return {
      eventType: request.eventType,
      commentary: fill(pick, {
        playerName,
        winnerName,
      }),
      tone: template.tone,
    };
  }

  private activePlayerName(request: CommentaryRequest): string {
    const leader = request.leaderName;
    if (leader) return leader;
    const winner = request.winner;
    if (winner) return winner;
    const higher = request.player1.score >= request.player2.score
      ? request.player1.displayName
      : request.player2.displayName;
    return higher;
  }
}