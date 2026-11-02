import { renderCostUsd } from "@/lib/ai/usage";

export type AIUsageRow = {
  user_id: string;
  project_id: string | null;
  step: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | string | null;
  duration_ms: number | null;
  ok: boolean;
};

export type RenderRow = { user_id: string; status: string; created_at: string; updated_at: string; duration_sec: number | string };

export type StepStats = { step: string; calls: number; avgInput: number; avgOutput: number; avgCost: number; avgSeconds: number; models: string[]; failed: number };
export type UserStats = { userId: string; projects: number; aiCalls: number; aiCost: number; renders: number; renderCost: number; total: number };

export type UsageReport = {
  aiCost: number;
  renderCost: number;
  projects: number;
  renders: number;
  users: number;
  perProject: number;
  /** Analysis + the three first concepts, per project: the cost of one "make my ad". */
  firstRunPerProject: number;
  perRender: number;
  perUser: number;
  steps: StepStats[];
  byUser: UserStats[];
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Seconds a render's Cloud Run instance lived (what Google bills, before the 60s minimum). */
export function renderSeconds(r: RenderRow): number {
  return Math.max(0, (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 1000);
}

/** Fold raw usage rows into the numbers the admin page shows. */
export function buildUsageReport(ai: AIUsageRow[], renders: RenderRow[]): UsageReport {
  const finished = renders.filter((r) => r.status !== "rendering");
  const users = new Map<string, UserStats>();
  const u = (id: string) => {
    let s = users.get(id);
    if (!s) users.set(id, (s = { userId: id, projects: 0, aiCalls: 0, aiCost: 0, renders: 0, renderCost: 0, total: 0 }));
    return s;
  };
  const projectsByUser = new Map<string, Set<string>>();

  for (const r of ai) {
    const s = u(r.user_id);
    s.aiCalls += 1;
    s.aiCost += num(r.cost_usd);
    if (r.project_id && r.step === "analysis") {
      const set = projectsByUser.get(r.user_id) ?? new Set();
      set.add(r.project_id);
      projectsByUser.set(r.user_id, set);
    }
  }
  for (const r of finished) {
    const s = u(r.user_id);
    if (r.status === "done") s.renders += 1;
    s.renderCost += renderCostUsd(renderSeconds(r));
  }
  for (const s of users.values()) {
    s.projects = projectsByUser.get(s.userId)?.size ?? 0;
    s.total = s.aiCost + s.renderCost;
  }

  const groups = new Map<string, AIUsageRow[]>();
  for (const r of ai) {
    const key = r.step.startsWith("concept:") ? "concept" : r.step;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const steps: StepStats[] = [...groups.entries()]
    .map(([step, rows]) => ({
      step,
      calls: rows.length,
      avgInput: rows.reduce((a, r) => a + num(r.input_tokens) + num(r.cache_read_tokens) + num(r.cache_write_tokens), 0) / rows.length,
      avgOutput: rows.reduce((a, r) => a + num(r.output_tokens), 0) / rows.length,
      avgCost: rows.reduce((a, r) => a + num(r.cost_usd), 0) / rows.length,
      avgSeconds: rows.reduce((a, r) => a + num(r.duration_ms), 0) / rows.length / 1000,
      models: [...new Set(rows.map((r) => r.model))],
      failed: rows.filter((r) => !r.ok).length,
    }))
    .sort((a, b) => b.calls - a.calls);

  const byUser = [...users.values()].sort((a, b) => b.total - a.total);
  const aiCost = byUser.reduce((a, s) => a + s.aiCost, 0);
  const renderCost = byUser.reduce((a, s) => a + s.renderCost, 0);
  const projects = byUser.reduce((a, s) => a + s.projects, 0);
  const doneRenders = byUser.reduce((a, s) => a + s.renders, 0);
  return {
    aiCost,
    renderCost,
    projects,
    renders: doneRenders,
    users: byUser.length,
    perProject: projects ? aiCost / projects : 0,
    firstRunPerProject: projects
      ? ai.filter((r) => r.step === "analysis" || r.step.startsWith("concept:")).reduce((a, r) => a + num(r.cost_usd), 0) / projects
      : 0,
    perRender: finished.length ? renderCost / finished.length : 0,
    perUser: byUser.length ? (aiCost + renderCost) / byUser.length : 0,
    steps,
    byUser,
  };
}
