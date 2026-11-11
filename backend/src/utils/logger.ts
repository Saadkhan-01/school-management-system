
type Level = "info" | "warn" | "error" | "debug";
function log(level: Level, msg: string, meta?: unknown) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, msg };
  if (meta !== undefined) entry.meta = meta instanceof Error ? { message: meta.message } : meta;
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line); else console.log(line);
}
export const logger = { info: (m: string, x?: unknown) => log("info", m, x), warn: (m: string, x?: unknown) => log("warn", m, x), error: (m: string, x?: unknown) => log("error", m, x), debug: (m: string, x?: unknown) => log("debug", m, x) };
