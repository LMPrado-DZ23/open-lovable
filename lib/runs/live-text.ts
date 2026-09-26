import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory } from '@/lib/projects/store';

/**
 * Latest partial model output of a running generation, so the chat can show
 * the answer as it is written (like Lovable). One small file per live run in
 * the private data directory; removed when the run finishes. It is a display
 * aid only: the durable result is still the recorded model output.
 */
const LIMIT = 64 * 1024;

function file(runId: string): string | null {
  if (!/^[0-9a-f-]{36}$/.test(runId)) return null;
  const directory = join(dataDirectory(), 'live');
  mkdirSync(directory, {recursive: true, mode: 0o700});
  return join(directory, `${runId}.txt`);
}

export function writeLiveText(runId: string, text: string): void {
  const path = file(runId);
  if (!path) return;
  try {
    // Keep the head (the model's explanation) and the tail (what it is writing now).
    const value = text.length > LIMIT ? text.slice(0, LIMIT / 2) + '\n…\n' + text.slice(-LIMIT / 2) : text;
    writeFileSync(path + '.tmp', value, {mode: 0o600});
    renameSync(path + '.tmp', path);
  } catch { /* display aid only */ }
}

export function readLiveText(runId: string): string {
  const path = file(runId);
  if (!path) return '';
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

export function clearLiveText(runId: string): void {
  const path = file(runId);
  if (path) rmSync(path, {force: true});
}

/** Turn raw output into chat text: code blocks become short "editing file" lines. */
export function summarizeLiveText(text: string): string {
  return text
    .replace(/<file path="([^"]{1,300})">[\s\S]*?(<\/file>|$)/g, (_all, path: string, closed: string) => closed ? `\n✎ ${path} (pronto)\n` : `\n✎ escrevendo ${path}…\n`)
    .replace(/<delete path="([^"]{1,300})"\s*\/>/g, (_all, path: string) => `\n✂ removendo ${path}\n`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(-6000);
}
