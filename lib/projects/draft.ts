/**
 * Hand a request typed on the home screen to the project workspace without
 * putting it in the URL. It lives only in this tab and is consumed once.
 */
export interface ProjectDraft {prompt: string; imageIDs: string[]; mode?: 'build' | 'plan'}

const key = (projectID: string) => `open-lovable:draft:${projectID}`;

export function saveProjectDraft(projectID: string, draft: ProjectDraft): void {
  try { sessionStorage.setItem(key(projectID), JSON.stringify(draft)); } catch { /* storage unavailable: the user retypes */ }
}

export function takeProjectDraft(projectID: string): ProjectDraft | null {
  try {
    const raw = sessionStorage.getItem(key(projectID));
    if (!raw) return null;
    sessionStorage.removeItem(key(projectID));
    const value = JSON.parse(raw) as Partial<ProjectDraft>;
    if (typeof value.prompt !== 'string') return null;
    const imageIDs = Array.isArray(value.imageIDs) ? value.imageIDs.filter((id): id is string => typeof id === 'string').slice(0, 20) : [];
    return {prompt: value.prompt.slice(0, 32768), imageIDs, ...(value.mode === 'plan' ? {mode: 'plan' as const} : {})};
  } catch {
    return null;
  }
}
