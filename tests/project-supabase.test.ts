import test from 'node:test';
import assert from 'node:assert/strict';
import { applySupabaseMigration, assertPublicKey, parseSupabaseURL, readProjectBackend, saveProjectBackend, supabaseClientSource, supabaseGuidance } from '../lib/backend/project-supabase';
import { scanSecretContent } from '../lib/security/secret-content';

const jwt = (payload: object) => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'c2ln'].join('.');
const projectId = '22222222-3333-4444-8555-666666666666';

test('only a real project URL and the public anon key are accepted', () => {
  assert.deepEqual(parseSupabaseURL('https://abcdefghijklmnopqrst.supabase.co/'), {url: 'https://abcdefghijklmnopqrst.supabase.co', projectRef: 'abcdefghijklmnopqrst'});
  assert.throws(() => parseSupabaseURL('http://abcdefghijklmnopqrst.supabase.co'), /https/);
  assert.throws(() => parseSupabaseURL('https://evil.example.com'), /supabase\.co/);
  assert.doesNotThrow(() => assertPublicKey(jwt({role: 'anon'})));
  assert.doesNotThrow(() => assertPublicKey('sb_publishable_abcdefghijk'));
  assert.throws(() => assertPublicKey(jwt({role: 'service_role'})), /service_role/);
  assert.throws(() => assertPublicKey('sb_secret_abcdefghijk'), /secreta/);
});

test('the generated client is dependency-free, public-only and passes the secret scanner', () => {
  const source = supabaseClientSource({url: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: jwt({role: 'anon'})});
  assert.doesNotMatch(source, /\bimport\b/);
  assert.match(source, /export const supabase/);
  assert.deepEqual(scanSecretContent(source), [], 'saving the client into the project must not trip secret blocking');
  assert.match(supabaseGuidance({url: 'https://x.supabase.co'}), /ROW LEVEL SECURITY/);
});

test('backend config persists per project and migrations run once through the management API', async () => {
  const backend = saveProjectBackend(projectId, 'https://abcdefghijklmnopqrst.supabase.co', jwt({role: 'anon'}));
  assert.equal(readProjectBackend(projectId)?.projectRef, 'abcdefghijklmnopqrst');
  let sent: {url: string; body: string; auth: string} | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent = {url, body: String(init.body), auth: (init.headers as Record<string, string>).Authorization};
    return new Response('[]', {status: 201});
  }) as unknown as typeof fetch;
  const updated = await applySupabaseMigration({projectId, backend, path: 'supabase/migrations/20260926_todos.sql', sql: 'create table if not exists todos(id bigint primary key);', token: 'sbp_test', fetchImpl});
  assert.equal(sent?.url, 'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query');
  assert.equal(sent?.auth, 'Bearer sbp_test');
  assert.deepEqual(JSON.parse(sent!.body), {query: 'create table if not exists todos(id bigint primary key);'});
  assert.deepEqual(updated.appliedMigrations, ['supabase/migrations/20260926_todos.sql']);
  assert.deepEqual(readProjectBackend(projectId)?.appliedMigrations, ['supabase/migrations/20260926_todos.sql']);
  await assert.rejects(applySupabaseMigration({projectId, backend, path: 'src/App.jsx', sql: 'x', token: 't', fetchImpl}), /supabase\/migrations/);
  const denied = (async () => new Response('{}', {status: 401})) as unknown as typeof fetch;
  await assert.rejects(applySupabaseMigration({projectId, backend, path: 'supabase/migrations/a.sql', sql: 'select 1', token: 't', fetchImpl: denied}), /recusou o token/);
});
