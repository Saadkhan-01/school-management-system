#!/usr/bin/env node
/**
 * No-DB HTTP probe suite (Phases 1–9 regression, automated in Phase 10).
 *
 * Boots the BUILT backend (dist/server.js — run `npm run build` first) with
 * NO MongoDB configured and asserts the honest degradation contract:
 *   - health responds 200 with database:"disconnected"
 *   - protected routes reject anonymous calls with 401
 *   - DB-backed public reads answer 503 DB_UNAVAILABLE (never fake data)
 *   - invalid public form bodies answer 422
 *   - the only remaining 501 stubs are roles/permissions (by design: roles
 *     are a fixed enum; permissions derive from code + docs/permissions.md)
 *
 * Usage: npm run build && npm run test:probes   (exit code 0 = all passed)
 */
import { spawn } from "child_process";
import http from "http";
import jwt from "jsonwebtoken";

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };

function req(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const r = http.request(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => { buf += c; });
      res.on("end", () => { let json = null; try { json = JSON.parse(buf); } catch { /* non-JSON */ } resolve({ status: res.statusCode, json, raw: buf }); });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

const waitForHealth = async (tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    try { const h = await req("GET", "/health"); if (h.status === 200) return h; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not come up");
};

const env = { ...process.env, PORT: String(PORT), NODE_ENV: "development", JWT_ACCESS_SECRET: "probe-secret", JWT_REFRESH_SECRET: "probe-secret-2" };
delete env.MONGODB_URI;
const child = spawn("node", ["dist/server.js"], { cwd: new URL("..", import.meta.url).pathname, env, stdio: "pipe" });
let serverLog = "";
child.stdout.on("data", (d) => { serverLog += d; });
child.stderr.on("data", (d) => { serverLog += d; });

try {
  const health = await waitForHealth();
  check("health 200 + db not connected", health.json?.data?.db !== "connected" && health.json?.data?.mongoReadyState === 0, JSON.stringify(health.json?.data ?? {}));

  const pubSettings = await req("GET", "/website/public");
  check("public website payload (no DB) → 503 DB_UNAVAILABLE", pubSettings.status === 503 && pubSettings.json?.error?.code === "DB_UNAVAILABLE", `got ${pubSettings.status}`);

  const anonUsers = await req("GET", "/users");
  check("anonymous /users → 401", anonUsers.status === 401, `got ${anonUsers.status}`);

  const badEnquiry = await req("POST", "/website/enquiries", { body: { name: "x" } });
  check("invalid enquiry body → 422 VALIDATION_ERROR", badEnquiry.status === 422 && badEnquiry.json?.error?.code === "VALIDATION_ERROR", `got ${badEnquiry.status}`);

  const fakeAdmin = jwt.sign({ sub: "507f1f77bcf86cd799439011", role: "admin" }, "probe-secret", { expiresIn: "5m" });
  const gatedInvoices = await req("GET", "/invoices", { token: fakeAdmin });
  check("authed /invoices (no DB) → 503 DB_UNAVAILABLE", gatedInvoices.status === 503 && gatedInvoices.json?.error?.code === "DB_UNAVAILABLE", `got ${gatedInvoices.status}`);

  const roles = await req("GET", "/roles", { token: fakeAdmin });
  check("roles stub → 501 NOT_IMPLEMENTED (by design)", roles.status === 501 && roles.json?.error?.code === "NOT_IMPLEMENTED", `got ${roles.status}`);
  const perms = await req("GET", "/permissions", { token: fakeAdmin });
  check("permissions stub → 501 NOT_IMPLEMENTED (by design)", perms.status === 501, `got ${perms.status}`);

  const notFound = await req("GET", "/no-such-route");
  check("unknown route → 404", notFound.status === 404, `got ${notFound.status}`);
} catch (err) {
  check("probe run completed", false, String(err));
  console.log(serverLog.slice(-2000));
} finally {
  child.kill("SIGTERM");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
process.exit(failed.length ? 1 : 0);
