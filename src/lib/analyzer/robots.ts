/** Minimal robots.txt support: honors Disallow/Allow for `*` and our bot's user-agent. */
export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export function parseRobots(txt: string, agent = "framaticbot"): RobotsRules {
  const groups: Array<{ agents: string[]; allow: string[]; disallow: string[] }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow" && value) current.disallow.push(value);
    if (key === "allow" && value) current.allow.push(value);
  }
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  const g = specific ?? star;
  return { allow: g?.allow ?? [], disallow: g?.disallow ?? [] };
}

function matches(path: string, rule: string): number {
  // Supports `*` wildcards and `$` end anchors. Returns match length or -1.
  const anchored = rule.endsWith("$");
  const pattern = (anchored ? rule.slice(0, -1) : rule).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  const re = new RegExp(`^${pattern}${anchored ? "$" : ""}`);
  return re.test(path) ? rule.length : -1;
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best = -1;
  let allowed = true;
  for (const r of rules.disallow) {
    const m = matches(path, r);
    if (m > best) {
      best = m;
      allowed = false;
    }
  }
  for (const r of rules.allow) {
    const m = matches(path, r);
    if (m >= best && m >= 0) {
      best = m;
      allowed = true;
    }
  }
  return allowed;
}
