import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { contentItemSchema, contentItemUpdateSchema, enquirySchema, enquiryStatusSchema, websiteContentSchema } from "./website.validation";
import type { ContentItemType } from "./contentItem.model";
import { CONTENT_ITEM_TYPES } from "./contentItem.model";
import * as svc from "./website.service";

const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
/** Public form submissions are rate-limited more strictly than general traffic. */
const publicFormLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many submissions — please try again later" } } });

/* ---------- Public reads (published content only) ---------- */
r.get("/public", requireDb, wrap(async (_req, res) => {
  const content = await svc.getPublishedContent();
  res.json({ success: true, data: { content }, meta: content ? undefined : { note: "No website content has been published yet — the site shows clearly-marked demo fallback content." } });
}));
r.get("/public/items", requireDb, wrap(async (req, res) => {
  const rawType = typeof req.query.type === "string" ? req.query.type : undefined;
  const type = rawType && (CONTENT_ITEM_TYPES as readonly string[]).includes(rawType) ? (rawType as ContentItemType) : undefined;
  const items = await svc.listPublicItems(type);
  res.json({ success: true, data: { items } });
}));

/* ---------- Public enquiry submission ---------- */
r.post("/enquiries", publicFormLimiter, validate(enquirySchema), requireDb, wrap(async (req, res) => {
  const enquiry = await svc.createEnquiry(req.body);
  res.status(201).json({ success: true, data: { id: String(enquiry._id), status: enquiry.status, message: "Enquiry received. The school office will contact you." } });
}));

/* ---------- Admin CMS: site content ---------- */
r.get("/admin/content", authenticate, authorize("admin"), requireDb, wrap(async (_req, res) => {
  const content = await svc.getAdminContent();
  res.json({ success: true, data: { content } });
}));
r.put("/admin/content", authenticate, authorize("admin"), validate(websiteContentSchema), requireDb, wrap(async (req, res) => {
  const content = await svc.upsertContent(req.body as Record<string, unknown>, req.user!.id);
  res.json({ success: true, data: { content } });
}));

/* ---------- Admin/Principal CMS: news, events, gallery, announcements ---------- */
r.get("/admin/items", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const out = await svc.listItemsAdmin(req.query as Record<string, unknown>);
  res.json({ success: true, data: { items: out.items }, meta: out.meta });
}));
r.post("/admin/items", authenticate, authorize("admin", "principal"), validate(contentItemSchema), requireDb, wrap(async (req, res) => {
  const item = await svc.createItem(req.body as Record<string, unknown>, { id: req.user!.id, role: req.user!.role });
  res.status(201).json({ success: true, data: { item } });
}));
r.put("/admin/items/:id", authenticate, authorize("admin", "principal"), validate(contentItemUpdateSchema), requireDb, wrap(async (req, res) => {
  const item = await svc.updateItem(req.params.id, req.body as Record<string, unknown>, { id: req.user!.id, role: req.user!.role });
  res.json({ success: true, data: { item } });
}));
r.delete("/admin/items/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  await svc.deleteItem(req.params.id);
  res.json({ success: true, data: { deleted: true } });
}));

/* ---------- Admin/Receptionist: enquiries inbox ---------- */
r.get("/admin/enquiries", authenticate, authorize("admin", "receptionist"), requireDb, wrap(async (req, res) => {
  const out = await svc.listEnquiries(req.query as Record<string, unknown>);
  res.json({ success: true, data: { enquiries: out.items }, meta: out.meta });
}));
r.patch("/admin/enquiries/:id/status", authenticate, authorize("admin", "receptionist"), validate(enquiryStatusSchema), requireDb, wrap(async (req, res) => {
  const enquiry = await svc.updateEnquiryStatus(req.params.id, req.body.status, { internalNotes: req.body.internalNotes, note: req.body.note }, req.user!.id);
  res.json({ success: true, data: { enquiry } });
}));

export default r;
