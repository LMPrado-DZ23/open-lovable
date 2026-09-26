import test from 'node:test';
import assert from 'node:assert/strict';
import { saveProjectDraft, takeProjectDraft } from '../lib/projects/draft';

const store = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
};

test('a home-screen request reaches its project exactly once', () => {
  saveProjectDraft('p1', {prompt: 'Um app de tarefas', imageIDs: ['img-1']});
  assert.deepEqual(takeProjectDraft('p2'), null, 'drafts never leak into another project');
  assert.deepEqual(takeProjectDraft('p1'), {prompt: 'Um app de tarefas', imageIDs: ['img-1']});
  assert.equal(takeProjectDraft('p1'), null, 'consumed after the first read');
});

test('malformed drafts are ignored instead of breaking the workspace', () => {
  store.set('open-lovable:draft:p3', '{not json');
  assert.equal(takeProjectDraft('p3'), null);
  store.set('open-lovable:draft:p4', JSON.stringify({prompt: 42}));
  assert.equal(takeProjectDraft('p4'), null);
  store.set('open-lovable:draft:p5', JSON.stringify({prompt: 'ok', imageIDs: ['a', 7, 'b']}));
  assert.deepEqual(takeProjectDraft('p5'), {prompt: 'ok', imageIDs: ['a', 'b']});
});
