import { AppError } from "../../utils/AppError";
import type { UserRole } from "../users/user.model";
import { WebsiteContent, type IWebsiteContent } from "./website.model";
import { PublicContentItem, type ContentItemType, type IContentItem } from "./contentItem.model";
import { Enquiry, type EnquiryStatus, type IEnquiry } from "./enquiry.model";

export interface PageOptions { page: number; limit: number }
export function pageOptions(query: Record<string, unknown>): PageOptions {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit };
}
export function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/* ---------------- Website content (singleton CMS) ---------------- */

/** Public read: only a published document is ever exposed. Returns null when the
 *  school has not published content yet — the frontend then shows its clearly
 *  demo-marked fallback rather than invented "live" content. */
export async function getPublishedContent() {
  return WebsiteContent.findOne({ key: "main", isPublished: true }).lean();
}

/** Admin read: the stored document, or null (the admin UI starts from a blank form). */
export async function getAdminContent() {
  return WebsiteContent.findOne({ key: "main" }).lean();
}

export async function upsertContent(input: Record<string, unknown>, userId: string): Promise<IWebsiteContent> {
  const update = definedOnly(input);
  const doc = await WebsiteContent.findOneAndUpdate(
    { key: "main" },
    { $set: { ...update, updatedBy: userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return doc;
}

/* ---------------- School settings views (same document) ---------------- */

export async function getSettingsView() {
  const doc = await WebsiteContent.findOne({ key: "main" }).lean();
  if (!doc) return null;
  return { schoolName: doc.schoolName, tagline: doc.tagline, logoUrl: doc.logoUrl, contact: doc.contact, footer: doc.footer, admissionOpen: doc.admissionOpen, isPublished: doc.isPublished, updatedAt: doc.updatedAt };
}

export async function getPublicSettings() {
  const doc = await getPublishedContent();
  if (!doc) return null;
  return { schoolName: doc.schoolName, tagline: doc.tagline, logoUrl: doc.logoUrl, contact: doc.contact, admissionOpen: doc.admissionOpen };
}

/* ---------------- News / Events / Gallery / Announcements ---------------- */

/** Role-targeted announcements must never leak publicly: only audience public/all. */
export async function listPublicItems(type?: ContentItemType) {
  const now = new Date();
  const filter: Record<string, unknown> = {
    status: "published",
    audience: { $in: ["public", "all"] },
    $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }],
  };
  if (type) filter.type = type;
  return PublicContentItem.find(filter).sort({ isFeatured: -1, publishAt: -1, createdAt: -1 }).limit(100).lean();
}

export async function listItemsAdmin(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.type === "string" && query.type) filter.type = query.type;
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.search === "string" && query.search.trim()) filter.title = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    PublicContentItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PublicContentItem.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function createItem(input: Record<string, unknown>, actor: { id: string; role: UserRole }): Promise<IContentItem> {
  if (actor.role === "principal" && input.type !== "announcement") {
    throw new AppError(403, "FORBIDDEN", "Principals may publish announcements only; other content types are managed by Admin");
  }
  return PublicContentItem.create({ ...input, createdBy: actor.id, updatedBy: actor.id });
}

export async function updateItem(id: string, input: Record<string, unknown>, actor: { id: string; role: UserRole }): Promise<IContentItem> {
  const existing = await PublicContentItem.findById(id);
  if (!existing) throw new AppError(404, "ITEM_NOT_FOUND", "Content item not found");
  if (actor.role === "principal" && (existing.type !== "announcement" || (input.type !== undefined && input.type !== "announcement"))) {
    throw new AppError(403, "FORBIDDEN", "Principals may edit announcements only");
  }
  Object.assign(existing, definedOnly(input as Record<string, unknown>));
  existing.updatedBy = actor.id as never;
  await existing.save();
  return existing;
}

export async function deleteItem(id: string): Promise<void> {
  const deleted = await PublicContentItem.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, "ITEM_NOT_FOUND", "Content item not found");
}

/* ---------------- Enquiries ---------------- */

export async function createEnquiry(input: { name: string; email: string; phone?: string; subject: string; message: string }): Promise<IEnquiry> {
  const enquiry = await Enquiry.create({
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone || undefined,
    subject: input.subject,
    message: input.message,
    status: "new",
    statusHistory: [{ status: "new", at: new Date(), note: "Submitted via public contact form" }],
  });
  return enquiry;
}

export async function listEnquiries(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { subject: rx }];
  }
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Enquiry.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateEnquiryStatus(id: string, status: EnquiryStatus, opts: { internalNotes?: string; note?: string }, userId: string): Promise<IEnquiry> {
  const enquiry = await Enquiry.findById(id);
  if (!enquiry) throw new AppError(404, "ENQUIRY_NOT_FOUND", "Enquiry not found");
  enquiry.status = status;
  enquiry.handledBy = userId as never;
  if (opts.internalNotes !== undefined) enquiry.internalNotes = opts.internalNotes;
  enquiry.statusHistory.push({ status, by: userId as never, note: opts.note, at: new Date() });
  await enquiry.save();
  return enquiry;
}
