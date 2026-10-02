import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import type { CommentaryEventType, CommentaryTone } from '../../shared/commentary';
import type { CommentaryRequest, CommentaryResult } from '../types/commentary.types';
import { commentaryResultSchema } from './commentarySchema';
import { buildMessages, OUTPUT_FORMAT_INSTRUCTION } from './commentaryPrompt';
import { moderateCommentary, truncateCommentary } from './moderation';

export class AIError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AIError';
    this.code = code;
  }
}

export interface AIServiceOptions {
  provider: 'openai' | 'anthropic' | 'generic' | 'opencode' | 'none';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs: number;
}

export interface AICommentaryService {
  readonly enabled: boolean;
  generate(request: CommentaryRequest): Promise<CommentaryResult>;
}

const COMMENTARY_RESULT_KEYS = z.object({
  eventType: z.string(),
  commentary: z.string(),
  tone: z.string(),
});

/**
 * Calls the configured AI provider and validates/ moderates the response.
 * Throws AIError on any failure so the caller can use fallback commentary.
 */
export class HttpAICommentaryService implements AICommentaryService {
  readonly enabled = true;

  /** Stable session id for OpenAI-compatible gateways (e.g. opencode). */
  private sessionId = randomBytes(16).toString('hex');

  constructor(private options: AIServiceOptions) {}

  async generate(request: CommentaryRequest): Promise<CommentaryResult> {
    const responseText = await this.requestModel(request);
    const parsed = await this.parseResponse(responseText, request.eventType);
    return this.validateAndModerate(parsed, request.eventType);
  }

  private async requestModel(request: CommentaryRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const { url, init } = this.buildHttpRequest(request);
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (!response.ok) {
        throw new AIError('http_error', `AI provider returned HTTP ${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      return this.extractText(json);
    } catch (error) {
      if (error instanceof AIError) throw error;
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new AIError(aborted ? 'timeout' : 'network_error', 'AI request failed');
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHttpRequest(request: CommentaryRequest): { url: string; init: RequestInit } {
    const { provider, apiKey, model, baseUrl } = this.options;
    const messages = buildMessages(request);
    const user = `${messages.user}${OUTPUT_FORMAT_INSTRUCTION}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (provider === 'anthropic') {
      if (!apiKey) throw new AIError('config_error', 'Missing AI API key');
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      return {
        url: `${baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model ?? 'claude-3-5-haiku-latest',
            max_tokens: 160,
            system: messages.system,
            messages: [{ role: 'user', content: user }],
          }),
        },
      };
    }

    if (!apiKey) throw new AIError('config_error', 'Missing AI API key');
    headers.Authorization = `Bearer ${apiKey}`;
    if (provider === 'opencode') {
      headers['x-opencode-session'] = this.sessionId;
      headers['User-Agent'] = 'ring-toss-duel/1.0';
    }
    const url = `${baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
    return {
      url,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model ?? 'gpt-4o-mini',
          temperature: 0.9,
          max_tokens: 160,
          // Native OpenAI supports JSON mode; compatible gateways may reject it.
          ...(provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: messages.system },
            { role: 'user', content: user },
          ],
        }),
      },
    };
  }

  private extractText(json: Record<string, unknown>): string {
    if (this.options.provider === 'anthropic') {
      const content = json.content;
      if (Array.isArray(content)) {
        const block = content.find((c) => (
          typeof c === 'object' && c !== null && (c as { type?: string }).type === 'text'
        ));
        if (block) return String((block as { text?: unknown }).text ?? '');
      }
      throw new AIError('parse_error', 'Unexpected Anthropic response shape');
    }

    const content = (json.choices as Array<{ message?: { content?: unknown } }> | undefined)?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AIError('parse_error', 'Empty AI response content');
    }
    return content;
  }

  private async parseResponse(
    text: string,
    expectedType: CommentaryEventType,
  ): Promise<{ eventType: CommentaryEventType; commentary: string; tone: CommentaryTone }> {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
      ? text.slice(jsonStart, jsonEnd + 1)
      : text;

    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      throw new AIError('parse_error', 'AI response is not valid JSON');
    }

    const keys = COMMENTARY_RESULT_KEYS.safeParse(raw);
    if (!keys.success) {
      throw new AIError('schema_error', 'AI response missing required keys');
    }

    const result = commentaryResultSchema.safeParse({
      eventType: expectedType,
      commentary: keys.data.commentary,
      tone: keys.data.tone,
    });
    if (!result.success) {
      throw new AIError('schema_error', 'AI response failed schema validation');
    }
    return result.data;
  }

  private validateAndModerate(
    result: CommentaryResult,
    expectedType: CommentaryEventType,
  ): CommentaryResult {
    if (result.eventType !== expectedType) {
      throw new AIError('schema_error', 'AI response eventType mismatch');
    }
    const safe = moderateCommentary(result.commentary);
    if (!safe) {
      throw new AIError('unsafe_content', 'AI response failed moderation');
    }
    return { ...result, commentary: truncateCommentary(result.commentary) };
  }
}

/** Used when AI is disabled or unconfigured: returns fallback commentary. */
export class FallbackAICommentaryService implements AICommentaryService {
  /** The commentary system is active even without a real AI provider. */
  readonly enabled = true;

  generate(request: CommentaryRequest): Promise<CommentaryResult> {
    return Promise.resolve(this.fallback.generate(request));
  }

  constructor(private fallback: { generate(request: CommentaryRequest): CommentaryResult }) {}
}