import 'dotenv/config';
import { envSchema, type EnvConfig } from './ai/commentarySchema';

let cached: EnvConfig | null = null;

/**
 * Validates and caches environment variables. Logs a generic warning when a
 * value is invalid (never logging secrets).
 */
export function getEnv(): EnvConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    // eslint-disable-next-line no-console
    console.warn(`[commentary] Invalid environment configuration for: ${issues || 'unknown'}`);
    cached = envSchema.parse({});
    return cached;
  }

  cached = parsed.data;
  return cached;
}

/** Returns true when a real AI provider is configured (not fallback-only). */
export function isAiConfigured(): boolean {
  const env = getEnv();
  return env.AI_PROVIDER !== 'none' && Boolean(env.AI_API_KEY);
}