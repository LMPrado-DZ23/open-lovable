import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importProjectZip } from '@/lib/projects/archive';
import { dataDirectory, ProjectError, validateSnapshot, type ProjectSnapshot } from '@/lib/projects/store';
import { assertNoSecrets } from '@/lib/security/secret-content';

/**
 * Private templates: starter projects that belong to this installation only
 * (for example licensed systems the owner bought). They live in the private
 * data directory, never in the repository, and appear beside the public
 * templates in the gallery.
 */
export interface PrivateTemplateInfo {id: string; name: string; description: string; category: string; createdAt: string; files: number}

const ID = /^[a-z0-9][a-z0-9-]{1,59}$/;
export const PRIVATE_PREFIX = 'private:';

function directory(): string {
  const path = join(dataDirectory(), 'templates');
  mkdirSync(path, {recursive: true, mode: 0o700});
  return path;
}

export function templateSlug(name: string): string {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return slug.length >= 2 ? slug : 'modelo';
}

export function listPrivateTemplates(): PrivateTemplateInfo[] {
  const root = directory();
  const templates: PrivateTemplateInfo[] = [];
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (!entry.isDirectory() || !ID.test(entry.name)) continue;
    try { templates.push(JSON.parse(readFileSync(join(root, entry.name, 'template.json'), 'utf8')) as PrivateTemplateInfo); } catch { /* incomplete folder: skip */ }
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function readPrivateTemplate(id: string): {info: PrivateTemplateInfo; snapshot: ProjectSnapshot} | null {
  if (!ID.test(id)) return null;
  try {
    const folder = join(directory(), id);
    const info = JSON.parse(readFileSync(join(folder, 'template.json'), 'utf8')) as PrivateTemplateInfo;
    return {info, snapshot: validateSnapshot(JSON.parse(readFileSync(join(folder, 'snapshot.json'), 'utf8')))};
  } catch {
    return null;
  }
}

/** Store a snapshot as a private template; the id is unique and the write is atomic. */
export function savePrivateTemplate(input: {name: string; description?: string; category?: string; snapshot: unknown}): PrivateTemplateInfo {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new ProjectError('Dê um nome ao modelo.', 400);
  const snapshot = validateSnapshot(input.snapshot);
  if (!Object.keys(snapshot.files).length) throw new ProjectError('O modelo precisa ter arquivos.', 400);
  assertNoSecrets(snapshot.files);
  const root = directory();
  let id = templateSlug(name);
  for (let attempt = 2; readPrivateTemplate(id); attempt++) id = `${templateSlug(name).slice(0, 45)}-${attempt}`;
  const info: PrivateTemplateInfo = {id, name, description: (input.description ?? '').trim().slice(0, 240), category: (input.category ?? 'Meus modelos').trim().slice(0, 40) || 'Meus modelos', createdAt: new Date().toISOString(), files: Object.keys(snapshot.files).length};
  const staging = join(root, `.${id}.tmp`);
  rmSync(staging, {recursive: true, force: true});
  mkdirSync(staging, {mode: 0o700});
  writeFileSync(join(staging, 'snapshot.json'), JSON.stringify(snapshot), {mode: 0o600});
  writeFileSync(join(staging, 'template.json'), JSON.stringify(info), {mode: 0o600});
  renameSync(staging, join(root, id));
  return info;
}

/** A ZIP (a downloaded system, an exported project) becomes a private template; build/secret files are dropped. */
export function importPrivateTemplateZip(input: {name: string; description?: string; category?: string; archive: string}): {template: PrivateTemplateInfo; excluded: string[]} {
  const {snapshot, excluded} = importProjectZip(input.archive);
  return {template: savePrivateTemplate({...input, snapshot}), excluded};
}

export function deletePrivateTemplate(id: string): void {
  if (!ID.test(id)) throw new ProjectError('Modelo inválido.', 400);
  rmSync(join(directory(), id), {recursive: true, force: true});
}
