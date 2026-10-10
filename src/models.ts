/**
 * The one place a model is called. Everything goes through the Vercel AI
 * Gateway (one key, every provider, cost reported per call); tests swap in a
 * fake `ModelCaller`.
 *
 * Credentials: AI_GATEWAY_API_KEY, or a VERCEL_OIDC_TOKEN from `vercel env pull`.
 */
import { gateway, generateText, type ModelMessage } from 'ai'

export interface ModelCall {
  model: string
  system?: string
  messages: ModelMessage[]
  maxOutputTokens: number
  temperature?: number
  /** Provider options keyed by provider (e.g. `{ openai: { reasoningEffort: 'low' } }`). */
  providerOptions?: Record<string, Record<string, unknown>>
  tags?: string[]
}

export interface ModelResult {
  text: string
  finishReason: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

export type ModelCaller = (call: ModelCall) => Promise<ModelResult>

export const gatewayCaller: ModelCaller = async (call) => {
  const started = performance.now()
  const result = await generateText({
    model: gateway(call.model),
    system: call.system,
    messages: call.messages,
    maxOutputTokens: call.maxOutputTokens,
    temperature: call.temperature,
    maxRetries: 2,
    providerOptions: {
      ...(call.providerOptions ?? {}),
      gateway: { caching: 'auto', tags: ['pif-bench', ...(call.tags ?? [])] },
    } as never,
  })
  const gw = (result.providerMetadata as Record<string, Record<string, unknown>> | undefined)?.gateway
  return {
    text: result.text,
    finishReason: String(result.finishReason),
    inputTokens: result.usage.inputTokens ?? 0,
    cachedInputTokens: result.usage.cachedInputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    costUsd: gw?.cost !== undefined ? Number(gw.cost) : NaN,
    latencyMs: Math.round(performance.now() - started),
  }
}

/** Fail fast with a useful message instead of a 401 from deep inside a run. */
export function assertGatewayCredentials(): void {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error('No AI Gateway credentials: set AI_GATEWAY_API_KEY (or pull a VERCEL_OIDC_TOKEN with `vercel env pull`) — or pass --env-file to bun.')
  }
}

/** The model family behind a gateway id (`anthropic/claude-sonnet-5.5` → `anthropic`). */
export function familyOfModel(model: string): string {
  return model.split('/')[0]!
}

/** Run `fn` over `items` with at most `limit` in flight. Results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!, i)
    }
  })
  await Promise.all(workers)
  return out
}
