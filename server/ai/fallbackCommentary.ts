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

const FALLBACKS_EN: Record<CommentaryEventType, FallbackTemplate> = {
  MATCH_START: {
    messages: ['Both players are ready. Let the Ring Toss Duel begin!'],
    tone: 'excited',
  },
  FIRST_SCORE: {
    messages: ['{playerName} opens the scoring with a clean throw!'],
    tone: 'excited',
  },
  SCORE: {
    messages: ['Nice toss from {playerName}!', '{playerName} adds another score!'],
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

const FALLBACKS_AR: Record<CommentaryEventType, FallbackTemplate> = {
  MATCH_START: {
    messages: ['كلا اللاعبين جاهزان. لتكن مباراة رمي الحلقات!'],
    tone: 'excited',
  },
  FIRST_SCORE: {
    messages: ['{playerName} يفتتح التسجيل برمية نظيفة!'],
    tone: 'excited',
  },
  SCORE: {
    messages: ['رمية رائعة من {playerName}!', '{playerName} يضيف نقاطاً أخرى!'],
    tone: 'excited',
  },
  LEAD_CHANGE: {
    messages: ['{playerName} يتقدم في النتيجة! مباراة متقاربة جداً!'],
    tone: 'dramatic',
  },
  TIE_SCORE: {
    messages: ['النتيجة متعادلة! لا أحد يتنازل عن نقطة!'],
    tone: 'dramatic',
  },
  HIGH_VALUE_SCORE: {
    messages: ['رمية ممتازة! {playerName} يسجل نقاطاً كبيرة!'],
    tone: 'excited',
  },
  COMBO: {
    messages: ['{playerName} في قمة مستواه! نقاط متتالية!'],
    tone: 'excited',
  },
  COMEBACK: {
    messages: ['عودة رائعة! {playerName} قلّص الفارق!'],
    tone: 'celebratory',
  },
  FINAL_TEN_SECONDS: {
    messages: ['عشر ثوانٍ متبقية. كل رمية مهمة الآن!'],
    tone: 'dramatic',
  },
  MATCH_END: {
    messages: ['{winnerName} يفوز بمباراة رمي الحلقات!'],
    tone: 'celebratory',
  },
  PLAYER_DISCONNECTED: {
    messages: ['غادر أحد اللاعبين. المباراة متوقفة.'],
    tone: 'neutral',
  },
  PLAYER_RECONNECTED: {
    messages: ['وعاد {playerName} إلى اللعبة!'],
    tone: 'excited',
  },
};

const FALLBACKS_HI: Record<CommentaryEventType, FallbackTemplate> = {
  MATCH_START: {
    messages: ['दोनों खिलाड़ी तैयार हैं। रिंग टॉस द्वंद्व शुरू होने दो!'],
    tone: 'excited',
  },
  FIRST_SCORE: {
    messages: ['{playerName} एक शानदार थ्रो से स्कोरिंग की शुरुआत करते हैं!'],
    tone: 'excited',
  },
  SCORE: {
    messages: ['{playerName} की बेहतरीन थ्रो!', '{playerName} एक और स्कोर जोड़ते हैं!'],
    tone: 'excited',
  },
  LEAD_CHANGE: {
    messages: ['{playerName} बढ़त बना लेते हैं! कितनी रोमांचक मैच है!'],
    tone: 'dramatic',
  },
  TIE_SCORE: {
    messages: ['स्कोर बराबर है! कोई भी पीछे नहीं हट रहा!'],
    tone: 'dramatic',
  },
  HIGH_VALUE_SCORE: {
    messages: ['बेहतरीन थ्रो! {playerName} बड़ा स्कोर बनाते हैं!'],
    tone: 'excited',
  },
  COMBO: {
    messages: ['{playerName} आग में हैं! लगातार स्कोर!'],
    tone: 'excited',
  },
  COMEBACK: {
    messages: ['शानदार वापसी! {playerName} ने अंतर कम कर दिया!'],
    tone: 'celebratory',
  },
  FINAL_TEN_SECONDS: {
    messages: ['दस सेकंड बाकी। अब हर थ्रो मायने रखता है!'],
    tone: 'dramatic',
  },
  MATCH_END: {
    messages: ['{winnerName} रिंग टॉस द्वंद्व जीत लेते हैं!'],
    tone: 'celebratory',
  },
  PLAYER_DISCONNECTED: {
    messages: ['एक खिलाड़ी चला गया। मैच रुका हुआ है।'],
    tone: 'neutral',
  },
  PLAYER_RECONNECTED: {
    messages: ['और {playerName} वापस आ गए हैं!'],
    tone: 'excited',
  },
};

const DRAW_EN = 'It ends in a draw. Both players were evenly matched!';
const DRAW_AR = 'انتهت المباراة بالتعادل! تألق اللاعبان معاً!';
const DRAW_HI = 'मैच ड्रॉ समाप्त हुआ! दोनों खिलाड़ी बराबर थे!';

export const DRAW_COMMENTARY = DRAW_EN;

function isArabic(language: string): boolean {
  const lang = language.toLowerCase();
  return lang === 'ar' || lang === 'ara' || lang === 'arabic' || lang.includes('arab');
}

function isHindi(language: string): boolean {
  const lang = language.toLowerCase();
  return lang === 'hi' || lang === 'hin' || lang === 'hindi' || lang.includes('hind');
}

/**
 * Local fallback provider. Used when the AI service is unavailable, fails,
 * times out, or returns invalid/unsafe content. The game never depends on AI.
 * Supports a configurable language (English default, Arabic and Hindi available).
 */
export class FallbackCommentaryProvider {
  private fallbacks: Record<CommentaryEventType, FallbackTemplate>;

  private draw: string;

  constructor(language = 'English') {
    if (isHindi(language)) {
      this.fallbacks = FALLBACKS_HI;
      this.draw = DRAW_HI;
    } else if (isArabic(language)) {
      this.fallbacks = FALLBACKS_AR;
      this.draw = DRAW_AR;
    } else {
      this.fallbacks = FALLBACKS_EN;
      this.draw = DRAW_EN;
    }
  }

  generate(request: CommentaryRequest): CommentaryResult {
    if (request.eventType === 'MATCH_END' && request.isDraw) {
      return {
        eventType: 'MATCH_END',
        commentary: this.draw,
        tone: 'dramatic',
      };
    }

    const template = this.fallbacks[request.eventType];
    const pick = template.messages[Math.floor(Math.random() * template.messages.length)];
    const winnerName = request.winner ?? request.leaderName ?? '';
    const playerName = request.scorerName ?? this.activePlayerName(request);

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