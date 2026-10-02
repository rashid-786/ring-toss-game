/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true" the local same-device game is available from the start screen. */
  readonly VITE_LOCAL_GAME_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}