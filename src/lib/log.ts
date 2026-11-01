/** Structured server-side logging (JSON lines → picked up by any log drain). */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, d?: Record<string, unknown>) => emit("debug", m, d),
  info: (m: string, d?: Record<string, unknown>) => emit("info", m, d),
  warn: (m: string, d?: Record<string, unknown>) => emit("warn", m, d),
  error: (m: string, d?: Record<string, unknown>) => emit("error", m, d),
};
