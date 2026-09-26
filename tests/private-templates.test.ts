import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { deletePrivateTemplate, importPrivateTemplateZip, listPrivateTemplates, readPrivateTemplate, savePrivateTemplate, templateSlug } from '../lib/templates/private';

test('private templates live in the data directory, get unique ids and can be removed', () => {
  const first = savePrivateTemplate({name: 'BarbeiroPro AI', category: 'Barbearias', snapshot: {files: {'src/App.jsx': 'export default function App(){return <h1>Barbearia</h1>}'}, assets: {}}});
  const second = savePrivateTemplate({name: 'BarbeiroPro AI', snapshot: {files: {'src/App.jsx': 'export default function App(){return null}'}, assets: {}}});
  assert.equal(first.id, 'barbeiropro-ai');
  assert.equal(second.id, 'barbeiropro-ai-2');
  assert.equal(readPrivateTemplate(first.id)?.snapshot.files['src/App.jsx'].includes('Barbearia'), true);
  assert.ok(listPrivateTemplates().some(template => template.id === first.id && template.category === 'Barbearias'));
  deletePrivateTemplate(second.id);
  assert.equal(readPrivateTemplate(second.id), null);
  assert.throws(() => savePrivateTemplate({name: 'x', snapshot: {files: {'a.js': '1'}, assets: {}}}), /nome/);
  assert.throws(() => savePrivateTemplate({name: 'Vazio', snapshot: {files: {}, assets: {}}}), /arquivos/);
  assert.equal(readPrivateTemplate('../../etc'), null);
  assert.equal(templateSlug('Clínica Pró!'), 'clinica-pro');
});

test('a system ZIP becomes a private template without build folders or secret files', () => {
  const archive = Buffer.from(zipSync({
    'src/App.jsx': strToU8('export default function App(){return <main>GymBoss</main>}'),
    'node_modules/react/index.js': strToU8('module.exports={}'),
    '.env': strToU8('API=1'),
  })).toString('base64');
  const {template, excluded} = importPrivateTemplateZip({name: 'GymBoss AI', category: 'Academias', archive});
  const stored = readPrivateTemplate(template.id);
  assert.deepEqual(Object.keys(stored!.snapshot.files), ['src/App.jsx']);
  assert.ok(excluded.length >= 2);
});
