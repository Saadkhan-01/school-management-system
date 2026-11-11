import mongoose from "mongoose";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { Notification, type NotificationType } from "./notification.model";
import { emitToUser } from "./socket";
import { dispatchExternalChannels } from "./channels";
import { User, type UserRole } from "../users/user.model";
import { Student } from "../students/student.model";
import { ParentStudent } from "../parents/parent.model";
import { Enrollment } from "../enrollments/enrollment.model";
import type { Actor } from "../academic-scope";

/**
 * Central notification service (§24/§35) — Phase 9.
 *
 * notify() is the ONLY way notifications are created. It:
 *   1. resolves recipients (explicit user ids and/or role audiences),
 *   2. PERSISTS one Notification per recipient (offline users still see it),
 *   3. emits each record over Socket.IO to that user's room (best effort),
 *   4. hands the message to the external channels (unconfigured no-ops).
 *
 * notify() NEVER throws: a notification failure must not fail the business
 * operation that triggered it (every event hook relies on this contract).
 */
export interface NotifyInput {
  userIds?: string[];
  roles?: UserRole[];
  type: NotificationType;
  title: string;
  body: string;
  related?: { kind: string; id?: string };
  createdBy?: string;
}

export async function resolveRecipients(input: NotifyInput): Promise<string[]> {
  const ids = new Set<string>((input.userIds ?? []).filter((id) => mongoose.isValidObjectId(id)));
  if (input.roles?.length) {
    const users = await User.find({ role: { $in: input.roles }, isActive: true }).select("_id").lean();
    for (const u of users) ids.add(String(u._id));
  }
  return [...ids];
}

export async function notify(input: NotifyInput): Promise<number> {
  try {
    if (mongoose.connection.readyState !== 1) return 0;
    const recipients = await resolveRecipients(input);
    if (!recipients.length) return 0;
    const docs = recipients.map((recipient) => ({
      recipient,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 2000),
      relatedEntity: input.related ? { kind: input.related.kind, id: input.related.id && mongoose.isValidObjectId(input.related.id) ? input.related.id : undefined } : undefined,
      createdBy: input.createdBy && mongoose.isValidObjectId(input.createdBy) ? input.createdBy : undefined,
    }));
    const created = await Notification.insertMany(docs);
    for (const doc of created) {
      emitToUser(String(doc.recipient), "notification", {
        id: String(doc._id), type: doc.type, title: doc.title, body: doc.body,
        relatedEntity: doc.relatedEntity, isRead: false, createdAt: doc.createdAt,
      });
      void dispatchExternalChannels({ toUserId: String(doc.recipient), title: doc.title, body: doc.body, type: doc.type });
    }
    return created.length;
  } catch (err) {
    logger.warn("[notifications] notify() failed (ignored — notifications never fail the parent operation)", err);
    return 0;
  }
}

/* ---------- Recipient resolvers used by the event hooks ---------- */

/** Login user ids of the given students PLUS the user ids of their VERIFIED-linked parents. */
export async function userIdsForStudents(studentIds: string[]): Promise<string[]> {
  const ids = [...new Set(studentIds.filter((id) => mongoose.isValidObjectId(id)))];
  if (!ids.length) return [];
  const [students, links] = await Promise.all([
    Student.find({ _id: { $in: ids } }).select("user").lean(),
    ParentStudent.find({ student: { $in: ids }, verified: true }).select("parentUser").lean(),
  ]);
  const out = new Set<string>();
  for (const s of students) if (s.user) out.add(String(s.user));
  for (const l of links) out.add(String(l.parentUser));
  return [...out];
}

/** Students with an ACTIVE enrollment in a class/section/session → their + verified parents' user ids. */
export async function userIdsForClassSection(input: { schoolClass: string; section: string; session: string }): Promise<string[]> {
  const enrollments = await Enrollment.find({ schoolClass: input.schoolClass, section: input.section, session: input.session, status: "active" }).select("student").lean();
  return userIdsForStudents(enrollments.map((e) => String(e.student)));
}

/** Students with an ACTIVE enrollment in ANY of an exam's classes (in the exam's session) → + verified parents. */
export async function userIdsForExamClasses(input: { classes: string[]; session: string }): Promise<string[]> {
  if (!input.classes.length) return [];
  const enrollments = await Enrollment.find({ schoolClass: { $in: input.classes }, session: input.session, status: "active" }).select("student").lean();
  return userIdsForStudents(enrollments.map((e) => String(e.student)));
}

/* ---------- Own-scope REST operations ---------- */

export async function listNotifications(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = { recipient: actor.id };
  if (query.unread === "true") filter.isRead = false;
  if (typeof query.type === "string" && query.type) filter.type = query.type;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: actor.id, isRead: false }),
  ]);
  return { items, unread, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function unreadCount(actor: Actor) {
  return { unread: await Notification.countDocuments({ recipient: actor.id, isRead: false }) };
}

export async function markRead(actor: Actor, id: string) {
  requireObjectId(id, "Notification");
  const doc = await Notification.findById(id);
  if (!doc) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  if (String(doc.recipient) !== actor.id) throw new AppError(403, "FORBIDDEN", "You can only manage your own notifications");
  if (!doc.isRead) { doc.isRead = true; doc.readAt = new Date(); await doc.save(); }
  return doc.toObject();
}

export async function markAllRead(actor: Actor) {
  const res = await Notification.updateMany({ recipient: actor.id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  return { updated: res.modifiedCount };
}
