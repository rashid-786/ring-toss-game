import { z } from 'zod';
import {
  COMMENTARY_EVENT_TYPES,
  COMMENTARY_TONES,
} from '../../shared/commentary';

/**
 * Allowed characters for player display names. Prevents prompt injection and
 * control characters from reaching the AI or clients.
 */
export const playerNameSchema = z
  .string()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9 _-]+$/, 'Only letters, numbers, spaces, underscores and hyphens are allowed.')
  .transform((value) => value.trim());

/** Validated shape of the AI model output. */
export const commentaryResultSchema = z.object({
  eventType: z.enum(COMMENTARY_EVENT_TYPES),
  commentary: z.string().min(1).max(300).trim(),
  tone: z.enum(COMMENTARY_TONES),
});

/** A validated AI response together with the request it answers. */
export const commentaryResponseSchema = z.object({
  request: z.unknown(),
  result: commentaryResultSchema,
});

export type ValidatedCommentaryResponse = z.infer<typeof commentaryResponseSchema>;

export const aiProviderSchema = z.enum(['openai', 'anthropic', 'generic', 'opencode', 'none']);

/** Trims string env values and treats empty strings as unset. */
function clean(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export const envSchema = z.object({
  AI_PROVIDER: z.preprocess(clean, aiProviderSchema).default('none'),
  AI_MODEL: z.preprocess(clean, z.string().optional()),
  AI_API_KEY: z.preprocess(clean, z.string().optional()),
  AI_BASE_URL: z.preprocess(clean, z.string().url().optional()),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  COMMENTARY_MIN_INTERVAL_MS: z.coerce.number().int().positive().default(1500),
  COMMENTARY_ENABLED: z.preprocess(clean, z.enum(['true', 'false'])).default('true'),
});

export type EnvConfig = z.infer<typeof envSchema>;