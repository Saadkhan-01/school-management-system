
import { AppError } from "../../utils/AppError";
import { escapeRegex, pageOptions } from "../website/website.service";
import { Visitor } from "./visitor.model";
import type { Actor } from "../academic-scope";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });
export async function checkIn(actor: Actor, input: { name: string; phone: string; purpose: string; visitingWhom: string; checkInAt?: Date; note?: string }) {
  return Visitor.create({ ...input, checkInAt: input.checkInAt ?? new Date(), recordedBy: actor.id });
}
export async function list(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (query.onPremises === "true") filter.checkOutAt = { $exists: false };
  if (typeof query.search === "string" && query.search.trim()) { const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" }; filter.$or = [{ name: rx }, { phone: rx }, { visitingWhom: rx }]; }
  const [items, total] = await Promise.all([Visitor.find(filter).sort({ checkInAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Visitor.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function checkOut(id: string, input: { checkOutAt?: Date }) {
  const doc = await Visitor.findById(id); if (!doc) throw new AppError(404, "VISITOR_NOT_FOUND", "Visitor record not found");
  if (doc.checkOutAt) throw new AppError(409, "ALREADY_CHECKED_OUT", "This visitor has already checked out");
  const out = input.checkOutAt ?? new Date();
  if (out < doc.checkInAt) throw new AppError(422, "CHECKOUT_BEFORE_CHECKIN", "Check-out time cannot be before check-in time");
  doc.checkOutAt = out; await doc.save(); return doc;
}
export async function dashboard() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [today, onPremises] = await Promise.all([Visitor.countDocuments({ checkInAt: { $gte: start } }), Visitor.countDocuments({ checkOutAt: { $exists: false } })]);
  return { visitorsToday: today, currentlyOnPremises: onPremises };
}
