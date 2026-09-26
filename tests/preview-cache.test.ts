import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProjectCached } from '../lib/projects/preview';

const snapshot = {files: {'src/App.jsx': 'export default function App(){return <main><h1>Olá</h1></main>}'}, assets: {}};

test('cached preview compiles once per revision and binds every request to its own channel', async () => {
  const started = performance.now();
  const first = await compileProjectCached(snapshot, 'channelone', true);
  const firstMs = performance.now() - started;
  const again = performance.now();
  const second = await compileProjectCached(snapshot, 'channeltwo', true);
  const secondMs = performance.now() - again;
  assert.ok(first.html.includes('"channelone"') && !first.html.includes('channeltwo'));
  assert.ok(second.html.includes('"channeltwo"') && !second.html.includes('channelone'));
  assert.doesNotMatch(first.html + second.html, /olpreviewslot/);
  assert.ok(second.sourceMap?.elements.every(element => element.runtimeId === 'channeltwo'));
  assert.notEqual(first.sha256, second.sha256);
  assert.ok(secondMs < firstMs, `cache hit (${secondMs.toFixed(0)} ms) must be faster than the build (${firstMs.toFixed(0)} ms)`);
  await assert.rejects(compileProjectCached(snapshot, 'bad channel!', true), /Invalid preview channel/);
});

test('a revision that fails to compile is not cached as a failure forever', async () => {
  const broken = {files: {'src/App.jsx': 'export default function App(){return <main>'}, assets: {}};
  await assert.rejects(compileProjectCached(broken, 'c1', true));
  await assert.rejects(compileProjectCached(broken, 'c2', true));
});
