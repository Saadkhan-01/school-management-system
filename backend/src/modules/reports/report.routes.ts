import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { AppError } from "../../utils/AppError";
import * as svc from "./report.service";
import { assertReportAccess, reportCatalogue, runReport } from "./reports9.service";
import { EXPORT_CONTENT_TYPES, EXPORT_FORMATS, renderExport, type ExportFormat } from "./reportExport";
import { listActivityLogs } from "../audit/audit.service";

/**
 * Reports (§27) — Phase 4 delivers the dashboard statistics endpoints.
 * Full report/export suites (PDF/Excel/CSV) are Phase 9; this router replaces
 * the /reports stub for the dashboard paths only.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.get("/dashboard/admin", authenticate, authorize("admin"), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: { stats: await svc.dashboardStats("admin") } });
}));
r.get("/dashboard/principal", authenticate, authorize("principal", "admin"), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: { stats: await svc.dashboardStats("principal") } });
}));

/* =====================================================================
 * Phase 9 — Report suite + exports + activity logs (§27, §33).
 * Access model: every report key declares its roles in the registry
 * (reports9.service.ts). Key existence (404) and role (403) are checked
 * BEFORE requireDb so they behave identically with/without a database;
 * the export endpoint applies exactly the same gate as the JSON endpoint.
 * ===================================================================== */
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const ALL_ROLES = ["admin", "principal", "teacher", "student", "parent", "accountant", "librarian", "receptionist"] as const;

r.get("/catalogue", authenticate, authorize(...ALL_ROLES), wrap(async (req, res) => {
  res.json({ success: true, data: { reports: reportCatalogue(actor(req)) } });
}));

r.get("/activity-logs", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  const out = await listActivityLogs(req.query as Record<string, unknown>);
  res.json({ success: true, data: { logs: out.items }, meta: out.meta });
}));

/** Pre-DB gate: format (422) → report key (404) → role (403), all before requireDb. */
const exportGate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const format = String(req.query.format ?? "csv") as ExportFormat;
    if (!EXPORT_FORMATS.includes(format)) throw new AppError(422, "VALIDATION_ERROR", `format must be one of: ${EXPORT_FORMATS.join(", ")}`);
    assertReportAccess(actor(req), req.params.key);
    return next();
  } catch (e) { return next(e); }
};
const reportGate = (req: Request, _res: Response, next: NextFunction) => {
  try { assertReportAccess(actor(req), req.params.key); return next(); } catch (e) { return next(e); }
};

r.get("/:key/export", authenticate, authorize(...ALL_ROLES), exportGate, requireDb, wrap(async (req, res) => {
  const format = String(req.query.format ?? "csv") as ExportFormat;
  const report = await runReport(actor(req), req.params.key, req.query as Record<string, unknown>);
  const out = await renderExport(report, format);
  res.setHeader("Content-Type", EXPORT_CONTENT_TYPES[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.key}-report.${format}"`);
  if (Buffer.isBuffer(out)) { res.send(out); return; }
  out.pipe(res);
}));

r.get("/:key", authenticate, authorize(...ALL_ROLES), reportGate, requireDb, wrap(async (req, res) => {
  const report = await runReport(actor(req), req.params.key, req.query as Record<string, unknown>);
  res.json({ success: true, data: { report } });
}));

export default r;
