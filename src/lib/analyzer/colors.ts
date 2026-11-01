/** Color parsing and brand-color ranking from raw CSS text. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
};

export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();
  if (NAMED[s]) return parseColor(NAMED[s]);
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split("").map((c) => c + c).join("");
    if (hex.length === 8) {
      if (parseInt(hex.slice(6, 8), 16) < 128) return null; // mostly transparent
      hex = hex.slice(0, 6);
    }
    if (hex.length !== 6) return null;
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] !== undefined) {
      const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a < 0.5) return null;
    }
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] !== undefined) {
      const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a < 0.5) return null;
    }
    return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

export function luminance({ r, g, b }: RGB): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function distance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{5,40}\)|hsla?\([^)]{5,50}\)/g;

export interface ColorCandidate {
  hex: string;
  count: number;
  saturation: number;
  luminance: number;
}

/**
 * Count colors in CSS, weighting declarations that tend to carry brand color
 * (custom properties named primary/brand/accent, buttons, links, theme-color).
 */
export function collectColors(cssChunks: string[], boosted: string[] = []): ColorCandidate[] {
  const counts = new Map<string, { rgb: RGB; count: number }>();
  const add = (raw: string, weight: number) => {
    const rgb = parseColor(raw);
    if (!rgb) return;
    const hex = toHex(rgb);
    const prev = counts.get(hex);
    counts.set(hex, { rgb, count: (prev?.count ?? 0) + weight });
  };
  for (const css of cssChunks) {
    // Brand-ish custom properties count extra.
    for (const m of css.matchAll(/--[\w-]*(primary|brand|accent|main|highlight|cta)[\w-]*\s*:\s*([^;}{]+)/gi)) {
      for (const t of m[2].match(COLOR_TOKEN) ?? []) add(t, 6);
    }
    for (const m of css.matchAll(/(?:button|\.btn|\.button|\.cta|a)[^{]{0,80}\{([^}]*)\}/gi)) {
      for (const t of m[1].match(COLOR_TOKEN) ?? []) add(t, 2);
    }
    for (const t of css.match(COLOR_TOKEN) ?? []) add(t, 1);
  }
  for (const b of boosted) add(b, 12);

  // Merge near-duplicates into the most frequent representative.
  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const merged: Array<{ hex: string; rgb: RGB; count: number }> = [];
  for (const [hex, v] of sorted) {
    const near = merged.find((m) => distance(m.rgb, v.rgb) < 18);
    if (near) near.count += v.count;
    else merged.push({ hex, rgb: v.rgb, count: v.count });
  }
  return merged
    .map((m) => ({ hex: m.hex, count: m.count, saturation: saturation(m.rgb), luminance: luminance(m.rgb) }))
    .sort((a, b) => b.count - a.count);
}

export interface BrandPalette {
  primary: string | null;
  secondary: string[];
  accents: string[];
  neutrals: string[];
}

/** Split candidates into brand colors (saturated) and neutrals. */
export function rankPalette(candidates: ColorCandidate[]): BrandPalette {
  const chromatic = candidates.filter((c) => c.saturation >= 0.25 && c.luminance > 0.02 && c.luminance < 0.93);
  const neutrals = candidates.filter((c) => !chromatic.includes(c)).slice(0, 4).map((c) => c.hex);
  return {
    primary: chromatic[0]?.hex ?? null,
    secondary: chromatic.slice(1, 3).map((c) => c.hex),
    accents: chromatic.slice(3, 6).map((c) => c.hex),
    neutrals,
  };
}

/** Rough light/dark inference from body/html background declarations. */
export function inferTheme(cssChunks: string[]): "light" | "dark" | "mixed" {
  const bgs: number[] = [];
  for (const css of cssChunks) {
    for (const m of css.matchAll(/(?:^|[}\s,])(?:html|body|:root|main)\s*\{([^}]*)\}/gi)) {
      const decl = m[1].match(/background(?:-color)?\s*:\s*([^;]+)/i);
      const tok = decl?.[1].match(COLOR_TOKEN)?.[0] ?? decl?.[1].trim();
      const rgb = tok ? parseColor(tok) : null;
      if (rgb) bgs.push(luminance(rgb));
    }
  }
  if (bgs.length === 0) return "light";
  const dark = bgs.filter((l) => l < 0.2).length;
  if (dark === bgs.length) return "dark";
  if (dark === 0) return "light";
  return "mixed";
}

const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica neue", "helvetica", "arial", "noto sans",
  "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "inherit", "initial", "unset",
  "var", "emoji", "math", "fangsong", "ui-rounded", "liberation sans", "oxygen", "ubuntu", "cantarell", "fira sans",
  "droid sans", "menlo", "monaco", "consolas", "courier new", "courier", "sfmono-regular", "liberation mono",
]);

/** Rank font families by usage; webfonts and Google Fonts links weigh most. */
export function collectFonts(cssChunks: string[], googleFontFamilies: string[] = []): string[] {
  const counts = new Map<string, number>();
  const add = (name: string, w: number) => {
    let clean = name.trim().replace(/^["']|["']$/g, "").trim();
    // Next.js / CSS-module generated names, e.g. "__Inter_d65c78" → "Inter"
    clean = clean.replace(/^__/, "").replace(/_[0-9a-f]{5,}$/i, "").replace(/_/g, " ").trim();
    if (/fallback/i.test(clean)) return;
    if (!clean || clean.length > 60 || GENERIC_FONTS.has(clean.toLowerCase()) || clean.startsWith("var(") || clean.startsWith("--")) return;
    counts.set(clean, (counts.get(clean) ?? 0) + w);
  };
  for (const css of cssChunks) {
    for (const m of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*([^;}]+)/gi)) add(m[1], 3);
    for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
      const first = m[1].split(",")[0];
      add(first, 1);
    }
  }
  for (const f of googleFontFamilies) add(f, 5);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}
