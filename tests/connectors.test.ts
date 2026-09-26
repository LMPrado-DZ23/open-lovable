import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { CONNECTORS, connector, connectorVariable } from '../lib/connectors/catalog';
import { connectorSecretStatus, connectorsGuidance, connectorsModuleSource, pushConnectorSecrets, readProjectConnectors, saveConnectorSecret, saveProjectConnectors } from '../lib/connectors/project-connectors';
import { credentialStore } from '../lib/settings/store';
import { assertNoSecrets } from '../lib/security/secret-content';
import { usageSummary } from '../lib/usage/summary';
import { readWorkspaceKnowledge, saveWorkspaceKnowledge, workspaceKnowledgeGuidance } from '../lib/settings/workspace-knowledge';

test('the connector catalog is large, unique and complete', () => {
  assert.ok(CONNECTORS.length >= 45);
  assert.equal(new Set(CONNECTORS.map(item => item.id)).size, CONNECTORS.length);
  for (const item of CONNECTORS) {
    assert.match(item.id, /^[a-z0-9-]{2,40}$/);
    assert.match(item.baseURL, /^https:\/\//);
    assert.match(item.keysUrl, /^https:\/\//);
    if (item.kind === 'secret') assert.ok(item.fields.length > 0, item.id);
    for (const field of item.fields) assert.match(field.env, /^[A-Z][A-Z0-9_]+$/);
  }
  assert.equal(connectorVariable('stripe-public'), 'stripePublic');
  // Public values end up in project files the AI reads; field names must not look like credentials.
  const everyPublic = {enabled: CONNECTORS.filter(item => item.kind === 'public').map(item => item.id), publicValues: Object.fromEntries(CONNECTORS.filter(item => item.kind === 'public').map(item => [item.id, Object.fromEntries(item.fields.map(field => [field.key, 'AIzaSyD-public-value-1234567890']))]))};
  assert.doesNotThrow(() => assertNoSecrets({files: {'src/lib/connectors.js': connectorsModuleSource(everyPublic)}}));
  assert.equal(connector('nao-existe'), undefined);
});

test('project connectors keep public values only and generate a safe module', () => {
  const projectId = randomUUID();
  assert.deepEqual(readProjectConnectors(projectId), {enabled: [], publicValues: {}});
  const state = saveProjectConnectors(projectId, {enabled: ['stripe-public', 'resend', 'resend', 'fake'], publicValues: {'stripe-public': {publishableKey: 'pk_test_123', paymentLink: 'https://buy.stripe.com/x'}, resend: {apiKey: 'ignored'}}});
  assert.deepEqual(state.enabled, ['stripe-public', 'resend']);
  assert.deepEqual(state.publicValues, {'stripe-public': {publishableKey: 'pk_test_123', paymentLink: 'https://buy.stripe.com/x'}});
  assert.throws(() => saveProjectConnectors(projectId, {enabled: ['stripe-public'], publicValues: {'stripe-public': {publishableKey: '"><script>'}}}), /inválido/);

  const offline = connectorsModuleSource(state);
  assert.match(offline, /"stripePublic"/);
  assert.match(offline, /serverConnectors = \["resend"\]/);
  assert.match(offline, /Conecte o Supabase/);
  assert.doesNotMatch(offline, /ignored/);
  const online = connectorsModuleSource(state, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.match(online, /import \{ SUPABASE_URL, SUPABASE_ANON_KEY \} from '\.\/supabase\.js'/);
  assert.match(online, /functions\/v1\//);

  const guidance = connectorsGuidance(state);
  assert.match(guidance, /Stripe \(chave pública\) \(public\)/);
  assert.match(guidance, /Deno\.env\.get\('RESEND_API_KEY'\)/);
  assert.match(guidance, /Supabase is not connected/);
  assert.equal(connectorsGuidance({enabled: [], publicValues: {}}), '');
});

test('secret connector keys are stored encrypted, reported only as present and pushed to Supabase', async () => {
  const owner = `workspace:${randomUUID()}`;
  assert.equal(connectorSecretStatus(owner).resend, false);
  assert.throws(() => saveConnectorSecret(owner, 'stripe-public', {publishableKey: 'x'}), /desconhecido/);
  assert.throws(() => saveConnectorSecret(owner, 'twilio', {accountSid: 'AC1'}), /Preencha/);
  saveConnectorSecret(owner, 'resend', {apiKey: 're_test_value'});
  assert.equal(connectorSecretStatus(owner).resend, true);
  assert.equal(credentialStore().read(owner, 'connector:resend')?.baseURL, 'https://api.resend.com');

  const calls: Array<{url: string; body: string}> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => { calls.push({url, body: String(init.body)}); return new Response('{}', {status: 201}); }) as unknown as typeof fetch;
  const pushed = await pushConnectorSecrets({owner, state: {enabled: ['resend', 'stripe-public'], publicValues: {}}, projectRef: 'abcdefghijklmnopqrst', token: 'sbp_x', fetchImpl});
  assert.deepEqual(pushed, ['RESEND_API_KEY']);
  assert.equal(calls[0].url, 'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/secrets');
  assert.deepEqual(JSON.parse(calls[0].body), [{name: 'RESEND_API_KEY', value: 're_test_value'}]);
  await assert.rejects(pushConnectorSecrets({owner, state: {enabled: ['resend'], publicValues: {}}, projectRef: '../evil', token: 'x', fetchImpl}), /inválido/);
  await assert.rejects(pushConnectorSecrets({owner, state: {enabled: ['sendgrid'], publicValues: {}}, projectRef: 'abcdefghijklmnopqrst', token: 'x', fetchImpl}), /Salve a chave/);

  saveConnectorSecret(owner, 'resend', null);
  assert.equal(connectorSecretStatus(owner).resend, false);
});

test('usage summary groups runs per day and per model for one workspace', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE runs (id TEXT PRIMARY KEY, model TEXT, state TEXT); CREATE TABLE run_controls (run_id TEXT, workspace_id TEXT, usage TEXT, created_at TEXT);');
  const now = Date.parse('2026-09-26T12:00:00Z');
  const add = (id: string, workspace: string, model: string, state: string, at: string, usage: object) => {
    db.prepare('INSERT INTO runs VALUES(?,?,?)').run(id, model, state);
    db.prepare('INSERT INTO run_controls VALUES(?,?,?,?)').run(id, workspace, JSON.stringify(usage), at);
  };
  add('a', 'w1', 'openai:gpt', 'SUCCEEDED', '2026-09-26T10:00:00.000Z', {totalTokens: 1200});
  add('b', 'w1', 'openai:gpt', 'FAILED', '2026-09-25T10:00:00.000Z', {inputTokens: 100, outputTokens: 50});
  add('c', 'w1', 'groq:llama', 'SUCCEEDED', '2026-09-20T10:00:00.000Z', {});
  add('d', 'w2', 'openai:gpt', 'SUCCEEDED', '2026-09-26T10:00:00.000Z', {totalTokens: 9999});
  add('e', 'w1', 'openai:gpt', 'SUCCEEDED', '2026-08-01T10:00:00.000Z', {totalTokens: 9999});
  const summary = usageSummary(db, 'w1', 14, now);
  assert.equal(summary.days.length, 14);
  assert.equal(summary.days.at(-1)?.date, '2026-09-26');
  assert.deepEqual(summary.days.at(-1), {date: '2026-09-26', runs: 1, tokens: 1200});
  assert.deepEqual(summary.totals, {runs: 3, tokens: 1350, failed: 1, applied: 2});
  assert.deepEqual(summary.byModel[0], {model: 'openai:gpt', runs: 2, tokens: 1350});
});

test('workspace knowledge is saved per workspace and added to the prompt', () => {
  const workspace = randomUUID();
  assert.equal(readWorkspaceKnowledge(workspace), '');
  assert.equal(workspaceKnowledgeGuidance(workspace), '');
  saveWorkspaceKnowledge(workspace, '  Use português do Brasil.\r\n');
  assert.equal(readWorkspaceKnowledge(workspace), 'Use português do Brasil.');
  assert.match(workspaceKnowledgeGuidance(workspace), /WORKSPACE KNOWLEDGE[\s\S]*português/);
  assert.throws(() => saveWorkspaceKnowledge(workspace, 'x'.repeat(20_001)), /até/);
  assert.throws(() => readWorkspaceKnowledge('../../x') || saveWorkspaceKnowledge('../../x', 'a'), /Invalid workspace/);
});
