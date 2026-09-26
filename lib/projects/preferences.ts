/**
 * Builder preferences that only change how this browser drives the UI.
 * They never bypass a server check: an auto-applied change still goes through
 * the same accept action, and a remembered consent still sends confirmCost.
 */
const AUTO_APPLY = 'open-lovable:auto-apply';
const consentKey = (projectID: string) => `open-lovable:consent:${projectID}`;

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** Lovable applies changes as soon as they compile; that is the default here too. */
export function autoApplyEnabled(): boolean {
  return read(AUTO_APPLY) !== 'off';
}
export function setAutoApply(enabled: boolean): void {
  write(AUTO_APPLY, enabled ? 'on' : 'off');
}

/** Opt-in per project: once the owner authorizes token use, later requests reuse that authorization. */
export function consentRemembered(projectID: string): boolean {
  return read(consentKey(projectID)) === 'yes';
}
export function rememberConsent(projectID: string, remember: boolean): void {
  write(consentKey(projectID), remember ? 'yes' : null);
}

const FAVORITES = 'open-lovable:favorites';
/** Starred projects (Lovable's "Adicionar aos favoritos"), kept per browser. */
export function favoriteProjects(): string[] {
  try { const value = JSON.parse(read(FAVORITES) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 500) : []; } catch { return []; }
}
export function toggleFavorite(projectID: string): string[] {
  const current = favoriteProjects();
  const next = current.includes(projectID) ? current.filter(id => id !== projectID) : [projectID, ...current];
  write(FAVORITES, JSON.stringify(next));
  return next;
}
