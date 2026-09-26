import { createProviderFetch } from '@/lib/ai/provider-transport';
import { ProjectError } from '@/lib/projects/store';

const VERCEL_API = 'https://api.vercel.com';

export function vercelProjectName(name: string, projectId: string): string {
  const base = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${base || 'open-lovable'}-${projectId.slice(0, 8)}`;
}

function failure(status: number): string {
  if (status === 401 || status === 403) return 'A Vercel recusou o token. Gere um novo token em vercel.com/account/tokens e salve em Integrações.';
  if (status === 402) return 'A conta da Vercel atingiu o limite do plano para publicações.';
  if (status === 429) return 'Limite de publicações da Vercel atingido. Tente novamente em alguns minutos.';
  return `A Vercel não aceitou a publicação (HTTP ${status}).`;
}

/** Deploy one static page as a production deployment; the key is sent only as a header. */
export async function deployToVercel(options: {token: string; name: string; html: string; teamId?: string; fetchImpl?: typeof fetch}): Promise<{url: string; id: string}> {
  const fetchImpl = options.fetchImpl ?? createProviderFetch(VERCEL_API, {timeoutMs: 60_000, maxDurationMs: 120_000, maxBytes: 1024 * 1024});
  const query = options.teamId && /^[A-Za-z0-9_-]{1,64}$/.test(options.teamId) ? `?teamId=${options.teamId}` : '';
  const response = await fetchImpl(`${VERCEL_API}/v13/deployments${query}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({name: options.name, target: 'production', files: [{file: 'index.html', data: options.html}], projectSettings: {framework: null}}),
  });
  const data = await response.json().catch(() => ({})) as {url?: unknown; id?: unknown; alias?: unknown};
  if (!response.ok) throw new ProjectError(failure(response.status), 502);
  const alias = Array.isArray(data.alias) && typeof data.alias[0] === 'string' ? data.alias[0] : undefined;
  const host = alias ?? (typeof data.url === 'string' ? data.url : undefined);
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || typeof data.id !== 'string') throw new ProjectError('A Vercel respondeu sem um endereço de publicação válido.', 502);
  return {url: `https://${host}`, id: data.id};
}
