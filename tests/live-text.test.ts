import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLiveText, readLiveText, summarizeLiveText, writeLiveText } from '../lib/runs/live-text';

const runId = '33333333-4444-4555-8666-777777777777';

test('live text is stored per run, bounded and cleared when the run ends', () => {
  writeLiveText(runId, 'Vou criar o app.');
  assert.equal(readLiveText(runId), 'Vou criar o app.');
  writeLiveText(runId, 'x'.repeat(200_000));
  assert.ok(readLiveText(runId).length < 70_000, 'bounded');
  clearLiveText(runId);
  assert.equal(readLiveText(runId), '');
  writeLiveText('../../etc/passwd', 'nope');
  assert.equal(readLiveText('../../etc/passwd'), '');
});

test('the chat sees prose and file progress instead of raw code', () => {
  const summary = summarizeLiveText('Vou criar um contador.\n<file path="src/App.jsx">export default function App(){return 1}</file>\n<file path="src/index.css">body{');
  assert.match(summary, /Vou criar um contador/);
  assert.match(summary, /✎ src\/App\.jsx \(pronto\)/);
  assert.match(summary, /✎ escrevendo src\/index\.css…/);
  assert.doesNotMatch(summary, /export default/);
  assert.match(summarizeLiveText('<delete path="src/old.jsx"/>'), /removendo src\/old\.jsx/);
});
