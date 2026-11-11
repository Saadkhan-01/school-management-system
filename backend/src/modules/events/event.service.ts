import { AppError } from "../../utils/AppError";
import { requireObjectId, definedOnly } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { CalendarEvent, type EventType } from "./event.model";
import { notify } from "../notifications/notification.service";
import type { UserRole } from "../users/user.model";
import type { Actor } from "../academic-scope";

/**
 * Internal calendar service (§23) — Phase 9.
 * Reads are audience-sliced: Admin/Principal see all events; every other
 * role sees only events whose audience includes "all" or their role.
 * Creating an `announcement`-type event notifies its audience via the
 * central notification service (persisted + socket; never throws).
 */
function audienceFilter(actor: Actor): Record<string, unknown> {
  if (actor.role === "admin" || actor.role === "principal") return {};
  return { audience: { $in: ["all", actor.role] } };
}

export async function listEvents(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = { ...audienceFilter(actor) };
  if (typeof query.type === "string" && query.type) filter.type = query.type;
  const from = typeof query.from === "string" ? new Date(query.from) : null;
  const to = typeof query.to === "string" ? new Date(query.to) : null;
  // Month-view friendly overlap query: event intersects [from, to].
  if (from && !Number.isNaN(from.getTime())) filter.endAt = { $gte: from };
  if (to && !Number.isNaN(to.getTime())) filter.startAt = { $lte: to };
  const [items, total] = await Promise.all([
    CalendarEvent.find(filter).populate({ path: "createdBy", select: "name email role" }).sort({ startAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    CalendarEvent.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getEvent(actor: Actor, id: string) {
  requireObjectId(id, "Calendar event");
  const doc = await CalendarEvent.findById(id).populate({ path: "createdBy", select: "name email role" }).lean();
  if (!doc) throw new AppError(404, "EVENT_NOT_FOUND", "Calendar event not found");
  if (actor.role !== "admin" && actor.role !== "principal" && !doc.audience.includes("all") && !doc.audience.includes(actor.role)) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Calendar event not found");
  }
  return doc;
}

export interface EventInput { title: string; description?: string; type: EventType; startAt: Date; endAt: Date; audience: string[]; attachments?: unknown[] }

export async function createEvent(actor: Actor, input: EventInput) {
  const doc = await CalendarEvent.create({ ...input, createdBy: actor.id });
  const populated = await CalendarEvent.findById(doc._id).populate({ path: "createdBy", select: "name email role" }).lean();
  if (input.type === "announcement") {
    const roles = (input.audience.includes("all") ? undefined : input.audience) as UserRole[] | undefined;
    await notify({
      ...(roles ? { roles } : { roles: ["admin", "principal", "teacher", "student", "parent", "accountant", "librarian", "receptionist"] as UserRole[] }),
      type: "announcement", title: `Announcement: ${input.title}`,
      body: input.description ?? `${input.title} — ${input.startAt.toISOString().slice(0, 10)}`,
      related: { kind: "calendar-event", id: String(doc._id) }, createdBy: actor.id,
    });
  }
  return populated;
}

export async function updateEvent(actor: Actor, id: string, input: Partial<EventInput>) {
  requireObjectId(id, "Calendar event");
  const doc = await CalendarEvent.findById(id);
  if (!doc) throw new AppError(404, "EVENT_NOT_FOUND", "Calendar event not found");
  const nextStart = input.startAt ?? doc.startAt;
  const nextEnd = input.endAt ?? doc.endAt;
  if (nextEnd.getTime() < nextStart.getTime()) throw new AppError(422, "VALIDATION_ERROR", "endAt must be on or after startAt");
  Object.assign(doc, definedOnly(input as Record<string, unknown>));
  await doc.save();
  return CalendarEvent.findById(doc._id).populate({ path: "createdBy", select: "name email role" }).lean();
}

export async function deleteEvent(_actor: Actor, id: string) {
  requireObjectId(id, "Calendar event");
  const doc = await CalendarEvent.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "EVENT_NOT_FOUND", "Calendar event not found");
  return { deleted: true };
}
