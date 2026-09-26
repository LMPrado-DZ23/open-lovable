import { createProviderFetch } from '@/lib/ai/provider-transport';
import { ProjectError } from '@/lib/projects/store';

const GITHUB_API = 'https://api.github.com';

export function githubRepositoryName(name: string): string {
  const base = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
  return base || 'open-lovable-app';
}

function failure(status: number, stage: string): string {
  if (status === 401) return 'O GitHub recusou o token. Gere um novo em github.com/settings/tokens e salve em Integrações.';
  if (status === 403) return `O token do GitHub não tem permissão para ${stage}. Use um token com acesso a "Contents" e "Administration" (repositórios).`;
  if (status === 404) return `O GitHub não encontrou o destino ao ${stage}. Confira o dono e o nome do repositório.`;
  if (status === 422) return 'O GitHub rejeitou o pedido (o nome do repositório pode já estar em uso).';
  return `O GitHub respondeu HTTP ${status} ao ${stage}.`;
}

type Json = Record<string, unknown>;

/**
 * Create (or reuse) a repository and write every project file as one commit
 * with the Git Data API: blobs → tree → commit → branch ref.
 */
export async function pushToGitHub(options: {token: string; repository: string; files: Record<string, string>; message: string; privateRepo?: boolean; fetchImpl?: typeof fetch}): Promise<{url: string; commit: string; created: boolean}> {
  const fetchImpl = options.fetchImpl ?? createProviderFetch(GITHUB_API, {timeoutMs: 60_000, maxDurationMs: 300_000, maxBytes: 4 * 1024 * 1024});
  const headers = {Authorization: `Bearer ${options.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'};
  async function call(path: string, stage: string, init: {method?: string; body?: Json} = {}, allow404 = false): Promise<Json | null> {
    const response = await fetchImpl(`${GITHUB_API}${path}`, {method: init.method ?? 'GET', headers, ...(init.body ? {body: JSON.stringify(init.body)} : {})});
    if (allow404 && response.status === 404) { await response.body?.cancel(); return null; }
    const data = await response.json().catch(() => ({})) as Json;
    if (!response.ok) throw new ProjectError(failure(response.status, stage), 502);
    return data;
  }
  const entries = Object.entries(options.files);
  if (!entries.length) throw new ProjectError('O projeto não tem arquivos para enviar.', 409);
  if (entries.length > 1000) throw new ProjectError('O projeto tem arquivos demais para um único envio.', 413);

  const user = await call('/user', 'identificar a conta');
  const owner = typeof user?.login === 'string' ? user.login : '';
  if (!/^[A-Za-z0-9-]{1,39}$/.test(owner)) throw new ProjectError('O GitHub não informou a conta do token.', 502);
  const repo = githubRepositoryName(options.repository);
  let repository = await call(`/repos/${owner}/${repo}`, 'consultar o repositório', {}, true);
  let created = false;
  if (!repository) {
    repository = await call('/user/repos', 'criar o repositório', {method: 'POST', body: {name: repo, private: options.privateRepo !== false, auto_init: true, description: 'Criado com Open Lovable'}});
    created = true;
  }
  const branch = typeof repository?.default_branch === 'string' && repository.default_branch ? repository.default_branch : 'main';
  const reference = await call(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, 'ler a branch', {}, true);
  const parent = (reference?.object as Json | undefined)?.sha;
  const tree = [];
  for (const [path, content] of entries) {
    const blob = await call(`/repos/${owner}/${repo}/git/blobs`, 'enviar um arquivo', {method: 'POST', body: {content: Buffer.from(content, 'utf8').toString('base64'), encoding: 'base64'}});
    tree.push({path, mode: '100644', type: 'blob', sha: blob?.sha});
  }
  const newTree = await call(`/repos/${owner}/${repo}/git/trees`, 'montar os arquivos', {method: 'POST', body: {tree}});
  const commit = await call(`/repos/${owner}/${repo}/git/commits`, 'criar o commit', {method: 'POST', body: {message: options.message, tree: newTree?.sha, parents: typeof parent === 'string' ? [parent] : []}});
  if (typeof commit?.sha !== 'string') throw new ProjectError('O GitHub não confirmou o commit.', 502);
  if (typeof parent === 'string') await call(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, 'atualizar a branch', {method: 'PATCH', body: {sha: commit.sha, force: false}});
  else await call(`/repos/${owner}/${repo}/git/refs`, 'criar a branch', {method: 'POST', body: {ref: `refs/heads/${branch}`, sha: commit.sha}});
  return {url: `https://github.com/${owner}/${repo}`, commit: commit.sha, created};
}
