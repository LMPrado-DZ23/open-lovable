import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory, ProjectError } from '@/lib/projects/store';

/**
 * Lovable's "Conhecimento do workspace": instructions the AI follows in every
 * project of the workspace (brand, tone, stack rules). Plain text, owner-written.
 */
export const WORKSPACE_KNOWLEDGE_LIMIT = 20_000;

function file(workspaceId: string): string {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId)) throw new ProjectError('Invalid workspace', 400);
  const directory = join(dataDirectory(), 'knowledge');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return join(directory, `${workspaceId.replace(/[^A-Za-z0-9_-]/g, '_')}.md`);
}

export function readWorkspaceKnowledge(workspaceId: string): string {
  try { return readFileSync(file(workspaceId), 'utf8'); } catch { return ''; }
}

export function saveWorkspaceKnowledge(workspaceId: string, content: string): string {
  const text = content.replace(/\r\n/g, '\n').trim();
  if (text.length > WORKSPACE_KNOWLEDGE_LIMIT) throw new ProjectError(`O conhecimento do workspace pode ter até ${WORKSPACE_KNOWLEDGE_LIMIT} caracteres.`, 400);
  const path = file(workspaceId);
  writeFileSync(path + '.tmp', text, {mode: 0o600});
  renameSync(path + '.tmp', path);
  return text;
}

export function workspaceKnowledgeGuidance(workspaceId?: string): string {
  const text = workspaceId ? readWorkspaceKnowledge(workspaceId) : '';
  return text ? `\n\nWORKSPACE KNOWLEDGE FROM THE OWNER (applies to every project; project instructions and the current request take precedence):\n${text}` : '';
}
