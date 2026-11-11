import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { Conversation, Message } from "./message.model";
import { User, type UserRole } from "../users/user.model";
import { notify } from "../notifications/notification.service";
import { assertStudentVisible, parentLinkedStudentIds, teacherAssignments, type Actor } from "../academic-scope";
import { Enrollment } from "../enrollments/enrollment.model";
import { ParentStudent } from "../parents/parent.model";
import { Student } from "../students/student.model";

/**
 * Messaging service (§24) — Phase 9.
 *
 * Allowed conversation pairs (anything else → 403 CONVERSATION_NOT_ALLOWED):
 *  - Parent ↔ Teacher, ONLY when the teacher is assigned (TeacherAssignment)
 *    to a class/section/session in which one of the parent's VERIFIED-linked
 *    children is actively enrolled. A `studentId` context, when given, must
 *    be that verified child and the teacher must teach that child.
 *  - Parent ↔ Admin / Receptionist (school office).
 *  - Staff ↔ Staff: any two users whose roles are both staff roles
 *    (admin, principal, teacher, accountant, librarian, receptionist).
 * Students cannot use messaging; parent↔parent / parent↔accountant /
 * parent↔librarian are not allowed pairs.
 */
const STAFF_ROLES: UserRole[] = ["admin", "principal", "teacher", "accountant", "librarian", "receptionist"];
const OFFICE_ROLES: UserRole[] = ["admin", "receptionist"];

async function teacherTeachesAnyOfStudents(teacherUserId: string, studentIds: string[]): Promise<boolean> {
  const { assignments } = await teacherAssignments(teacherUserId);
  if (!assignments.length || !studentIds.length) return false;
  const hit = await Enrollment.findOne({
    student: { $in: studentIds }, status: "active",
    $or: assignments.map((a) => ({ schoolClass: a.schoolClass, section: a.section, session: a.session })),
  }).select("_id").lean();
  return Boolean(hit);
}

async function assertPairAllowed(actor: Actor, other: { id: string; role: UserRole }, studentId?: string) {
  const deny = () => new AppError(403, "CONVERSATION_NOT_ALLOWED", `A conversation between '${actor.role}' and '${other.role}' is not an allowed messaging pair`);
  if (actor.id === other.id) throw new AppError(422, "VALIDATION_ERROR", "You cannot start a conversation with yourself");
  if (actor.role === "student" || other.role === "student") throw deny();

  if (actor.role === "parent" || other.role === "parent") {
    const parentId = actor.role === "parent" ? actor.id : other.id;
    const partner = actor.role === "parent" ? other : { id: actor.id, role: actor.role };
    if (partner.role === "parent") throw deny();
    if (OFFICE_ROLES.includes(partner.role)) return; // parent ↔ office
    if (partner.role === "teacher") {
      if (studentId) {
        // Context child must be the parent's verified child, and the teacher must teach that child.
        const linked = await parentLinkedStudentIds(parentId);
        if (!linked.includes(studentId)) throw new AppError(403, "FORBIDDEN", "That student is not linked to the parent account");
        if (!(await teacherTeachesAnyOfStudents(partner.id, [studentId]))) throw new AppError(403, "CONVERSATION_NOT_ALLOWED", "This teacher is not assigned to a class of that child");
        return;
      }
      const linked = await parentLinkedStudentIds(parentId);
      if (!(await teacherTeachesAnyOfStudents(partner.id, linked))) throw new AppError(403, "CONVERSATION_NOT_ALLOWED", "This teacher is not assigned to a class of any of the parent's linked children");
      return;
    }
    throw deny();
  }
  if (STAFF_ROLES.includes(actor.role) && STAFF_ROLES.includes(other.role)) return; // staff ↔ staff
  throw deny();
}

export async function createConversation(actor: Actor, input: { otherUserId: string; studentId?: string }) {
  const other = await User.findById(input.otherUserId).select("name email role isActive").lean();
  if (!other) throw new AppError(404, "USER_NOT_FOUND", "The other user was not found");
  if (!other.isActive) throw new AppError(422, "USER_INACTIVE", "That account is inactive");
  await assertPairAllowed(actor, { id: String(other._id), role: other.role }, input.studentId);
  if (input.studentId && actor.role !== "parent" && other.role !== "parent") {
    // A student context only makes sense on parent threads; staff↔staff
    // conversations about a student must still respect record visibility.
    await assertStudentVisible(actor, input.studentId);
  }
  const participants = [actor.id, input.otherUserId].sort();
  const filter: Record<string, unknown> = { participants };
  if (input.studentId) filter.studentContext = input.studentId; else filter.studentContext = { $exists: false };
  const existing = await Conversation.findOne(filter).populate({ path: "participants", select: "name email role" }).lean();
  if (existing) return { conversation: existing, created: false };
  const doc = await Conversation.create({ participants, studentContext: input.studentId, createdBy: actor.id });
  const populated = await Conversation.findById(doc._id).populate({ path: "participants", select: "name email role" }).lean();
  return { conversation: populated, created: true };
}

export async function listConversations(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter = { participants: actor.id };
  const [items, total] = await Promise.all([
    Conversation.find(filter).populate({ path: "participants", select: "name email role" }).sort({ lastMessageAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Conversation.countDocuments(filter),
  ]);
  const withUnread = await Promise.all(items.map(async (c) => ({
    ...c,
    unreadCount: await Message.countDocuments({ conversation: c._id, sender: { $ne: actor.id }, readBy: { $ne: actor.id } }),
  })));
  return { items: withUnread, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function mustParticipantConversation(actor: Actor, conversationId: string) {
  requireObjectId(conversationId, "Conversation");
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  if (!conv.participants.map(String).includes(actor.id)) throw new AppError(403, "FORBIDDEN", "You are not a participant in this conversation");
  return conv;
}

export async function listMessages(actor: Actor, conversationId: string, query: Record<string, unknown>) {
  const conv = await mustParticipantConversation(actor, conversationId);
  const { page, limit } = pageOptions(query);
  const filter = { conversation: conv._id };
  const [items, total] = await Promise.all([
    Message.find(filter).populate({ path: "sender", select: "name email role" }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Message.countDocuments(filter),
  ]);
  return { items: items.reverse(), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function sendMessage(actor: Actor, conversationId: string, body: string) {
  const conv = await mustParticipantConversation(actor, conversationId);
  const msg = await Message.create({ conversation: conv._id, sender: actor.id, body, readBy: [actor.id] });
  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = body.slice(0, 200);
  await conv.save();
  const populated = await Message.findById(msg._id).populate({ path: "sender", select: "name email role" }).lean();
  const others = conv.participants.map(String).filter((id) => id !== actor.id);
  await notify({
    userIds: others, type: "message", title: "New message",
    body: body.slice(0, 300), related: { kind: "conversation", id: conversationId }, createdBy: actor.id,
  });
  return populated;
}

export async function markConversationRead(actor: Actor, conversationId: string) {
  const conv = await mustParticipantConversation(actor, conversationId);
  const res = await Message.updateMany(
    { conversation: conv._id, sender: { $ne: actor.id }, readBy: { $ne: actor.id } },
    { $addToSet: { readBy: actor.id } },
  );
  return { updated: res.modifiedCount };
}

/**
 * Directory of people the caller is ALLOWED to start a conversation with —
 * computed from the same pair rules, so the UI never offers a pair the API
 * would reject. Parent → teachers of verified children + office staff;
 * Teacher → parents of students in assigned classes + all staff; other staff
 * → all staff (+ parents of their assigned students for teachers only).
 */
export async function listContacts(actor: Actor) {
  const contacts = new Map<string, { id: string; name: string; email: string; role: UserRole; viaStudentId?: string; viaStudentName?: string }>();
  const addUsers = async (ids: string[], via?: Map<string, { id: string; name: string }>) => {
    if (!ids.length) return;
    const users = await User.find({ _id: { $in: ids }, isActive: true }).select("name email role").lean();
    for (const u of users) {
      if (String(u._id) === actor.id) continue;
      const v = via?.get(String(u._id));
      contacts.set(String(u._id), { id: String(u._id), name: u.name, email: u.email, role: u.role, ...(v ? { viaStudentId: v.id, viaStudentName: v.name } : {}) });
    }
  };
  if (actor.role === "parent") {
    const childIds = await parentLinkedStudentIds(actor.id);
    const enrollments = await Enrollment.find({ student: { $in: childIds }, status: "active" }).lean();
    const { TeacherAssignment } = await import("../academics/academic.models");
    const combos = enrollments.map((e) => ({ schoolClass: e.schoolClass, section: e.section, session: e.session }));
    if (combos.length) {
      const assigns = await TeacherAssignment.find({ $or: combos }).lean();
      const teacherProfileIds = [...new Set(assigns.map((a) => String(a.teacher)))];
      const { TeacherProfile } = await import("../teachers/teacher.model");
      const profiles = await TeacherProfile.find({ _id: { $in: teacherProfileIds } }).select("user").lean();
      await addUsers(profiles.map((p) => String(p.user)));
    }
    const office = await User.find({ role: { $in: OFFICE_ROLES }, isActive: true }).select("_id").lean();
    await addUsers(office.map((u) => String(u._id)));
    return { contacts: [...contacts.values()] };
  }
  if (actor.role === "student") return { contacts: [] };
  // Staff: all other staff users.
  const staff = await User.find({ role: { $in: STAFF_ROLES }, isActive: true }).select("_id").lean();
  await addUsers(staff.map((u) => String(u._id)));
  if (actor.role === "teacher") {
    // + parents of students in the teacher's assigned classes.
    const { assignments } = await teacherAssignments(actor.id);
    if (assignments.length) {
      const enrollments = await Enrollment.find({ status: "active", $or: assignments.map((a) => ({ schoolClass: a.schoolClass, section: a.section, session: a.session })) }).select("student").lean();
      const studentIds = [...new Set(enrollments.map((e) => String(e.student)))];
      const links = await ParentStudent.find({ student: { $in: studentIds }, verified: true }).select("parentUser student").lean();
      const students = await Student.find({ _id: { $in: studentIds } }).select("firstName lastName").lean();
      const nameById = new Map(students.map((s) => [String(s._id), `${s.firstName} ${s.lastName}`.trim()]));
      const via = new Map<string, { id: string; name: string }>();
      for (const l of links) if (!via.has(String(l.parentUser))) via.set(String(l.parentUser), { id: String(l.student), name: nameById.get(String(l.student)) ?? "Student" });
      await addUsers([...via.keys()], via);
    }
  }
  return { contacts: [...contacts.values()] };
}
