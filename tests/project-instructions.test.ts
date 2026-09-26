import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore, PROJECT_INSTRUCTIONS_NAME } from '../lib/projects/store';

function setup(t: {after: (fn: () => void) => void}) {
  const dir = mkdtempSync(join(tmpdir(), 'open-lovable-instructions-'));
  const store = new ProjectStore(join(dir, 'state.sqlite3'));
  t.after(() => { store.close(); rmSync(dir, {recursive: true, force: true}); });
  return store;
}

test('project instructions are one living document that replaces itself', t => {
  const store = setup(t);
  const project = store.createProject('owner', 'Loja', 'gateway/coder');
  store.addDocument('owner', project.id, 'requisitos.md', 'Checkout em 3 passos');
  store.setInstructions('owner', project.id, 'Use português do Brasil.');
  store.setInstructions('owner', project.id, 'Use português do Brasil. Cor principal #1f6feb.');
  const documents = store.documents('owner', project.id);
  const instructions = documents.filter(document => document.name === PROJECT_INSTRUCTIONS_NAME);
  assert.equal(instructions.length, 1, 'saving replaces instead of accumulating versions');
  assert.equal(instructions[0].content, 'Use português do Brasil. Cor principal #1f6feb.');
  assert.ok(documents.some(document => document.name === 'requisitos.md'), 'other references are untouched');
  store.setInstructions('owner', project.id, '   ');
  assert.equal(store.documents('owner', project.id).some(document => document.name === PROJECT_INSTRUCTIONS_NAME), false, 'empty text removes them');
});

test('instructions matching an existing reference text do not collide and still reject secrets', t => {
  const store = setup(t);
  const project = store.createProject('owner', 'Blog', 'gateway/coder');
  store.addDocument('owner', project.id, 'regras.md', 'Tom de voz informal');
  store.setInstructions('owner', project.id, 'Tom de voz informal');
  assert.equal(store.documents('owner', project.id).filter(document => document.content === 'Tom de voz informal').length, 1);
  assert.throws(() => store.setInstructions('owner', project.id, 'token sk-123456789012345678901234567890'));
  assert.throws(() => store.setInstructions('other-owner', project.id, 'x'), 'another owner cannot write them');
});
