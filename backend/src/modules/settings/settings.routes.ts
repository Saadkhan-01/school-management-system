import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { schoolSettingsSchema } from "../website/website.validation";
import * as svc from "../website/website.service";

/**
 * School settings (§28/§29 schoolSettings) — a focused view over the WebsiteContent
 * singleton (identity, contact, footer, admissions-open flag) so there is exactly
 * one source of truth for school identity. Admin-only writes.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.get("/public", requireDb, wrap(async (_req, res) => {
  const settings = await svc.getPublicSettings();
  res.json({ success: true, data: { settings } });
}));
r.get("/", authenticate, authorize("admin"), requireDb, wrap(async (_req, res) => {
  const settings = await svc.getSettingsView();
  res.json({ success: true, data: { settings } });
}));
r.put("/", authenticate, authorize("admin"), validate(schoolSettingsSchema), requireDb, wrap(async (req, res) => {
  const content = await svc.upsertContent(req.body as Record<string, unknown>, req.user!.id);
  res.json({ success: true, data: { settings: { schoolName: content.schoolName, tagline: content.tagline, logoUrl: content.logoUrl, contact: content.contact, footer: content.footer, admissionOpen: content.admissionOpen, isPublished: content.isPublished, updatedAt: content.updatedAt } } });
}));

export default r;
