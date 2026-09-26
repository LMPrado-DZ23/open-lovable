import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory, ProjectError } from '@/lib/projects/store';
import { assertNoSecrets } from '@/lib/security/secret-content';

/**
 * Persistent discussion per project (Lovable-style comments): notes for the
 * team, optionally pinned to a file. Stored beside the private data, one JSON
 * document per project, written atomically.
 */
export interface ProjectComment {id: string; actorId: string; body: string; file?: string; createdAt: string; resolved: boolean}

const LIMIT = 500;

function commentsFile(projectId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(projectId)) throw new ProjectError('Invalid project identifier', 400);
  const directory = join(dataDirectory(), 'comments');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return join(directory, `${projectId}.json`);
}

export function listComments(projectId: string): ProjectComment[] {
  try { return JSON.parse(readFileSync(commentsFile(projectId), 'utf8')) as ProjectComment[]; } catch { return []; }
}

function writeComments(projectId: string, comments: ProjectComment[]): void {
  const file = commentsFile(projectId);
  writeFileSync(file + '.tmp', JSON.stringify(comments), {mode: 0o600});
  renameSync(file + '.tmp', file);
}

export function addComment(projectId: string, actorId: string, body: string, file?: string): ProjectComment[] {
  const text = body.trim();
  if (!text || text.length > 4000) throw new ProjectError('O comentário deve ter entre 1 e 4.000 caracteres.', 400);
  if (file !== undefined && (!/^[A-Za-z0-9_./ ()@+-]{1,300}$/.test(file) || file.split('/').includes('..'))) throw new ProjectError('Arquivo inválido para o comentário.', 400);
  assertNoSecrets(text);
  const comments = listComments(projectId);
  if (comments.length >= LIMIT) throw new ProjectError('Este projeto atingiu o limite de comentários. Resolva e remova os antigos.', 409);
  comments.push({id: randomUUID(), actorId, body: text, ...(file ? {file} : {}), createdAt: new Date().toISOString(), resolved: false});
  writeComments(projectId, comments);
  return comments;
}

export function setCommentResolved(projectId: string, commentId: string, resolved: boolean): ProjectComment[] {
  const comments = listComments(projectId);
  const comment = comments.find(item => item.id === commentId);
  if (!comment) throw new ProjectError('Comentário não encontrado.', 404);
  comment.resolved = resolved;
  writeComments(projectId, comments);
  return comments;
}
