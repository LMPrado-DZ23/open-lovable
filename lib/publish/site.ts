import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileProject } from '@/lib/projects/preview';
import { dataDirectory, ProjectError } from '@/lib/projects/store';

import { PUBLIC_SITE_CSP, PUBLISHED_PAGE_CSP } from './csp';

export { PUBLIC_SITE_CSP };
/** The middleware re-applies the same policy last, so it is the one the browser sees. */
export const PUBLIC_SITE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': PUBLISHED_PAGE_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Turn the self-contained preview bundle into a standalone static page. */
export async function buildPublishedSite(snapshot: unknown, title: string): Promise<{html: string; sha256: string}> {
  const compiled = await compileProject(snapshot);
  if (!compiled.html.includes(PREVIEW_CSP)) throw new ProjectError('Unexpected preview format; the site was not published.', 500);
  const safeTitle = title.replace(/[<>&"']/g, character => `&#${character.charCodeAt(0)};`).slice(0, 120);
  const html = compiled.html
    .replace(PREVIEW_CSP, PUBLIC_SITE_CSP)
    // The preview reporter talks to the Studio frame; a published page has no parent to report to.
    .replace(/<script>const channel=[\s\S]*?<\/script>/, '')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8"><title>${safeTitle}</title>`);
  return {html, sha256: createHash('sha256').update(html).digest('hex')};
}

export interface LocalPublication {projectId: string; version: number; sha256: string; publishedAt: string; url: string}

function publicationDirectory(): string {
  const directory = join(dataDirectory(), 'published');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return directory;
}

function assertProjectID(projectId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(projectId)) throw new ProjectError('Invalid project identifier', 400);
}

/** Written atomically: a reader sees either the previous or the new site, never half a file. */
export function saveLocalPublication(projectId: string, version: number, html: string, sha256: string): LocalPublication {
  assertProjectID(projectId);
  const directory = publicationDirectory();
  const publication: LocalPublication = {projectId, version, sha256, publishedAt: new Date().toISOString(), url: `/p/${projectId}`};
  const temporary = join(directory, `${projectId}.html.tmp`);
  writeFileSync(temporary, html, {mode: 0o600});
  renameSync(temporary, join(directory, `${projectId}.html`));
  writeFileSync(join(directory, `${projectId}.json`), JSON.stringify(publication), {mode: 0o600});
  return publication;
}

export function readLocalPublication(projectId: string): {meta: LocalPublication; html: string} | null {
  assertProjectID(projectId);
  try {
    const directory = publicationDirectory();
    const meta = JSON.parse(readFileSync(join(directory, `${projectId}.json`), 'utf8')) as LocalPublication;
    return {meta, html: readFileSync(join(directory, `${projectId}.html`), 'utf8')};
  } catch {
    return null;
  }
}
