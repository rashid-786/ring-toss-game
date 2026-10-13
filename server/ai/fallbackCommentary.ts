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
    messages: [
      'Attention, Alshaya E-commerce Team! We have a RING TOSS DUO',
      'No carts, no checkouts, no deployments. Just rings, targets, and team pride!',
      'Welcome to the E-commerce Office Olympics. Aim, toss, convert... and may your ring have a 100% conversion rate!'
    ],
    tone: 'excited',
  },
  FIRST_SCORE: {
    messages: [
      '{playerName} opens the scoring! 100% conversion rate so far. E-commerce team, take notes!',
      '{playerName} lands the first one! No bugs, no failed deployment, just a perfect ring toss!'
    ],
    tone: 'excited',
  },
  SCORE: {
    messages: [
      'Nice one, {playerName}! That deserves five stars and free delivery!',
      '{playerName} scores again! Looks like we found our top-selling SKU!',
      'And {playerName} lands it! No Jira ticket required for that performance!',
      '{playerName} with pinpoint accuracy! Add it to the cart — checkmate!',
      'Smooth as a one-click checkout — {playerName} scores again!'
    ],
    tone: 'excited',
  },
  MISS: {
    messages: [
      'Oof! {playerName} misses by a whisker. Even the best releases get cart-abandoned sometimes!',
      '{playerName} skies it wide! No conversion there — back to the drawing board!',
      'A miss for {playerName}! That ring is having a choppy day... SLA breach!',
      '{playerName} overthrows it! That one bounced straight to the returns department!',
      'No luck for {playerName} — that ring just rage-quit mid-air!'
    ],
    tone: 'funny',
  },
  LEAD_CHANGE: {
    messages: [
      '{playerName} takes the lead! Conversion rate is climbing and the pressure is ON!',
      'The lead has changed! Looks like we have a new top-selling performer!',
      '{playerName} jumps ahead! The leaderboard just got interesting!'
    ],
    tone: 'dramatic',
  },
  TIE_SCORE: {
    messages: [
      'We are level! Just like BFCM readiness, both sides are holding strong under pressure!',
      'A tie! Traffic is high, DDoS is handled, and neither player is going down!',
      'Dead even! This one is going to the wire!'
    ],
    tone: 'dramatic',
  },
  HIGH_VALUE_SCORE: {
    messages: [
      'Excellent throw! {playerName} is officially BFCM READY!',
      'A huge shot from {playerName}! Peak traffic, peak pressure, peak performance!'
    ],
    tone: 'excited',
  },
  COMBO: {
    messages: [
      '{playerName} is unstoppable! Back-to-back hits and absolutely no downtime!',
      'Incredible! Even a DDoS could not stop {playerName} right now!',
      '{playerName} is on a hot streak! Server load rising, accuracy rising higher!',
      'Two in a row for {playerName}! This is peak BFCM energy!',
      '{playerName} keeps converting! Someone give that throw a bonus!',
      'Another one for {playerName}! The cart is filling up fast!'
    ],
    tone: 'excited',
  },
  COMEBACK: {
    messages: [
      'Outstanding comeback! {playerName} has closed the gap like a true BFCM warrior!',
      'They said the traffic was too high. {playerName} scaled up and proved them wrong!'
    ],
    tone: 'celebratory',
  },
  FINAL_TEN_SECONDS: {
    messages: [
      'Ten seconds remaining! BFCM mode activated. Every throw is now business critical!',
      'Ten seconds! Peak traffic, zero downtime, maximum pressure. LET’S GO!'
    ],
    tone: 'dramatic',
  },
  MATCH_END: {
    messages: [
      '{winnerName} wins the Ring Toss Duel! That is what we call Alshaya E-com peak performance!',
      'The champion is crowned! BFCM ready, DDoS ready, Ring Toss conquered. Take a bow, {winnerName}!'
    ],
    tone: 'celebratory',
  },
  PLAYER_DISCONNECTED: {
    messages: [
      'A player stepped away. Match temporarily unavailable... and no, it is not a DDoS this time!'
    ],
    tone: 'neutral',
  },
  PLAYER_RECONNECTED: {
    messages: [
      'And {playerName} is back in the game! BFCM mode reactivated!'
    ],
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
  MISS: {
    messages: ['ارتطم بعيداً! {playerName} سيحاول مرة أخرى!'],
    tone: 'funny',
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
  MISS: {
    messages: ['पोल नदारद! {playerName} अगली थ्रो में पक्का मारेगा!'],
    tone: 'funny',
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

  /** Next message index per event type, so consecutive same-type messages cycle. */
  private nextIndex: Partial<Record<CommentaryEventType, number>> = {};

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
    const winnerName = request.winner ?? request.leaderName ?? '';
    const playerName = request.scorerName ?? this.activePlayerName(request);

    const options = template.messages.map((message) => fill(message, { playerName, winnerName }));

    // Avoid lines already used (the caller scopes these per player), and cycle
    // through the pool so consecutive same-type messages also differ.
    const avoid = new Set(request.previousMessages ?? []);

    const start = (this.nextIndex[request.eventType] ?? options.length) % options.length;
    let index = start;
    let pick = '';
    for (let guard = 0; guard < options.length; guard += 1) {
      const candidate = options[index];
      if (!avoid.has(candidate)) {
        pick = candidate;
        break;
      }
      index = (index + 1) % options.length;
    }
    if (!pick) pick = options[start];

    this.nextIndex[request.eventType] = (index + 1) % options.length;

    return {
      eventType: request.eventType,
      commentary: pick,
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
