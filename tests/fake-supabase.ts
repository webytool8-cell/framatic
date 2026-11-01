/* Minimal in-memory stand-in for the supabase-js query builder (only what the app uses). */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private wantCount = false;
  private head = false;
  private singleMode: "one" | "maybe" | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private lim: number | null = null;
  private onConflict: string[] = [];
  private returning = false;

  constructor(private db: FakeDB, private table: string) {}
  select(...args: [string?, { count?: string; head?: boolean }?]) {
    const opts = args[1];
    return this.selectImpl(opts);
  }
  private selectImpl(opts?: { count?: string; head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = Array.isArray(rows) ? rows : [rows]; this.onConflict = (opts?.onConflict ?? "id").split(","); return this; }
  update(patch: Row) { this.op = "update"; this.patch = patch; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }

  private exec() {
    const t = this.db.table(this.table);
    const now = new Date().toISOString();
    let out: Row[] = [];
    if (this.op === "insert" || this.op === "upsert") {
      for (const p of this.payload) {
        const existing = this.op === "upsert" ? t.find((r) => this.onConflict.every((k) => r[k] === p[k])) : undefined;
        if (existing) { Object.assign(existing, p, { updated_at: now }); out.push(existing); }
        else { const row = { id: randomUUID(), created_at: now, updated_at: now, ...p }; t.push(row); out.push(row); }
      }
    } else {
      const matched = t.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") matched.forEach((r) => Object.assign(r, this.patch, { updated_at: now }));
      if (this.op === "delete") this.db.tables[this.table] = t.filter((r) => !matched.includes(r));
      out = matched;
    }
    const count = out.length;
    if (this.orderBy) { const { col, asc } = this.orderBy; out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
    if (this.lim != null) out = out.slice(0, this.lim);
    const copy = JSON.parse(JSON.stringify(out));
    let data: unknown = this.head ? null : copy;
    if (this.singleMode) data = copy[0] ?? null;
    if (this.op !== "select" && !this.returning && !this.singleMode) data = null;
    return { data, error: null, count: this.wantCount ? count : undefined };
  }
  then<T1, T2>(res?: ((v: { data: unknown; error: null; count?: number }) => T1 | PromiseLike<T1>) | null, rej?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.exec()).then(res, rej);
  }
}

export class FakeDB {
  tables: Record<string, Row[]> = {};
  table(name: string) { return (this.tables[name] ??= []); }
  from(name: string) {
    return new Query(this, name);
  }
}
