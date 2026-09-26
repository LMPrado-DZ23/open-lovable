import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProviderFetch } from '@/lib/ai/provider-transport';
import { dataDirectory, ProjectError } from '@/lib/projects/store';

/**
 * Lovable-style Supabase backend for a generated app. The project keeps only
 * public values (URL + anon key, which Supabase designs to ship in frontends);
 * the management token that can change the database lives in Integrations.
 */
export interface ProjectBackend {projectRef: string; url: string; anonKey: string; appliedMigrations: string[]; updatedAt: string}

export const SUPABASE_CLIENT_PATH = 'src/lib/supabase.js';
export const MIGRATIONS_DIRECTORY = 'supabase/migrations/';

function assertProjectID(projectId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(projectId)) throw new ProjectError('Invalid project identifier', 400);
}
function backendFile(projectId: string): string {
  assertProjectID(projectId);
  const directory = join(dataDirectory(), 'backends');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return join(directory, `${projectId}.json`);
}

export function parseSupabaseURL(value: string): {url: string; projectRef: string} {
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new ProjectError('Informe o endereço do projeto Supabase, como https://abcd1234.supabase.co.', 400); }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || !match || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new ProjectError('Use o endereço do projeto no formato https://<ref>.supabase.co.', 400);
  return {url: `https://${match[1]}.supabase.co`, projectRef: match[1]};
}

/** The anon/publishable key is public by design; a service_role key would grant full access and is refused. */
export function assertPublicKey(anonKey: string): void {
  const key = anonKey.trim();
  if (/^sb_secret_/.test(key)) throw new ProjectError('Esta é uma chave secreta. Use a chave pública (anon ou sb_publishable_…).', 400);
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return;
  const parts = key.split('.');
  if (parts.length !== 3) throw new ProjectError('Chave pública do Supabase em formato inválido.', 400);
  let role = '';
  try { role = String(JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role ?? ''); } catch { throw new ProjectError('Chave pública do Supabase em formato inválido.', 400); }
  if (role !== 'anon') throw new ProjectError('Esta chave não é a pública (anon). Nunca use a service_role no app.', 400);
}

export function readProjectBackend(projectId: string): ProjectBackend | null {
  try { return JSON.parse(readFileSync(backendFile(projectId), 'utf8')) as ProjectBackend; } catch { return null; }
}

export function saveProjectBackend(projectId: string, urlValue: string, anonKey: string): ProjectBackend {
  const {url, projectRef} = parseSupabaseURL(urlValue);
  assertPublicKey(anonKey);
  const previous = readProjectBackend(projectId);
  const backend: ProjectBackend = {projectRef, url, anonKey: anonKey.trim(), appliedMigrations: previous?.projectRef === projectRef ? previous.appliedMigrations : [], updatedAt: new Date().toISOString()};
  writeBackend(projectId, backend);
  return backend;
}

function writeBackend(projectId: string, backend: ProjectBackend): void {
  const file = backendFile(projectId);
  writeFileSync(file + '.tmp', JSON.stringify(backend), {mode: 0o600});
  renameSync(file + '.tmp', file);
}

/** Dependency-free client written into the generated app (the preview cannot load npm packages it does not ship). */
export function supabaseClientSource(backend: Pick<ProjectBackend, 'url' | 'anonKey'>): string {
  return `// Cliente Supabase criado pelo Open Lovable. Não depende de pacotes externos.
// A chave abaixo é a pública (anon); a segurança dos dados vem das políticas RLS no banco.
const SUPABASE_URL = ${JSON.stringify(backend.url)};
const SUPABASE_ANON_KEY = ${JSON.stringify(backend.anonKey)};
const SESSION_KEY = 'sb-session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
async function request(path, init = {}) {
  const session = readSession();
  const response = await fetch(SUPABASE_URL + path, {
    ...init,
    headers: {apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (session?.access_token || SUPABASE_ANON_KEY), 'Content-Type': 'application/json', ...(init.headers || {})},
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || 'Erro ' + response.status);
  return data;
}

export const auth = {
  async signUp(email, password) {
    const data = await request('/auth/v1/signup', {method: 'POST', body: JSON.stringify({email, password})});
    if (data?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  },
  async signIn(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', {method: 'POST', body: JSON.stringify({email, password})});
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  },
  async signOut() {
    try { await request('/auth/v1/logout', {method: 'POST'}); } finally { localStorage.removeItem(SESSION_KEY); }
  },
  user() { return readSession()?.user || null; },
};

/** Tabela via REST. Filtros no formato do PostgREST, por exemplo: 'id=eq.5' ou 'done=is.false&order=created_at.desc'. */
export function from(table) {
  const base = '/rest/v1/' + encodeURIComponent(table);
  return {
    select: (columns = '*', filters = '') => request(base + '?select=' + encodeURIComponent(columns) + (filters ? '&' + filters : '')),
    insert: rows => request(base, {method: 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify(rows)}),
    update: (values, filters) => request(base + '?' + filters, {method: 'PATCH', headers: {Prefer: 'return=representation'}, body: JSON.stringify(values)}),
    delete: filters => request(base + '?' + filters, {method: 'DELETE'}),
  };
}

export const supabase = {auth, from};
export default supabase;
`;
}

/** Instructions appended to the model prompt when the project has a backend. */
export function supabaseGuidance(backend: Pick<ProjectBackend, 'url'>): string {
  return `\n\nBACKEND (Supabase) IS CONNECTED at ${backend.url}.
- For login, signup and data, import { supabase } from '${SUPABASE_CLIENT_PATH.replace(/^src\//, '/src/').replace(/\.js$/, '')}' (already in the project; do not rewrite it). API: supabase.auth.signUp/signIn/signOut/user(), supabase.from('table').select(columns, filters)/insert(rows)/update(values, filters)/delete(filters), filters in PostgREST syntax.
- When you need new tables or columns, create a SQL migration file ${MIGRATIONS_DIRECTORY}<YYYYMMDDHHMMSS>_<name>.sql with CREATE TABLE IF NOT EXISTS, ENABLE ROW LEVEL SECURITY and explicit RLS policies (for per-user data use auth.uid() = user_id). The owner reviews and applies migrations; never assume they already ran.
- Never put service_role keys, passwords or other secrets in the code.`;
}

/** Run one reviewed SQL migration through the Supabase Management API with the owner's token. */
export async function applySupabaseMigration(options: {projectId: string; backend: ProjectBackend; path: string; sql: string; token: string; fetchImpl?: typeof fetch}): Promise<ProjectBackend> {
  if (!options.path.startsWith(MIGRATIONS_DIRECTORY) || !options.path.endsWith('.sql')) throw new ProjectError('Só arquivos em supabase/migrations/*.sql podem ser aplicados.', 400);
  if (!options.sql.trim() || options.sql.length > 200_000) throw new ProjectError('Migração vazia ou grande demais.', 400);
  const api = 'https://api.supabase.com';
  const fetchImpl = options.fetchImpl ?? createProviderFetch(api, {timeoutMs: 60_000, maxDurationMs: 120_000, maxBytes: 1024 * 1024});
  const response = await fetchImpl(`${api}/v1/projects/${options.backend.projectRef}/database/query`, {
    method: 'POST', headers: {Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({query: options.sql}),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as {message?: unknown};
    if (response.status === 401 || response.status === 403) throw new ProjectError('O Supabase recusou o token de acesso. Gere um novo em supabase.com/dashboard/account/tokens.', 502);
    throw new ProjectError(`O Supabase rejeitou a migração${typeof detail.message === 'string' ? ': ' + detail.message.slice(0, 300) : ` (HTTP ${response.status})`}.`, 502);
  }
  await response.body?.cancel();
  const backend = {...options.backend, appliedMigrations: [...new Set([...options.backend.appliedMigrations, options.path])], updatedAt: new Date().toISOString()};
  writeBackend(options.projectId, backend);
  return backend;
}
