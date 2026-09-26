import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory, ProjectError } from '@/lib/projects/store';
import { credentialStore } from '@/lib/settings/store';
import { CONNECTORS, connector, connectorVariable, type Connector } from './catalog';

/**
 * Per-project connector state. Public values (designed for frontends) live in
 * a JSON document beside the private data and are written into the app as
 * src/lib/connectors.js. Secret values are shared by the workspace and stored
 * encrypted in the credential store under "connector:<id>"; they never enter
 * project files, prompts or the browser.
 */
export interface ProjectConnectors {enabled: string[]; publicValues: Record<string, Record<string, string>>}
export const CONNECTORS_FILE_PATH = 'src/lib/connectors.js';

function file(projectId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(projectId)) throw new ProjectError('Invalid project identifier', 400);
  const directory = join(dataDirectory(), 'connectors');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return join(directory, `${projectId}.json`);
}

export function readProjectConnectors(projectId: string): ProjectConnectors {
  try {
    const value = JSON.parse(readFileSync(file(projectId), 'utf8')) as ProjectConnectors;
    return {enabled: value.enabled.filter(id => connector(id)), publicValues: value.publicValues ?? {}};
  } catch {
    return {enabled: [], publicValues: {}};
  }
}

export function saveProjectConnectors(projectId: string, input: ProjectConnectors): ProjectConnectors {
  const enabled = [...new Set(input.enabled)].filter(id => connector(id)).slice(0, CONNECTORS.length);
  const publicValues: ProjectConnectors['publicValues'] = {};
  for (const id of enabled) {
    const definition = connector(id)!;
    if (definition.kind !== 'public') continue;
    const values: Record<string, string> = {};
    for (const field of definition.fields) {
      const value = String(input.publicValues?.[id]?.[field.key] ?? '').trim().slice(0, 500);
      if (value && /[<>"'`\\\r\n]/.test(value)) throw new ProjectError(`Valor inválido em ${definition.name} → ${field.label}.`, 400);
      if (value) values[field.key] = value;
    }
    publicValues[id] = values;
  }
  const state = {enabled, publicValues};
  const path = file(projectId);
  writeFileSync(path + '.tmp', JSON.stringify(state), {mode: 0o600});
  renameSync(path + '.tmp', path);
  return state;
}

/** The public configuration file written into the app; secret connectors are listed by name only. */
export function connectorsModuleSource(state: ProjectConnectors, backendURL?: string): string {
  const config: Record<string, Record<string, string>> = {};
  for (const id of state.enabled) {
    const definition = connector(id);
    if (definition?.kind === 'public') config[connectorVariable(id)] = state.publicValues[id] ?? {};
  }
  const secret = state.enabled.filter(id => connector(id)?.kind === 'secret');
  return `// Conectores do projeto, gerados pelo Open Lovable. Só valores públicos ficam aqui.
export const connectors = ${JSON.stringify(config, null, 2)};

/** Conectores com chave secreta: use por uma função do Supabase, nunca direto no navegador. */
export const serverConnectors = ${JSON.stringify(secret)};

/** Chama a função do Supabase de um conector secreto (supabase/functions/<nome>). */
${backendURL ? `import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

export async function callConnector(name, body) {
  const response = await fetch(SUPABASE_URL + '/functions/v1/' + name, {method: 'POST', headers: {'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY}, body: JSON.stringify(body ?? {})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro ' + response.status);
  return data;
}` : `export async function callConnector() {
  throw new Error('Conecte o Supabase ao projeto para usar conectores com chave secreta.');
}`}
`;
}

/** Instructions appended to the model prompt for every enabled connector. */
export function connectorsGuidance(state: ProjectConnectors, backendURL?: string): string {
  const enabled = state.enabled.map(id => connector(id)).filter((item): item is Connector => Boolean(item));
  if (!enabled.length) return '';
  const lines = enabled.map(item => item.kind === 'public'
    ? `- ${item.name} (public): values in connectors.${connectorVariable(item.id)} from '/src/lib/connectors' (fields: ${item.fields.map(field => field.key).join(', ') || 'none'}). ${item.usage}`
    : `- ${item.name} (SECRET, server only): write a Supabase Edge Function at supabase/functions/${item.id}/index.ts (Deno) that reads ${item.fields.map(field => `Deno.env.get('${field.env}')`).join(', ')} and answers the app; call it from the app with callConnector('${item.id}', body) from '/src/lib/connectors'. ${item.usage}${backendURL ? '' : ' (Supabase is not connected yet: tell the user to connect it in the Supabase tab.)'}`);
  return `\n\nCONNECTORS ENABLED FOR THIS APP (use them when the request needs them; never hardcode secret keys in frontend code):\n${lines.join('\n')}`;
}

// --- Workspace-level secret values ---
const credentialName = (id: string) => `connector:${id}`;

export function connectorSecretStatus(owner: string): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  const store = credentialStore();
  for (const item of CONNECTORS) if (item.kind === 'secret') status[item.id] = Boolean(store.read(owner, credentialName(item.id))?.apiKey);
  return status;
}

export function saveConnectorSecret(owner: string, id: string, values: Record<string, string> | null): void {
  const definition = connector(id);
  if (!definition || definition.kind !== 'secret') throw new ProjectError('Conector secreto desconhecido.', 404);
  const store = credentialStore();
  const version = store.read(owner, credentialName(id))?.version ?? 0;
  if (values === null) { store.save(owner, credentialName(id), version, {enabled: true, clearKey: true}); return; }
  const clean: Record<string, string> = {};
  for (const field of definition.fields) {
    const value = String(values[field.key] ?? '').trim();
    if (!value) throw new ProjectError(`Preencha ${field.label} de ${definition.name}.`, 400);
    if (value.length > 2000 || /[\r\n\0]/.test(value)) throw new ProjectError(`Valor inválido em ${field.label}.`, 400);
    clean[field.env] = value;
  }
  store.save(owner, credentialName(id), version, {enabled: true, apiKey: JSON.stringify(clean), baseURL: definition.baseURL});
}

function readConnectorSecret(owner: string, id: string): Record<string, string> | null {
  const value = credentialStore().read(owner, credentialName(id))?.apiKey;
  if (!value) return null;
  try { return JSON.parse(value) as Record<string, string>; } catch { return null; }
}

/** Copy the enabled secret connectors into the project's Supabase Edge Function secrets. */
export async function pushConnectorSecrets(options: {owner: string; state: ProjectConnectors; projectRef: string; token: string; fetchImpl?: typeof fetch}): Promise<string[]> {
  const secrets: Array<{name: string; value: string}> = [];
  for (const id of options.state.enabled) {
    if (connector(id)?.kind !== 'secret') continue;
    const values = readConnectorSecret(options.owner, id);
    if (!values) throw new ProjectError(`Salve a chave de ${connector(id)!.name} em Configurações → Conectores.`, 409);
    for (const [name, value] of Object.entries(values)) secrets.push({name, value});
  }
  if (!secrets.length) return [];
  if (!/^[a-z0-9]{20}$/.test(options.projectRef)) throw new ProjectError('Projeto Supabase inválido.', 400);
  // The provider transport rejects bodies that look like secrets (by design), so this one request goes to a
  // fixed, hard-coded Supabase API origin — no user-controlled host — and is never logged.
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${options.projectRef}/secrets`, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: {Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(secrets)});
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProjectError(response.status === 401 || response.status === 403 ? 'O Supabase recusou o token de acesso.' : `O Supabase não aceitou os segredos (HTTP ${response.status}).`, 502);
  }
  await response.body?.cancel();
  return secrets.map(secret => secret.name);
}
