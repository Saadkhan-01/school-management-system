
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./certificate.validation";
import * as svc from "./certificate.service";
import { renderCertificatePdf } from "./certificatePdf";
import { AppError } from "../../utils/AppError";
/**
 * Certificates (§26) under /api/v1/certificates.
 * Issue: Admin + Principal (matrix ●) + Accountant for fee-clearance ONLY (matrix ◐ fee-clearance — service-enforced).
 * Revoke: Admin only. Reads: Admin/Principal/Accountant full; Student own; Parent verified-linked.
 * PUBLIC verify route is mounted BEFORE any authenticate middleware and validates the reference format (422) before the DB check.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.get("/verify/:reference", validate(v.verifyParamsSchema, "params"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: await svc.verifyReference(req.params.reference) }); }));
const accountantScope = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role === "accountant" && (req.body as { type?: string }).type !== "fee-clearance") return next(new AppError(403, "FORBIDDEN", "Accountants may only issue fee-clearance certificates (permissions matrix)"));
  return next();
};
r.post("/", authenticate, authorize("admin", "principal", "accountant"), validate(v.issueSchema), accountantScope, requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { certificate: await svc.issueCertificate(actor(req), req.body) } });
}));
r.get("/", authenticate, authorize("admin", "principal", "accountant", "student", "parent"), requireDb, wrap(async (req, res) => { const out = await svc.listCertificates(actor(req), req.query as Record<string, unknown>); res.json({ success: true, data: { certificates: out.items }, meta: out.meta }); }));
r.get("/:id/pdf", authenticate, authorize("admin", "principal", "accountant", "student", "parent"), requireDb, wrap(async (req, res) => {
  const cert = await svc.getCertificate(actor(req), req.params.id);
  res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="certificate-${(cert as { referenceNumber: string }).referenceNumber}.pdf"`);
  renderCertificatePdf(cert as never).pipe(res);
}));
r.get("/:id", authenticate, authorize("admin", "principal", "accountant", "student", "parent"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { certificate: await svc.getCertificate(actor(req), req.params.id) } }); }));
r.post("/:id/revoke", authenticate, authorize("admin"), validate(v.revokeSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { certificate: await svc.revokeCertificate(actor(req), req.params.id, req.body.reason) } }); }));
export default r;
