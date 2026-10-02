import type { CommentaryEventType } from '../../shared/commentary';
import type { PlayerId } from '../../shared/types';

export interface LandedDetectionInput {
  playerId: PlayerId;
  points: number;
  prevScores: Record<PlayerId, number>;
  lastLandedPlayer: PlayerId | null;
}

export interface DetectionResult {
  eventType: CommentaryEventType | null;
  leader: PlayerId | null;
  leadChanged: boolean;
}

/**
 * Pure detector for scoring-related commentary events. Returns the single most
 * meaningful event for a landed throw (high-value events win over normal ones).
 */
export function detectLandedEvent(input: LandedDetectionInput): DetectionResult {
  const { playerId, points, prevScores, lastLandedPlayer } = input;
  const opponent: PlayerId = playerId === 1 ? 2 : 1;

  const newScores = { ...prevScores, [playerId]: prevScores[playerId] + points };
  const leader: PlayerId | null = newScores[playerId] > newScores[opponent]
    ? playerId
    : newScores[opponent] > newScores[playerId]
      ? opponent
      : null;

  const isFirstScore = newScores[1] + newScores[2] === points;
  const trailingGap = prevScores[opponent] - prevScores[playerId];
  const leadChanged = Boolean(leader) && trailingGap >= 0 && playerId === leader;

  let eventType: CommentaryEventType | null = null;

  if (isFirstScore) {
    eventType = 'FIRST_SCORE';
  } else if (points >= 7) {
    eventType = 'HIGH_VALUE_SCORE';
  } else if (trailingGap >= 6 && leader === playerId) {
    eventType = 'COMEBACK';
  } else if (lastLandedPlayer === playerId) {
    eventType = 'COMBO';
  } else if (leadChanged) {
    eventType = 'LEAD_CHANGE';
  } else if (leader === null && newScores[1] > 0 && newScores[2] > 0) {
    eventType = 'TIE_SCORE';
  }

  return { eventType, leader, leadChanged };
}