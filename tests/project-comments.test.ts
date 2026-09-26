import test from 'node:test';
import assert from 'node:assert/strict';
import { addComment, listComments, setCommentResolved } from '../lib/collaboration/project-comments';

const projectId = '44444444-5555-4666-8777-888888888888';

test('comments persist per project, can target a file and be resolved', () => {
  assert.deepEqual(listComments(projectId), []);
  addComment(projectId, 'actor-a', 'Trocar a cor do botão principal', 'src/App.jsx');
  const [first] = addComment(projectId, 'actor-b', '  Revisar textos do rodapé  ');
  assert.equal(listComments(projectId).length, 2);
  assert.equal(listComments(projectId)[1].body, 'Revisar textos do rodapé');
  assert.equal(first.file, 'src/App.jsx');
  setCommentResolved(projectId, first.id, true);
  assert.equal(listComments(projectId)[0].resolved, true);
  assert.throws(() => addComment(projectId, 'a', '   '), /entre 1/);
  assert.throws(() => addComment(projectId, 'a', 'ok', '../etc/passwd'), /Arquivo inválido/);
  assert.throws(() => addComment(projectId, 'a', 'chave sk-123456789012345678901234567890'));
  assert.throws(() => setCommentResolved(projectId, '00000000-0000-4000-8000-000000000000', true), /não encontrado/);
  assert.deepEqual(listComments('../x'), [], 'an invalid identifier never reads outside the comments folder');
  assert.throws(() => addComment('../x', 'a', 'oi'), /Invalid project/);
});
