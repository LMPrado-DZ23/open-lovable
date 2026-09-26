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

export interface DomainSetup {domain: string; verified: boolean; records: Array<{type: 'A' | 'CNAME' | 'TXT'; name: string; value: string}>}

export function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domain.length > 253 || !/^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain) || /\.vercel\.app$/.test(domain)) {
    throw new ProjectError('Informe um domínio válido, como meusite.com.br ou app.meusite.com.br.', 400);
  }
  return domain;
}

/**
 * Attach a custom domain to the project's Vercel deployment and return the DNS
 * records the owner must create. Apex domains use Vercel's A record; subdomains
 * use its CNAME; ownership challenges come back as TXT records.
 */
export async function addVercelDomain(options: {token: string; project: string; domain: string; fetchImpl?: typeof fetch}): Promise<DomainSetup> {
  const domain = normalizeDomain(options.domain);
  const fetchImpl = options.fetchImpl ?? createProviderFetch(VERCEL_API, {timeoutMs: 30_000, maxDurationMs: 60_000, maxBytes: 256 * 1024});
  const response = await fetchImpl(`${VERCEL_API}/v10/projects/${encodeURIComponent(options.project)}/domains`, {
    method: 'POST', headers: {Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({name: domain}),
  });
  const data = await response.json().catch(() => ({})) as {verified?: unknown; verification?: unknown; error?: {code?: unknown}};
  if (!response.ok && data.error?.code !== 'domain_already_in_use_by_project') {
    if (response.status === 404) throw new ProjectError('Publique o projeto na Vercel antes de conectar um domínio.', 409);
    if (data.error?.code === 'domain_already_in_use') throw new ProjectError('Este domínio já está em uso em outro projeto da Vercel.', 409);
    throw new ProjectError(failure(response.status), 502);
  }
  const labels = domain.split('.');
  // Registrable part: example.com, or example.com.br for second-level country domains.
  const registrable = labels.length >= 3 && /^(com|net|org|gov|edu|co)$/.test(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
  const host = labels.slice(0, Math.max(0, labels.length - registrable)).join('.');
  const records: DomainSetup['records'] = [host ? {type: 'CNAME', name: host, value: 'cname.vercel-dns.com'} : {type: 'A', name: '@', value: '76.76.21.21'}];
  if (Array.isArray(data.verification)) {
    for (const item of data.verification as Array<Record<string, unknown>>) {
      if (item.type === 'TXT' && typeof item.domain === 'string' && typeof item.value === 'string') records.push({type: 'TXT', name: item.domain, value: item.value});
    }
  }
  return {domain, verified: data.verified === true, records};
}
