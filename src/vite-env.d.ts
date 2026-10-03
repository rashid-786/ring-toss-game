/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true" the local same-device game is available from the start screen. */
  readonly VITE_LOCAL_GAME_ENABLED?: string;
  /** Pole horizontal speed for the local game (px/s). */
  readonly VITE_POLE_SPEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}