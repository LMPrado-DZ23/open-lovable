import { createHash } from 'node:crypto';
import { APICallError } from 'ai';
import { createProviderFetch } from './provider-transport';

import type { SettingsProvider } from '@/lib/settings/store';

export type DiscoverableProvider = Exclude<SettingsProvider, 'gateway'>;

export interface DiscoveredModel {
  upstreamId: string;
  label: string;
  /** Context window in tokens, when the provider publishes it. */
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

/** Usage limits reported by the provider in response headers; absent values are unknown, never guessed. */
export interface RateLimits {
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  resetRequests?: string;
  resetTokens?: string;
}

export interface ProviderDiscovery {
  status: 'discovered' | 'unavailable';
  checkedAt: string;
  models: DiscoveredModel[];
  rateLimits?: RateLimits;
  error?: string;
}

const SUCCESS_TTL_MS = 10 * 60_000;
const FAILURE_TTL_MS = 60_000;
const MAX_MODELS = 500;
const cache = new Map<string, {expires: number; value: Promise<ProviderDiscovery>}>();

export function clearDiscoveryCache(): void {
  cache.clear();
}

/** Chat/text generation models only; embeddings, audio, image and moderation models cannot run this app. */
const NON_CHAT = /(embed|embedding|whisper|tts|transcribe|dall-e|gpt-image|imagen|veo|moderation|omni-moderation|realtime|audio|search-preview|computer-use|aqa|guard|babbage|davinci|lyria|native-audio|image-generation|orpheus|playai|(^|-)image(-|$)|nano-banana|deep-research|robotics)/i;

function number(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseRateLimitHeaders(headers: Headers | Record<string, string | undefined> | undefined): RateLimits | undefined {
  if (!headers) return undefined;
  const get = (name: string): string | null => headers instanceof Headers ? headers.get(name) : (headers[name] ?? headers[name.toLowerCase()] ?? null);
  const limits: RateLimits = {
    requestsLimit: number(get('x-ratelimit-limit-requests') ?? get('anthropic-ratelimit-requests-limit')),
    requestsRemaining: number(get('x-ratelimit-remaining-requests') ?? get('anthropic-ratelimit-requests-remaining')),
    tokensLimit: number(get('x-ratelimit-limit-tokens') ?? get('anthropic-ratelimit-tokens-limit')),
    tokensRemaining: number(get('x-ratelimit-remaining-tokens') ?? get('anthropic-ratelimit-tokens-remaining')),
    resetRequests: get('x-ratelimit-reset-requests') ?? get('anthropic-ratelimit-requests-reset') ?? undefined,
    resetTokens: get('x-ratelimit-reset-tokens') ?? get('anthropic-ratelimit-tokens-reset') ?? undefined,
  };
  for (const key of Object.keys(limits) as Array<keyof RateLimits>) if (limits[key] === undefined) delete limits[key];
  return Object.keys(limits).length ? limits : undefined;
}

function validID(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./:+-]{0,199}$/.test(id);
}

/** Parse each provider's native model listing into one shape. Exported for tests. */
export function parseModelListing(provider: DiscoverableProvider, data: unknown): DiscoveredModel[] {
  const models: DiscoveredModel[] = [];
  const record = data as Record<string, unknown> | null;
  if (provider === 'google') {
    const items = Array.isArray(record?.models) ? record.models as Array<Record<string, unknown>> : [];
    for (const item of items) {
      const methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
      const id = typeof item.name === 'string' ? item.name.replace(/^models\//, '') : undefined;
      if (!validID(id) || !methods.includes('generateContent') || NON_CHAT.test(id)) continue;
      models.push({upstreamId: id, label: typeof item.displayName === 'string' && item.displayName ? item.displayName : id,
        inputTokenLimit: typeof item.inputTokenLimit === 'number' ? item.inputTokenLimit : undefined,
        outputTokenLimit: typeof item.outputTokenLimit === 'number' ? item.outputTokenLimit : undefined});
    }
  } else {
    // Together returns a bare array; everyone else wraps the list in {data}.
    const items = (Array.isArray(data) ? data : Array.isArray(record?.data) ? record.data : []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const id = item.id;
      if (!validID(id) || NON_CHAT.test(id)) continue;
      if (provider === 'openai' && !/^(gpt-|o\d|chatgpt-|codex-)/i.test(id)) continue;
      if (item.active === false) continue;
      const capabilities = item.capabilities as Record<string, unknown> | undefined;
      if (capabilities && capabilities.completion_chat === false) continue;
      if (typeof item.type === 'string' && ['embedding', 'image', 'audio', 'moderation', 'rerank', 'transcribe', 'video'].includes(item.type)) continue;
      const name = typeof item.display_name === 'string' && item.display_name ? item.display_name : typeof item.name === 'string' && item.name ? item.name : id;
      const context = typeof item.context_window === 'number' ? item.context_window : typeof item.context_length === 'number' ? item.context_length : undefined;
      models.push({upstreamId: id, label: name,
        inputTokenLimit: context,
        outputTokenLimit: typeof item.max_completion_tokens === 'number' ? item.max_completion_tokens : undefined});
    }
  }
  const unique = new Map(models.map(model => [model.upstreamId, model]));
  return [...unique.values()].slice(0, MAX_MODELS).sort((a, b) => a.label.localeCompare(b.label));
}

function listingRequest(provider: DiscoverableProvider, baseURL: string, apiKey: string): {url: string; headers: Record<string, string>} {
  switch (provider) {
    // The key goes in a header, never in the URL, so it cannot leak through access logs.
    case 'google': return {url: `${baseURL}/models?pageSize=1000`, headers: {'x-goog-api-key': apiKey}};
    case 'anthropic': return {url: `${baseURL}/models?limit=1000`, headers: {'x-api-key': apiKey, 'anthropic-version': '2023-06-01'}};
    default: return {url: `${baseURL}/models`, headers: {Authorization: `Bearer ${apiKey}`}};
  }
}

async function fetchDiscovery(provider: DiscoverableProvider, baseURL: string, apiKey: string, allowLoopback: boolean): Promise<ProviderDiscovery> {
  const checkedAt = new Date().toISOString();
  try {
    const guardedFetch = createProviderFetch(baseURL, {allowLoopback, timeoutMs: 8000, maxDurationMs: 8000, maxBytes: 4 * 1024 * 1024});
    const {url, headers} = listingRequest(provider, baseURL, apiKey);
    const response = await guardedFetch(url, {headers});
    if (!response.ok) {
      await response.body?.cancel();
      const reason = response.status === 401 || response.status === 403 ? 'Chave de API recusada pelo provedor.'
        : response.status === 429 ? 'Limite de uso do provedor atingido ao consultar os modelos.'
        : `O provedor respondeu com erro HTTP ${response.status}.`;
      return {status: 'unavailable', checkedAt, models: [], error: reason};
    }
    const models = parseModelListing(provider, await response.json());
    if (!models.length) return {status: 'unavailable', checkedAt, models: [], error: 'O provedor não informou nenhum modelo de texto disponível para esta chave.'};
    return {status: 'discovered', checkedAt, models, rateLimits: parseRateLimitHeaders(response.headers)};
  } catch {
    return {status: 'unavailable', checkedAt, models: [], error: 'Não foi possível consultar o catálogo do provedor. Verifique o endpoint e a rede.'};
  }
}

/** Cached per credential: saving a new key changes the fingerprint, so the next read re-discovers. */
export function discoverProviderModels(provider: DiscoverableProvider, baseURL: string, apiKey: string, allowLoopback: boolean): Promise<ProviderDiscovery> {
  const fingerprint = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  const key = `${provider}|${baseURL}|${fingerprint}|${allowLoopback}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = fetchDiscovery(provider, baseURL, apiKey, allowLoopback);
  cache.set(key, {expires: now + SUCCESS_TTL_MS, value});
  void value.then(result => {
    if (result.status !== 'discovered') cache.set(key, {expires: Date.now() + FAILURE_TTL_MS, value});
  });
  if (cache.size > 200) {
    for (const [entry, item] of cache) if (item.expires <= now) cache.delete(entry);
  }
  return value;
}

/** Translate the provider's HTTP status into an actionable message without echoing upstream bodies. */
export function modelTestFailure(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status === 401 || status === 403) return 'O provedor recusou a chave de API ou ela não tem permissão para este modelo.';
  if (status === 404) return 'Este modelo não existe mais ou não está liberado para a sua chave. Clique em "Atualizar catálogo" e escolha um modelo da lista detectada.';
  if (status === 429) return 'Limite de uso ou cota do provedor atingido para este modelo. No plano gratuito alguns modelos não ficam disponíveis; tente outro modelo ou aguarde a renovação da cota.';
  if (status === 400) return 'O provedor rejeitou a requisição para este modelo. Ele pode não aceitar geração de texto.';
  if (status !== undefined && status >= 500) return `O provedor está com instabilidade (HTTP ${status}). Tente novamente em alguns minutos.`;
  return 'Falha no teste do modelo. Verifique a chave, a cota e o suporte do modelo. Nenhum outro provedor foi usado.';
}
