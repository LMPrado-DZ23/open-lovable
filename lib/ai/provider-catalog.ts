import { appConfig } from '@/config/app.config';
import { createProviderFetch, validateProviderURL } from './provider-transport';

export type ProviderID = 'openai' | 'anthropic' | 'google' | 'groq' | 'gateway';
export interface ModelOption {
  id: string; label: string; provider: ProviderID; upstreamId: string;
  configured: boolean; source: 'application' | 'operator' | 'discovery';
  capabilities: string[]; capabilityStatus: 'declared' | 'unknown';
}
export interface ModelCatalog {
  models: ModelOption[];
  gateway: {configured:boolean; credentialConfigured:boolean; endpoint?:string; status:'not-configured'|'configured'|'discovered'|'unavailable'; error?:string};
}
export class ProviderConfigError extends Error {
  constructor(message: string, readonly status = 503) {super(message); this.name = 'ProviderConfigError';}
}
const KEY_ENV: Record<Exclude<ProviderID,'gateway'>, string> = {
  openai:'OPENAI_API_KEY', anthropic:'ANTHROPIC_API_KEY', google:'GEMINI_API_KEY', groq:'GROQ_API_KEY',
};
export function validModelID(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./:+-]{0,199}$/.test(id);
}
export function getGatewayConfig(): {baseURL:string; apiKey?:string; models?:string[]} | null {
  const raw = process.env.OPEN_LOVABLE_GATEWAY_URL?.trim();
  if (!raw) return null;
  const url = validateProviderURL(raw, true);
  const apiKey = process.env.OPEN_LOVABLE_GATEWAY_API_KEY?.trim() || undefined;
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) && !apiKey) throw new ProviderConfigError('A remote gateway requires a server-side API key');
  let models: string[] | undefined;
  if (process.env.OPEN_LOVABLE_GATEWAY_MODELS) {
    let rawModels: unknown;
    try {rawModels=JSON.parse(process.env.OPEN_LOVABLE_GATEWAY_MODELS);} catch {throw new ProviderConfigError('OPEN_LOVABLE_GATEWAY_MODELS must be a JSON array of model IDs');}
    if (!Array.isArray(rawModels) || !rawModels.length || rawModels.length > 500 || !rawModels.every(validModelID)) throw new ProviderConfigError('Invalid configured gateway models');
    models=[...new Set(rawModels as string[])];
  }
  return {baseURL:url.href.replace(/\/$/,''), apiKey, models};
}

export function applicationModels(): ModelOption[] {
  return appConfig.ai.availableModels.map(id => {
    const configured = (appConfig.ai.modelApiConfig as Record<string,{provider:string;model:string}>)[id];
    const provider = configured?.provider ?? id.split('/')[0];
    if (!(provider in KEY_ENV)) throw new ProviderConfigError('Application model has an unsupported provider');
    const actualProvider=provider as Exclude<ProviderID,'gateway'>;
    return {id, label:appConfig.ai.modelDisplayNames[id] ?? id, provider:actualProvider,
      upstreamId:configured?.model ?? id.slice(id.indexOf('/')+1),
      configured:Boolean(process.env[KEY_ENV[actualProvider]]?.trim() || process.env.AI_GATEWAY_API_KEY?.trim()),
      source:'application', capabilities:['text','coding'], capabilityStatus:'declared'};
  });
}

export async function loadModelCatalog(signal?: AbortSignal): Promise<ModelCatalog> {
  const models=applicationModels();
  let config: ReturnType<typeof getGatewayConfig>;
  try {config=getGatewayConfig();} catch {return {models,gateway:{configured:true,credentialConfigured:Boolean(process.env.OPEN_LOVABLE_GATEWAY_API_KEY),status:'unavailable',error:'Invalid gateway configuration. Check the server environment.'}};}
  if (!config) return {models,gateway:{configured:false,credentialConfigured:false,status:'not-configured'}};
  const gateway: ModelCatalog['gateway'] = {configured:true,credentialConfigured:Boolean(config.apiKey),endpoint:config.baseURL,status:'configured'};
  try {
    let ids=config.models;
    if (!ids) {
      const guardedFetch=createProviderFetch(config.baseURL,{allowLoopback:true,timeoutMs:5000,maxBytes:1024*1024});
      const response=await guardedFetch(`${config.baseURL}/models`,{signal,headers:config.apiKey ? {Authorization:`Bearer ${config.apiKey}`} : {}});
      if (!response.ok) {await response.body?.cancel(); throw new ProviderConfigError('Gateway catalog request failed');}
      const data=await response.json();
      if (!data || !Array.isArray(data.data) || data.data.length > 500) throw new ProviderConfigError('Gateway returned an invalid model catalog');
      ids=[...new Set<string>(data.data.map((item: {id?:unknown}) => item?.id).filter(validModelID))];
      if (ids.length !== data.data.length) throw new ProviderConfigError('Gateway catalog contains invalid or duplicate model IDs');
      gateway.status='discovered';
    }
    for (const id of ids) models.push({id:`gateway/${id}`,label:id,provider:'gateway',upstreamId:id,configured:true,
      source:config.models ? 'operator' : 'discovery',capabilities:[],capabilityStatus:'unknown'});
    return {models,gateway};
  } catch {
    return {models,gateway:{...gateway,status:'unavailable',error:'Gateway catalog unavailable. Check the endpoint, credentials and network. No fallback provider was selected.'}};
  }
}
