import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectStore, ProjectError, projectStore, dataDirectory, operatorID } from '@/lib/projects/store';
import { validateProviderURL } from '@/lib/ai/provider-transport';

export const providerIDs=['openai','anthropic','google','groq','openrouter','deepseek','mistral','xai','cerebras','together','fireworks','huggingface','gateway'] as const;
/** Providers reached through the OpenAI-compatible Chat Completions protocol with their own key. */
export const compatibleProviderIDs=['openrouter','deepseek','mistral','xai','cerebras','together','fireworks','huggingface'] as const;
export type SettingsProvider=typeof providerIDs[number];
export interface ProviderConfiguration {enabled:boolean;apiKey?:string;baseURL?:string;models?:string[];version?:number;}
export const providerEnvironment:Record<SettingsProvider,{key:string;url:string;defaultURL?:string}>={
 openai:{key:'OPENAI_API_KEY',url:'OPENAI_BASE_URL',defaultURL:'https://api.openai.com/v1'},
 anthropic:{key:'ANTHROPIC_API_KEY',url:'ANTHROPIC_BASE_URL',defaultURL:'https://api.anthropic.com/v1'},
 google:{key:'GEMINI_API_KEY',url:'GEMINI_BASE_URL',defaultURL:'https://generativelanguage.googleapis.com/v1beta'},
 groq:{key:'GROQ_API_KEY',url:'GROQ_BASE_URL',defaultURL:'https://api.groq.com/openai/v1'},
 openrouter:{key:'OPENROUTER_API_KEY',url:'OPENROUTER_BASE_URL',defaultURL:'https://openrouter.ai/api/v1'},
 deepseek:{key:'DEEPSEEK_API_KEY',url:'DEEPSEEK_BASE_URL',defaultURL:'https://api.deepseek.com/v1'},
 mistral:{key:'MISTRAL_API_KEY',url:'MISTRAL_BASE_URL',defaultURL:'https://api.mistral.ai/v1'},
 xai:{key:'XAI_API_KEY',url:'XAI_BASE_URL',defaultURL:'https://api.x.ai/v1'},
 cerebras:{key:'CEREBRAS_API_KEY',url:'CEREBRAS_BASE_URL',defaultURL:'https://api.cerebras.ai/v1'},
 together:{key:'TOGETHER_API_KEY',url:'TOGETHER_BASE_URL',defaultURL:'https://api.together.xyz/v1'},
 fireworks:{key:'FIREWORKS_API_KEY',url:'FIREWORKS_BASE_URL',defaultURL:'https://api.fireworks.ai/inference/v1'},
 huggingface:{key:'HF_TOKEN',url:'HUGGINGFACE_BASE_URL',defaultURL:'https://router.huggingface.co/v1'},
 gateway:{key:'OPEN_LOVABLE_GATEWAY_API_KEY',url:'OPEN_LOVABLE_GATEWAY_URL'},
};
/** Publishing/export integrations share the encrypted credential store but never appear as AI providers. */
export const integrationIDs=['vercel','github','supabase'] as const;
export type IntegrationID=typeof integrationIDs[number];
export const integrationEnvironment:Record<IntegrationID,{key:string;url:string;defaultURL:string}>={
 // Namespaced on purpose: a developer's generic GITHUB_TOKEN must not be picked up silently.
 vercel:{key:'OPEN_LOVABLE_VERCEL_TOKEN',url:'OPEN_LOVABLE_VERCEL_API_URL',defaultURL:'https://api.vercel.com'},
 github:{key:'OPEN_LOVABLE_GITHUB_TOKEN',url:'OPEN_LOVABLE_GITHUB_API_URL',defaultURL:'https://api.github.com'},
 supabase:{key:'OPEN_LOVABLE_SUPABASE_ACCESS_TOKEN',url:'OPEN_LOVABLE_SUPABASE_API_URL',defaultURL:'https://api.supabase.com'},
};
function environmentFor(provider:SettingsProvider|IntegrationID){return (providerEnvironment as Record<string,{key:string;url:string;defaultURL?:string}>)[provider]??integrationEnvironment[provider as IntegrationID];}
function checkProvider(provider:string):asserts provider is SettingsProvider|IntegrationID {
 if(!providerIDs.includes(provider as SettingsProvider)&&!integrationIDs.includes(provider as IntegrationID)) throw new ProjectError('Unknown provider');
}

/** Read and authenticate a stored row without migrations, writes, or logging secret values. */
export function readProviderConfiguration(db: ProjectStore['db'], key: Buffer, owner: string, provider: string): ProviderConfiguration | null {
 if(key.length!==32)throw new ProjectError('Credential master key must contain 32 bytes',503);
  checkProvider(provider);
  const row=db.prepare('SELECT version,encrypted FROM provider_settings WHERE owner=? AND provider=?').get(owner,provider);
  if(!row)return null;
  try {
   const bytes=Buffer.from(row.encrypted as string,'base64');
   if(bytes.length<29)throw new Error('Invalid ciphertext');
   const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
   decipher.setAAD(Buffer.from(`${owner}:${provider}:${row.version}`));decipher.setAuthTag(bytes.subarray(12,28));
   const plaintext=Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
   return {...JSON.parse(plaintext),version:row.version};
  }catch {throw new ProjectError('Cannot decrypt provider credentials. Restore the original master key; configuration was preserved.',503);}
}

/** Encrypted configuration, scoped to the authenticated operator; no plaintext credentials in SQLite. */
export class CredentialStore {
 constructor(private readonly store:ProjectStore,private readonly key:Buffer) {if(key.length!==32) throw new ProjectError('Credential master key must contain 32 bytes',503);}
 read(owner:string,provider:string):ProviderConfiguration|null {
  return readProviderConfiguration(this.store.db,this.key,owner,provider);
 }
 save(owner:string,provider:string,expectedVersion:number,input:Partial<ProviderConfiguration>&{clearKey?:boolean}):void {
  checkProvider(provider);
  if(!owner||owner.length>128||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new ProjectError('Invalid credential request');
  if(typeof input.enabled!=='boolean')throw new ProjectError('Enabled must be explicit');
  if(input.apiKey!==undefined&&(typeof input.apiKey!=='string'||input.apiKey.length>8192||/[\r\n\0]/.test(input.apiKey)))throw new ProjectError('Invalid API key');
  const baseURL=input.baseURL?.trim();
  if(baseURL)validateProviderURL(baseURL,true);
  if(input.models && (!Array.isArray(input.models)||input.models.length>500||!input.models.every(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:+-]{0,199}$/.test(id))))throw new ProjectError('Invalid model IDs');
  this.store.transaction(()=>{
   const previous=this.read(owner,provider);
   if((previous?.version||0)!==expectedVersion)throw new ProjectError('Configuration version conflict. Reload before saving.',409);
   const destination=baseURL||previous?.baseURL||environmentFor(provider).defaultURL;
   const priorDestination=previous?.baseURL||environmentFor(provider).defaultURL;
   const enteredKey=input.apiKey?.trim();
   // A blank field preserves a secret only for the same canonical origin and base path.
   const audience=(value:string|undefined)=>value?validateProviderURL(value,true).href.replace(/\/+$/,''):'';
   if(previous?.apiKey && !input.clearKey && !enteredKey && audience(destination)!==audience(priorDestination)) {
    throw new ProjectError('Endpoint changed. Re-enter the API key for this destination or explicitly clear the stored key. The previous connection was preserved.',409);
   }
   const apiKey=input.clearKey ? undefined : enteredKey||previous?.apiKey;
   if(apiKey&&!destination)throw new ProjectError('An endpoint is required before binding a credential.');
   const next:ProviderConfiguration={enabled:input.enabled===true,baseURL:destination?validateProviderURL(destination,true).href.replace(/\/+$/,''):undefined,apiKey,models:input.models??previous?.models};
   const version=expectedVersion+1;
   const nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',this.key,nonce);
   cipher.setAAD(Buffer.from(`${owner}:${provider}:${version}`));
   const encrypted=Buffer.concat([cipher.update(JSON.stringify(next),'utf8'),cipher.final()]);
   const payload=Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64');
   this.store.db.prepare('INSERT INTO provider_settings VALUES(?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET version=excluded.version, encrypted=excluded.encrypted,updated_at=excluded.updated_at').run(owner,provider,version,payload,new Date().toISOString());
  });
 }
 metadata(owner:string):Array<{provider:SettingsProvider;enabled:boolean;version:number;credentialConfigured:boolean;baseURL?:string;models?:string[]}> {
  const result=[];
  for(const provider of providerIDs) {
   const value=this.read(owner,provider);
   if(value)result.push({provider,enabled:value.enabled,version:value.version!,credentialConfigured:Boolean(value.apiKey),baseURL:value.baseURL,models:value.models});
  }
  return result;
 }
}

export function masterKey():Buffer {
 const env=process.env.OPEN_LOVABLE_MASTER_KEY;
 if(env) {
  const key=Buffer.from(env,'base64');
  if(key.length!==32)throw new ProjectError('OPEN_LOVABLE_MASTER_KEY must be 32 bytes in base64',503);
  return key;
 }
 const path=join(dataDirectory(),'credentials.key');
 try {if(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())throw new ProjectError('Credential key must be a regular private file',503);}
 catch(error) {
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  const count=Number(projectStore().db.prepare('SELECT count(*) AS n FROM provider_settings').get()?.n);
  const sessions=Number(projectStore().db.prepare("SELECT count(*) AS n FROM auth_sessions WHERE encrypted<>''").get()?.n);
  if(count||sessions)throw new ProjectError('Credential key is missing. Restore it from backup; existing credentials were not overwritten.',503);
  try {const fd=openSync(path,'wx',0o600);try {writeFileSync(fd,randomBytes(32));}finally{closeSync(fd);}}
  catch(writeError) {if((writeError as NodeJS.ErrnoException).code!=='EEXIST')throw writeError;}
 }
 const key=readFileSync(path);if(key.length!==32)throw new ProjectError('Invalid stored credential master key',503);
 return key;
}
export function credentialStore():CredentialStore {return new CredentialStore(projectStore(),masterKey());}

export interface ProviderScope {owner:string;allowLoopback:boolean;}

/** Environment is an explicit deployment override. UI changes never mutate process.env. */
export function effectiveProvider(provider:SettingsProvider,scope?:ProviderScope):ProviderConfiguration & {source:'environment'|'saved'|'unconfigured'} {
 const mapping=providerEnvironment[provider];
 if(scope){
  if(!/^workspace:[0-9a-f-]{36}$/.test(scope.owner))throw new ProjectError('Invalid connection scope',403);
  const value=credentialStore().read(scope.owner,provider);
  return value?{...value,source:'saved'}:{enabled:false,baseURL:mapping.defaultURL,source:'unconfigured'};
 }
 if(process.env[mapping.key]?.trim()||process.env[mapping.url]?.trim()) {
  let models:string[]|undefined;
  if(provider==='gateway' && process.env.OPEN_LOVABLE_GATEWAY_MODELS) {
   const parsed=JSON.parse(process.env.OPEN_LOVABLE_GATEWAY_MODELS);
   if(!Array.isArray(parsed)||!parsed.length||!parsed.every(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:+-]{0,199}$/.test(id))||parsed.length>500)throw new ProjectError('Invalid configured gateway models',503);
   models=[...new Set(parsed as string[])];
  }
  return {enabled:true,apiKey:process.env[mapping.key]?.trim()||undefined,baseURL:process.env[mapping.url]?.trim()||mapping.defaultURL,models,source:'environment'};
 }
 // Tests and deployment can explicitly disable persisted settings reads; no production fallback data is fabricated.
 if(process.env.OPEN_LOVABLE_DISABLE_SAVED_SETTINGS==='1')return {enabled:false,baseURL:mapping.defaultURL,source:'unconfigured'};
 const value=credentialStore().read(operatorID(),provider);
 return value?{...value,source:'saved'}:{enabled:false,baseURL:mapping.defaultURL,source:'unconfigured'};
}

/** Token for a publishing integration: an explicit deployment variable wins over the saved encrypted value. */
export function integrationCredential(integration:IntegrationID,scope?:ProviderScope):{token?:string;source:'environment'|'saved'|'unconfigured';version:number} {
 const mapping=integrationEnvironment[integration];
 if(!scope&&process.env[mapping.key]?.trim())return {token:process.env[mapping.key]!.trim(),source:'environment',version:0};
 if(!scope&&process.env.OPEN_LOVABLE_DISABLE_SAVED_SETTINGS==='1')return {source:'unconfigured',version:0};
 const value=credentialStore().read(scope?scope.owner:operatorID(),integration);
 return value?.apiKey&&value.enabled?{token:value.apiKey,source:'saved',version:value.version||0}:{source:value?'saved':'unconfigured',version:value?.version||0};
}
