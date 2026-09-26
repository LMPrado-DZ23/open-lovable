import test from 'node:test';
import assert from 'node:assert/strict';
import { APICallError } from 'ai';
import { modelTestFailure, parseModelListing, parseRateLimitHeaders } from '../lib/ai/provider-discovery';

test('Gemini listing keeps only text generation models and their token limits', () => {
  const models = parseModelListing('google', {models: [
    {name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', inputTokenLimit: 1048576, outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent', 'countTokens']},
    {name: 'models/gemini-embedding-001', displayName: 'Embedding', supportedGenerationMethods: ['embedContent']},
    {name: 'models/imagen-4.0-generate', displayName: 'Imagen', supportedGenerationMethods: ['predict']},
    {name: 'models/gemini-3-pro-image-preview', supportedGenerationMethods: ['generateContent']},
    {name: 'models/deep-research-pro-preview-12-2025', supportedGenerationMethods: ['generateContent']},
    {name: 'models/bad id with spaces', supportedGenerationMethods: ['generateContent']},
  ]});
  assert.deepEqual(models, [{upstreamId: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', inputTokenLimit: 1048576, outputTokenLimit: 65536}]);
});

test('OpenAI-compatible listings drop non-chat models and inactive entries', () => {
  const openai = parseModelListing('openai', {data: [{id: 'gpt-5'}, {id: 'text-embedding-3-large'}, {id: 'whisper-1'}, {id: 'dall-e-3'}, {id: 'o4-mini'}, {id: 'ft:babbage'}]});
  assert.deepEqual(openai.map(model => model.upstreamId).sort(), ['gpt-5', 'o4-mini']);
  const groq = parseModelListing('groq', {data: [{id: 'moonshotai/kimi-k2-instruct', context_window: 131072}, {id: 'whisper-large-v3'}, {id: 'old-model', active: false}]});
  assert.deepEqual(groq, [{upstreamId: 'moonshotai/kimi-k2-instruct', label: 'moonshotai/kimi-k2-instruct', inputTokenLimit: 131072, outputTokenLimit: undefined}]);
  const anthropic = parseModelListing('anthropic', {data: [{id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5'}]});
  assert.equal(anthropic[0].label, 'Claude Sonnet 4.5');
  assert.deepEqual(parseModelListing('openai', {unexpected: true}), []);
});

test('rate limits are read from OpenAI/Groq and Anthropic headers and never invented', () => {
  assert.deepEqual(parseRateLimitHeaders(new Headers({'x-ratelimit-limit-requests': '30', 'x-ratelimit-remaining-requests': '29', 'x-ratelimit-reset-requests': '2s'})),
    {requestsLimit: 30, requestsRemaining: 29, resetRequests: '2s'});
  assert.deepEqual(parseRateLimitHeaders({'anthropic-ratelimit-tokens-limit': '40000', 'anthropic-ratelimit-tokens-remaining': '39000'}),
    {tokensLimit: 40000, tokensRemaining: 39000});
  assert.equal(parseRateLimitHeaders(new Headers({'content-type': 'application/json'})), undefined);
  assert.equal(parseRateLimitHeaders(undefined), undefined);
});

test('model test failures explain retired models, quota and bad keys without echoing upstream text', () => {
  const failure = (statusCode: number) => new APICallError({message: 'upstream secret detail', url: 'https://example.test', requestBodyValues: {}, statusCode});
  assert.match(modelTestFailure(failure(404)), /não existe mais/);
  assert.match(modelTestFailure(failure(429)), /cota/);
  assert.match(modelTestFailure(failure(401)), /chave/);
  assert.doesNotMatch(modelTestFailure(failure(500)), /upstream secret detail/);
  assert.match(modelTestFailure(new Error('network')), /Nenhum outro provedor/);
});

test('catalog replaces retired static models with the ones the provider reports for the key', async () => {
  const { createServer } = await import('node:http');
  const { clearDiscoveryCache } = await import('../lib/ai/provider-discovery');
  const { loadModelCatalog } = await import('../lib/ai/provider-catalog');
  const { getProviderForModel } = await import('../lib/ai/provider-manager');
  let seenKeyHeader = '';
  const server = createServer((request, response) => {
    seenKeyHeader = String(request.headers['x-goog-api-key'] ?? '');
    assert.doesNotMatch(request.url ?? '', /key=/, 'the API key never travels in the URL');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({models: [
      {name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent']},
    ]}));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const saved = { ...process.env };
  try {
    clearDiscoveryCache();
    Object.assign(process.env, { GEMINI_API_KEY: 'test-only-gemini-key', GEMINI_BASE_URL: `http://127.0.0.1:${port}/v1beta` });
    delete process.env.AI_GATEWAY_API_KEY;
    const catalog = await loadModelCatalog();
    const google = catalog.models.filter(model => model.provider === 'google').map(model => model.id);
    assert.deepEqual(google, ['google/gemini-3.1-pro-preview']);
    assert.equal(catalog.providers?.google?.status, 'discovered');
    assert.equal(catalog.models.find(model => model.id === 'google/gemini-3.1-pro-preview')?.inputTokenLimit, 1048576);
    assert.equal(seenKeyHeader, 'test-only-gemini-key');
    const resolved = await getProviderForModel('google/gemini-3.1-pro-preview');
    assert.equal(resolved.actualModel, 'gemini-3.1-pro-preview');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    clearDiscoveryCache();
    await new Promise(resolve => server.close(resolve));
  }
});

test('OpenAI-compatible providers: bare arrays, chat capability flags and context lengths', () => {
  const together = parseModelListing('together', [
    {id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', display_name: 'Llama 3.3 70B', type: 'chat', context_length: 131072},
    {id: 'BAAI/bge-large-en-v1.5', type: 'embedding'},
  ]);
  assert.deepEqual(together.map(model => model.upstreamId), ['meta-llama/Llama-3.3-70B-Instruct-Turbo']);
  assert.equal(together[0].inputTokenLimit, 131072);
  const mistral = parseModelListing('mistral', {data: [
    {id: 'mistral-large-latest', type: 'base', capabilities: {completion_chat: true}},
    {id: 'mistral-ocr-latest', type: 'base', capabilities: {completion_chat: false}},
  ]});
  assert.deepEqual(mistral.map(model => model.upstreamId), ['mistral-large-latest']);
  const openrouter = parseModelListing('openrouter', {data: [{id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', context_length: 200000}]});
  assert.deepEqual(openrouter, [{upstreamId: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', inputTokenLimit: 200000, outputTokenLimit: undefined}]);
});

test('runs accept models discovered live from a provider, not only the static list', async () => {
  const { modelBindingDigest } = await import('../lib/runs/model-binding');
  assert.match(modelBindingDigest('google/gemini-3.1-pro-preview'), /^[0-9a-f]{64}$/);
  assert.match(modelBindingDigest('openrouter/anthropic/claude-sonnet-4.5'), /^[0-9a-f]{64}$/);
  assert.throws(() => modelBindingDigest('unknownvendor/model'), /Unknown configured model/);
});

test('a model the provider refuses as retired is remembered for that key and hidden from the catalog', async () => {
  const { createServer } = await import('node:http');
  const { clearDiscoveryCache, isRetiredModelError, rememberUnavailableModel, resetUnavailableModels, unavailableModels } = await import('../lib/ai/provider-discovery');
  const { loadModelCatalog } = await import('../lib/ai/provider-catalog');
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({models: [
      {name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent']},
      {name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent']},
    ]}));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const saved = { ...process.env };
  try {
    clearDiscoveryCache();
    resetUnavailableModels();
    Object.assign(process.env, { GEMINI_API_KEY: 'test-only-retired-key', GEMINI_BASE_URL: `http://127.0.0.1:${port}/v1beta` });
    delete process.env.AI_GATEWAY_API_KEY;
    const retired = new APICallError({message: 'This model models/gemini-2.5-flash is no longer available to new users.', url: 'https://example.test', requestBodyValues: {}, statusCode: 404});
    assert.equal(isRetiredModelError(retired), true);
    assert.equal(isRetiredModelError(new APICallError({message: 'quota', url: 'https://example.test', requestBodyValues: {}, statusCode: 429})), false);
    rememberUnavailableModel('google', 'test-only-retired-key', 'gemini-2.5-flash');
    assert.ok(unavailableModels('google', 'test-only-retired-key').has('gemini-2.5-flash'));
    assert.equal(unavailableModels('google', 'another-key').size, 0, 'memory is per credential');
    const google = (await loadModelCatalog()).models.filter(model => model.provider === 'google').map(model => model.id);
    assert.deepEqual(google, ['google/gemini-3.8-flash']);
    resetUnavailableModels();
    assert.ok(unavailableModels('google', 'test-only-retired-key').has('gemini-2.5-flash'), 'survives a restart via the private data file');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    clearDiscoveryCache();
    resetUnavailableModels();
    await new Promise(resolve => server.close(resolve));
  }
});
