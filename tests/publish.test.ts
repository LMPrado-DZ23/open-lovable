import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishedSite, PUBLIC_SITE_CSP, PUBLIC_SITE_HEADERS, readLocalPublication, saveLocalPublication } from '../lib/publish/site';
import { deployToVercel, vercelProjectName } from '../lib/publish/vercel';
import { githubRepositoryName, pushToGitHub } from '../lib/publish/github';

const snapshot = {files: {'src/App.jsx': 'export default function App(){return <main><h1>Minha loja</h1></main>}'}, assets: {}};

test('a published site is standalone, allows public HTTPS assets and never talks to the Studio', async () => {
  const site = await buildPublishedSite(snapshot, 'Loja <da Ana>');
  assert.ok(site.html.includes(PUBLIC_SITE_CSP));
  assert.doesNotMatch(site.html, /connect-src 'none'/);
  assert.doesNotMatch(site.html, /open-lovable-preview|parent\.postMessage/, 'the preview reporter is removed');
  assert.match(site.html, /<title>Loja &#60;da Ana&#62;<\/title>/, 'the title is escaped');
  assert.match(PUBLIC_SITE_HEADERS['Content-Security-Policy'], /^sandbox allow-scripts/, 'served in an opaque origin');
  assert.match(site.sha256, /^[a-f0-9]{64}$/);
});

test('local publications are stored per project and validated identifiers only', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const saved = saveLocalPublication(id, 3, '<!doctype html><p>v3</p>', 'a'.repeat(64));
  assert.equal(saved.url, `/p/${id}`);
  const read = readLocalPublication(id);
  assert.equal(read?.html, '<!doctype html><p>v3</p>');
  assert.equal(read?.meta.version, 3);
  assert.throws(() => saveLocalPublication('../etc/passwd', 1, 'x', 'y'), /Invalid project identifier/);
  assert.equal(readLocalPublication('99999999-2222-4333-8444-555555555555'), null);
});

test('Vercel deploy sends one static file with the token only in the header', async () => {
  let request: {url: string; init: RequestInit} | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    request = {url, init};
    return new Response(JSON.stringify({id: 'dpl_123', url: 'loja-abc.vercel.app', alias: ['loja.vercel.app']}), {status: 200});
  }) as unknown as typeof fetch;
  const result = await deployToVercel({token: 'vercel-test-token', name: vercelProjectName('Loja da Ana!', '1234567890abcdef'), html: '<p>oi</p>', fetchImpl});
  assert.deepEqual(result, {url: 'https://loja.vercel.app', id: 'dpl_123'});
  assert.equal(request?.url, 'https://api.vercel.com/v13/deployments');
  assert.equal((request?.init.headers as Record<string, string>).Authorization, 'Bearer vercel-test-token');
  const body = JSON.parse(String(request?.init.body));
  assert.equal(body.name, 'loja-da-ana-12345678');
  assert.deepEqual(body.files, [{file: 'index.html', data: '<p>oi</p>'}]);
  assert.doesNotMatch(String(request?.init.body), /vercel-test-token/);
  const denied = (async () => new Response('{}', {status: 403})) as unknown as typeof fetch;
  await assert.rejects(deployToVercel({token: 't', name: 'n', html: 'x', fetchImpl: denied}), /recusou o token/);
});

test('GitHub export creates the repository and commits every file in one commit', async () => {
  const calls: string[] = [];
  let tree: unknown;
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://api.github.com', '');
    const method = init.method ?? 'GET';
    calls.push(`${method} ${path}`);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status});
    if (path === '/user') return json({login: 'ana'});
    if (path === '/repos/ana/Loja-da-Ana') return json({message: 'Not Found'}, 404);
    if (path === '/user/repos') return json({name: 'Loja-da-Ana', default_branch: 'main'}, 201);
    if (path === '/repos/ana/Loja-da-Ana/git/ref/heads/main') return json({object: {sha: 'parent-sha'}});
    if (path === '/repos/ana/Loja-da-Ana/git/blobs') return json({sha: 'blob-' + calls.length}, 201);
    if (path === '/repos/ana/Loja-da-Ana/git/trees') { tree = JSON.parse(String(init.body)).tree; return json({sha: 'tree-sha'}, 201); }
    if (path === '/repos/ana/Loja-da-Ana/git/commits') { assert.deepEqual(JSON.parse(String(init.body)).parents, ['parent-sha']); return json({sha: 'commit-sha'}, 201); }
    if (path === '/repos/ana/Loja-da-Ana/git/refs/heads/main' && method === 'PATCH') return json({ref: 'refs/heads/main'});
    return json({message: 'unexpected ' + path}, 500);
  }) as unknown as typeof fetch;
  const result = await pushToGitHub({token: 'gh-test', repository: 'Loja da Ana', files: {'src/App.jsx': 'a', 'index.html': 'b'}, message: 'm', fetchImpl});
  assert.deepEqual(result, {url: 'https://github.com/ana/Loja-da-Ana', commit: 'commit-sha', created: true});
  assert.equal((tree as Array<{path: string}>).map(entry => entry.path).sort().join(','), 'index.html,src/App.jsx');
  assert.ok(calls.includes('POST /user/repos'));
  assert.equal(githubRepositoryName('../../etc'), 'etc');
  await assert.rejects(pushToGitHub({token: 't', repository: 'x', files: {}, message: 'm', fetchImpl}), /não tem arquivos/);
});
