import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { MatchScene, type MatchRenderSource } from './scenes/MatchScene';
import {
  getGameState,
  launchRing,
  takeLandedEvents,
} from '../net/gameStore';

function onlineSource(): MatchRenderSource {
  return {
    getSnapshot: () => getGameState().snapshot,
    getTurnColorId: () => getGameState().snapshot?.turn ?? null,
    getMyColorId: () => getGameState().myPlayerId,
    canThrow: () => {
      const s = getGameState();
      return (
        s.snapshot?.phase === 'playing'
        && s.snapshot.turn === s.myPlayerId
        && !s.snapshot.ring.active
      );
    },
    launch: (vx, vy) => launchRing(vx, vy),
    takeLanded: () => takeLandedEvents(),
  };
}

export function createOnlineGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#7ec8e3',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new MatchScene('OnlineGameScene', onlineSource())],
  });
}