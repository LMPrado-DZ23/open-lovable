import { effectiveProvider, providerEnvironment, providerIDs, type ProviderScope, type SettingsProvider } from '@/lib/settings/store';
import { appConfig } from '@/config/app.config';
import { createProviderFetch, validateProviderURL } from './provider-transport';
import { discoverProviderModels, type DiscoverableProvider, type RateLimits } from './provider-discovery';

export type ProviderID = SettingsProvider;
export interface ModelOption {
  id: string; label: string; provider: ProviderID; upstreamId: string;
  configured: boolean; source: 'application' | 'operator' | 'discovery';
  capabilities: string[]; capabilityStatus: 'declared' | 'unknown';
  inputTokenLimit?: number; outputTokenLimit?: number;
}
export interface ProviderCatalogStatus {
  status: 'discovered' | 'pinned' | 'unavailable';
  checkedAt?: string; modelCount: number; rateLimits?: RateLimits; error?: string;
}
export interface ModelCatalog {
  profile?:'individual'|'supabase';workspaceId?:string;
  models: ModelOption[];
  /** Per-provider live discovery for connections that have a key and no pinned model list. */
  providers?: Partial<Record<DiscoverableProvider, ProviderCatalogStatus>>;
  gateway: {configured:boolean; credentialConfigured:boolean; endpoint?:string; status:'not-configured'|'configured'|'discovered'|'unavailable'; error?:string;
    /** Set when no connection was saved and a local model server answered on its default port. */
    detected?: string};
}
export class ProviderConfigError extends Error {
  constructor(message: string, readonly status = 503) {super(message); this.name = 'ProviderConfigError';}
}
const KEY_ENV: Record<'openai'|'anthropic'|'google'|'groq', string> = {
  openai:'OPENAI_API_KEY', anthropic:'ANTHROPIC_API_KEY', google:'GEMINI_API_KEY', groq:'GROQ_API_KEY',
};

/** Local model servers probed on their default loopback ports when no gateway was configured. */
export const LOCAL_MODEL_SERVERS = [
  {name: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1'},
  {name: 'LM Studio', baseURL: 'http://127.0.0.1:1234/v1'},
] as const;
let localDetection: {expires: number; value: Promise<{name: string; baseURL: string} | null>} | null = null;
let detectedLocal: {name: string; baseURL: string} | null = null;

function localDetectionEnabled(scope?: ProviderScope): boolean {
  // Only the single-operator install may reach its own loopback; workspaces never inherit it.
  return !scope && process.env.OPEN_LOVABLE_DISABLE_LOCAL_DETECTION !== '1' && effectiveProvider('gateway').source === 'unconfigured';
}

export function resetLocalDetection(): void {
  localDetection = null;
  detectedLocal = null;
}

async function probeLocal(): Promise<{name: string; baseURL: string} | null> {
  for (const server of LOCAL_MODEL_SERVERS) {
    try {
      const guardedFetch = createProviderFetch(server.baseURL, {allowLoopback: true, timeoutMs: 800, maxDurationMs: 1500, maxBytes: 1024 * 1024});
      const response = await guardedFetch(`${server.baseURL}/models`);
      if (!response.ok) { await response.body?.cancel(); continue; }
      const data = await response.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) return {...server};
    } catch { /* not running */ }
  }
  return null;
}

/** Re-probe every 30 s so starting or stopping Ollama is picked up without restarting the app. */
async function detectLocalServer(): Promise<{name: string; baseURL: string} | null> {
  const now = Date.now();
  if (!localDetection || localDetection.expires <= now) localDetection = {expires: now + 30_000, value: probeLocal()};
  detectedLocal = await localDetection.value;
  return detectedLocal;
}
export function validModelID(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./:+-]{0,199}$/.test(id);
}
export function getGatewayConfig(scope?:ProviderScope): {baseURL:string; apiKey?:string; models?:string[]} | null {
  const saved=effectiveProvider('gateway',scope);
  if(!saved.enabled || !saved.baseURL) {
    if(detectedLocal && localDetectionEnabled(scope))return {baseURL:detectedLocal.baseURL};
    return null;
  }
  const url=validateProviderURL(saved.baseURL,scope?.allowLoopback??true);
  const apiKey=saved.apiKey;
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!apiKey)throw new ProviderConfigError('A remote gateway requires a server-side API key');
  return {baseURL:url.href.replace(/\/$/,''),apiKey,models:saved.models?.length?saved.models:undefined};
}

export function applicationModels(scope?:ProviderScope): ModelOption[] {
  const options:ModelOption[]=appConfig.ai.availableModels.map(id => {
    const configured=(appConfig.ai.modelApiConfig as Record<string,{provider:string;model:string}>)[id];
    const provider=configured?.provider??id.split('/')[0];
    if(!(provider in KEY_ENV))throw new ProviderConfigError('Application model has an unsupported provider');
    const actualProvider=provider as Exclude<ProviderID,'gateway'>;
    const saved=effectiveProvider(actualProvider,scope);
    return {id,label:appConfig.ai.modelDisplayNames[id]??id,provider:actualProvider,
      upstreamId:configured?.model??id.slice(id.indexOf('/')+1),
      configured:Boolean((saved.enabled&&saved.apiKey)||(!scope&&process.env.AI_GATEWAY_API_KEY?.trim())),
      source:'application',capabilities:['text','coding'],capabilityStatus:'declared'};
  });
  for(const provider of providerIDs.filter(id=>id!=='gateway')) {
    const saved=effectiveProvider(provider,scope);
    for(const upstreamId of saved.models||[]) {
      const id=provider+'/'+upstreamId;
      if(!options.some(option=>option.id===id)) options.push({id,label:upstreamId,upstreamId,provider,
        configured:Boolean(saved.enabled&&saved.apiKey),source:'operator',capabilities:[],capabilityStatus:'unknown'});
    }
  }
  return options;
}

const DISCOVERABLE = providerIDs.filter((id): id is DiscoverableProvider => id !== 'gateway');

/**
 * Replace the static model list of every keyed provider with what the provider
 * itself reports for that key. Retired application models disappear, new ones
 * appear, and an operator-pinned list (the models field) always wins.
 */
async function applyProviderDiscovery(models: ModelOption[], scope?: ProviderScope): Promise<ModelCatalog['providers']> {
  const providers: NonNullable<ModelCatalog['providers']> = {};
  // The Vercel AI Gateway routes every provider through one key; per-provider listings do not apply.
  if (!scope && process.env.AI_GATEWAY_API_KEY?.trim()) return providers;
  await Promise.all(DISCOVERABLE.map(async provider => {
    const saved = effectiveProvider(provider, scope);
    if (!saved.enabled || !saved.apiKey) return;
    if (saved.models?.length) { providers[provider] = {status: 'pinned', modelCount: saved.models.length}; return; }
    const baseURL = saved.baseURL || providerEnvironment[provider].defaultURL!;
    const allowLoopback = scope ? scope.allowLoopback : Boolean(saved.baseURL);
    const result = await discoverProviderModels(provider, baseURL, saved.apiKey, allowLoopback);
    providers[provider] = {status: result.status, checkedAt: result.checkedAt, modelCount: result.models.length, rateLimits: result.rateLimits, error: result.error};
    if (result.status !== 'discovered') return;
    const available = new Map(result.models.map(model => [model.upstreamId, model]));
    for (let index = models.length - 1; index >= 0; index--) {
      const option = models[index];
      if (option.provider !== provider) continue;
      const live = available.get(option.upstreamId);
      if (!live) { models.splice(index, 1); continue; }
      option.inputTokenLimit = live.inputTokenLimit;
      option.outputTokenLimit = live.outputTokenLimit;
    }
    for (const live of result.models) {
      const id = `${provider}/${live.upstreamId}`;
      if (models.some(option => option.id === id)) continue;
      models.push({id, label: live.label, provider, upstreamId: live.upstreamId, configured: true, source: 'discovery',
        capabilities: ['text'], capabilityStatus: 'unknown', inputTokenLimit: live.inputTokenLimit, outputTokenLimit: live.outputTokenLimit});
    }
  }));
  return providers;
}

export async function loadModelCatalog(signal?: AbortSignal,scope?:ProviderScope): Promise<ModelCatalog> {
  const models=applicationModels(scope);
  const providers=await applyProviderDiscovery(models,scope);
  const local=localDetectionEnabled(scope) ? await detectLocalServer() : null;
  let config: ReturnType<typeof getGatewayConfig>;
  try {config=getGatewayConfig(scope);} catch {return {models,providers,gateway:{configured:true,credentialConfigured:Boolean(!scope&&process.env.OPEN_LOVABLE_GATEWAY_API_KEY),status:'unavailable',error:'Invalid gateway configuration. Check the server environment.'}};}
  if (!config) return {models,providers,gateway:{configured:false,credentialConfigured:false,status:'not-configured'}};
  const gateway: ModelCatalog['gateway'] = {configured:true,credentialConfigured:Boolean(config.apiKey),endpoint:config.baseURL,status:'configured',
    ...(local && config.baseURL===local.baseURL ? {detected:local.name} : {})};
  try {
    let ids=config.models;
    if (!ids) {
      const guardedFetch=createProviderFetch(config.baseURL,{allowLoopback:scope?.allowLoopback??true,timeoutMs:5000,maxDurationMs:5000,maxBytes:1024*1024});
      const response=await guardedFetch(`${config.baseURL}/models`,{signal,headers:config.apiKey ? {Authorization:`Bearer ${config.apiKey}`} : {}});
      if (!response.ok) {await response.body?.cancel(); throw new ProviderConfigError('Gateway catalog request failed');}
      const data=await response.json();
      if (!data || !Array.isArray(data.data) || data.data.length > 500) throw new ProviderConfigError('Gateway returned an invalid model catalog');
      ids=[...new Set<string>(data.data.map((item: {id?:unknown}) => item?.id).filter(validModelID))];
      if (ids.length !== data.data.length) throw new ProviderConfigError('Gateway catalog contains invalid or duplicate model IDs');
      // Embedding models (e.g. nomic-embed-text in Ollama) cannot generate code.
      ids=ids.filter(id=>!/embed/i.test(id));
      gateway.status='discovered';
    }
    for (const id of ids) models.push({id:`gateway/${id}`,label:id,provider:'gateway',upstreamId:id,configured:true,
      source:config.models ? 'operator' : 'discovery',capabilities:[],capabilityStatus:'unknown'});
    return {models,providers,gateway};
  } catch {
    return {models,providers,gateway:{...gateway,status:'unavailable',error:'Gateway catalog unavailable. Check the endpoint, credentials and network. No fallback provider was selected.'}};
  }
}
