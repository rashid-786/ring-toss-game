import type { MatchResult, PlayerId } from '../../types/game';

export function calculateResult(scores: Record<PlayerId, number>): MatchResult {
  const player1Score = scores[1];
  const player2Score = scores[2];
  let winner: PlayerId | null = null;
  if (player1Score > player2Score) winner = 1;
  else if (player2Score > player1Score) winner = 2;
  return { player1Score, player2Score, winner };
}