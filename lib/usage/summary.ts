import type { DatabaseSync } from 'node:sqlite';

export interface UsageDay {date: string; runs: number; tokens: number}
export interface UsageSummary {days: UsageDay[]; totals: {runs: number; tokens: number; failed: number; applied: number}; byModel: Array<{model: string; runs: number; tokens: number}>}

const DAY = 24 * 60 * 60 * 1000;
const tokensOf = (usage: string): number => {
  try { const value = JSON.parse(usage) as {totalTokens?: unknown; inputTokens?: unknown; outputTokens?: unknown}; if (typeof value.totalTokens === 'number') return value.totalTokens; return (typeof value.inputTokens === 'number' ? value.inputTokens : 0) + (typeof value.outputTokens === 'number' ? value.outputTokens : 0); } catch { return 0; }
};

/** Lovable's "Uso": generations and tokens per day for one workspace over the last N days (UTC dates). */
export function usageSummary(db: Pick<DatabaseSync, 'prepare'>, workspaceId: string, days = 14, now = Date.now()): UsageSummary {
  const start = new Date(Math.floor(now / DAY) * DAY - (days - 1) * DAY);
  const rows = db.prepare('SELECT c.created_at AS created_at, c.usage AS usage, r.model AS model, r.state AS state FROM run_controls c JOIN runs r ON r.id=c.run_id WHERE c.workspace_id=? AND c.created_at>=? ORDER BY c.created_at').all(workspaceId, start.toISOString()) as Array<{created_at: string; usage: string; model: string; state: string}>;
  const series = new Map<string, UsageDay>();
  for (let index = 0; index < days; index++) { const date = new Date(start.getTime() + index * DAY).toISOString().slice(0, 10); series.set(date, {date, runs: 0, tokens: 0}); }
  const models = new Map<string, {model: string; runs: number; tokens: number}>();
  const totals = {runs: 0, tokens: 0, failed: 0, applied: 0};
  for (const row of rows) {
    const tokens = tokensOf(row.usage), day = series.get(String(row.created_at).slice(0, 10));
    if (day) { day.runs++; day.tokens += tokens; }
    const model = models.get(row.model) ?? {model: row.model, runs: 0, tokens: 0};
    model.runs++; model.tokens += tokens; models.set(row.model, model);
    totals.runs++; totals.tokens += tokens;
    if (row.state === 'FAILED' || row.state === 'CANCELLED' || row.state === 'INTERRUPTED') totals.failed++;
    if (row.state === 'SUCCEEDED') totals.applied++;
  }
  return {days: [...series.values()], totals, byModel: [...models.values()].sort((a, b) => b.runs - a.runs)};
}
