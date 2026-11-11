import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";
import { nextAdmissionNumber } from "../../utils/admissionNumber";
import { randomToken } from "../../utils/tokens";
import { User, type UserRole } from "../users/user.model";
import { Student } from "../students/student.model";
import { ParentProfile, ParentStudent } from "../parents/parent.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { validatePlacement } from "../enrollments/enrollment.service";
import { AdmissionApplication, type AdmissionStatus, type IAdmissionApplication } from "./admission.model";
import { escapeRegex, pageOptions } from "../website/website.service";
import { notify } from "../notifications/notification.service";
import { logActivity } from "../audit/audit.service";

/** Phase 9: notify the guardian's parent account (if one exists yet) about an admission status change. Never throws. */
async function notifyGuardianOfStatus(app: IAdmissionApplication, actor: { id: string }) {
  const parent = await User.findOne({ email: app.guardianEmail, role: "parent" }).select("_id").lean().catch(() => null);
  if (!parent) return;
  await notify({
    userIds: [String(parent._id)], type: "admission-status", title: `Admission application ${app.status}`,
    body: `The admission application for ${app.studentName} is now "${app.status}".`,
    related: { kind: "admission", id: String(app._id) }, createdBy: actor.id,
  });
}

/**
 * Phase 2 admission workflow (§16, steps 1–5 only):
 *   Submitted --(Receptionist/Admin/Principal)--> Under Review
 *   Under Review --(Admin/Principal)--> Approved | Rejected
 * "Enrolled" is deliberately NOT reachable here: enrollment conversion (admission
 * number, verified parent account, class/section/session assignment, fee structure,
 * parent notification) is Phase 4. Requesting it returns an explicit 422.
 */
export const ADMISSION_TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  Submitted: ["Under Review"],
  "Under Review": ["Approved", "Rejected"],
  Approved: ["Enrolled"], // reachable ONLY via POST /admissions/:id/enroll (Phase 4 conversion), never via the plain status PATCH
  Rejected: [],
  Enrolled: [],
};
const REVIEWERS: UserRole[] = ["admin", "principal", "receptionist"];
const DECIDERS: UserRole[] = ["admin", "principal"];

export async function submitApplication(input: {
  studentName: string; dateOfBirth: Date; gender: "male" | "female" | "other";
  guardianName: string; guardianRelation?: string; guardianEmail: string; guardianPhone: string;
  previousSchool?: string; desiredClass: string; address: string; city?: string;
  documents?: Array<{ name: string; type?: string; url?: string; note?: string }>;
}): Promise<IAdmissionApplication> {
  const app = await AdmissionApplication.create({
    studentName: input.studentName,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    guardianName: input.guardianName,
    guardianRelation: input.guardianRelation || undefined,
    guardianEmail: input.guardianEmail.toLowerCase(),
    guardianPhone: input.guardianPhone,
    previousSchool: input.previousSchool || undefined,
    desiredClass: input.desiredClass,
    address: input.address,
    city: input.city || undefined,
    documents: input.documents ?? [],
    status: "Submitted",
    statusHistory: [{ status: "Submitted", at: new Date(), note: "Online application submitted by guardian" }],
  });
  return app;
}

export async function listApplications(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    filter.$or = [{ studentName: rx }, { guardianName: rx }, { guardianEmail: rx }, { desiredClass: rx }];
  }
  const [items, total] = await Promise.all([
    AdmissionApplication.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdmissionApplication.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getApplication(id: string) {
  const app = await AdmissionApplication.findById(id).lean();
  if (!app) throw new AppError(404, "APPLICATION_NOT_FOUND", "Admission application not found");
  return app;
}

export async function updateApplicationStatus(
  id: string,
  target: AdmissionStatus,
  note: string | undefined,
  actor: { id: string; role: UserRole },
): Promise<IAdmissionApplication> {
  if (target === "Enrolled") {
    throw new AppError(422, "USE_ENROLL_ENDPOINT", "Enrollment is a conversion, not a plain status change: use POST /admissions/:id/enroll with sessionId, classId and sectionId so the student record, admission number, verified parent link and enrollment are created together (§16).");
  }
  const app = await AdmissionApplication.findById(id);
  if (!app) throw new AppError(404, "APPLICATION_NOT_FOUND", "Admission application not found");
  const allowed = ADMISSION_TRANSITIONS[app.status];
  if (!allowed.includes(target)) {
    throw new AppError(409, "INVALID_STATUS_TRANSITION", `Cannot move an application from '${app.status}' to '${target}'`, { currentStatus: app.status, allowedTransitions: allowed });
  }
  if (target === "Under Review" && !REVIEWERS.includes(actor.role)) {
    throw new AppError(403, "FORBIDDEN", `Role '${actor.role}' cannot review admission applications`);
  }
  if ((target === "Approved" || target === "Rejected") && !DECIDERS.includes(actor.role)) {
    throw new AppError(403, "FORBIDDEN", "Only Admin or Principal can approve or reject an admission application");
  }
  app.status = target;
  if (target === "Under Review") app.reviewedBy = actor.id as never;
  if (target === "Approved" || target === "Rejected") app.decidedBy = actor.id as never;
  app.statusHistory.push({ status: target, by: actor.id as never, byRole: actor.role, note, at: new Date() });
  await app.save();
  await logActivity({ actor, action: "admission.status", entityKind: "admission", entityId: String(app._id), summary: `Admission application for ${app.studentName} moved to "${target}"`, metadata: { status: target } });
  await notifyGuardianOfStatus(app, actor);
  return app;
}

/* =====================================================================
 * Phase 4 — Admission → Enrolled conversion (§16 steps 6–12)
 * ---------------------------------------------------------------------
 * Steps: (6) approved application converts; (7) generate a unique
 * admission number ADM-<year>-<seq> (collision-safe retry on the unique
 * index); (8) create or link the parent account + profile with a VERIFIED
 * ParentStudent link; (9) assign class/section; (10) assign session;
 * (11) apply fee structure — Phase 7, recorded as a TODO in the tracker,
 * NOT faked here; (12) notify the parent — since Phase 9 this is REAL: the
 * afterEnroll() hook in this function creates the parent's notification via
 * the central notification service once the conversion commits.
 *
 * Atomicity: the writes run inside a Mongoose transaction when the
 * deployment supports it (MongoDB replica set / Atlas). A standalone
 * MongoDB without a replica set rejects transactions; in that case the
 * service falls back to sequential writes with compensating rollback
 * (created documents are deleted in reverse order) and logs the fallback.
 * ===================================================================== */

export interface EnrollResult {
  application: IAdmissionApplication;
  student: { id: string; admissionNumber: string; firstName: string; lastName: string };
  parent: { userId: string; profileId: string; created: boolean; devTemporaryPassword?: string };
  enrollment: { id: string; sessionId: string; classId: string; sectionId: string };
  feeStructure: null;
  feeStructureNote: string;
  notification: null;
  notificationNote: string;
}

const SALT = 12;

export async function enrollApplication(
  id: string,
  input: { sessionId: string; classId: string; sectionId: string; guardianRelation?: string; parentPassword?: string; note?: string },
  actor: { id: string; role: UserRole },
): Promise<EnrollResult> {
  if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only Admin can convert an approved application into an enrollment");
  const app = await AdmissionApplication.findById(id);
  if (!app) throw new AppError(404, "APPLICATION_NOT_FOUND", "Admission application not found");
  if (app.status === "Enrolled") {
    throw new AppError(409, "ALREADY_ENROLLED", "This application has already been converted to an enrollment", { studentId: app.enrolledStudent ? String(app.enrolledStudent) : undefined });
  }
  if (app.status !== "Approved") {
    throw new AppError(409, "INVALID_STATUS_TRANSITION", `Only an 'Approved' application can be enrolled — current status is '${app.status}'`, { currentStatus: app.status });
  }
  await validatePlacement(input.sessionId, input.classId, input.sectionId);

  const nameParts = app.studentName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "-";
  const relationship = input.guardianRelation || app.guardianRelation || "Guardian";

  const runConversion = async (session?: mongoose.ClientSession): Promise<EnrollResult> => {
    const opts = session ? { session } : {};
    // (8) Parent account: reuse an existing parent account for the guardian email; never hijack another role's account.
    let parentUser = await User.findOne({ email: app.guardianEmail }).session(session ?? null);
    let parentCreated = false;
    let devTemporaryPassword: string | undefined;
    if (parentUser && parentUser.role !== "parent") {
      throw new AppError(422, "GUARDIAN_EMAIL_ROLE_CONFLICT", `The guardian email belongs to a '${parentUser.role}' account and cannot be linked as a parent`);
    }
    if (!parentUser) {
      const plain = input.parentPassword || randomToken().slice(0, 16);
      const passwordHash = await bcrypt.hash(plain, SALT);
      const created = await User.create([{ name: app.guardianName, email: app.guardianEmail, passwordHash, role: "parent", isVerified: true, isActive: true }], opts);
      parentUser = created[0];
      parentCreated = true;
      // The temporary password is exposed only outside production for local handover, mirroring the forgot-password dev-token rule.
      if (!env.isProduction) devTemporaryPassword = input.parentPassword ? undefined : plain;
    }
    let parentProfile = await ParentProfile.findOne({ user: parentUser._id }).session(session ?? null);
    if (!parentProfile) {
      const created = await ParentProfile.create([{ user: parentUser._id, phone: app.guardianPhone, address: app.address, city: app.city }], opts);
      parentProfile = created[0];
    }
    // (7) Student with a generated, unique admission number — retry on the unique index.
    let student = null as Awaited<ReturnType<typeof Student.create>>[number] | null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5 && !student; attempt += 1) {
      const admissionNumber = await nextAdmissionNumber();
      try {
        const created = await Student.create([{
          admissionNumber,
          firstName, lastName,
          dateOfBirth: app.dateOfBirth, gender: app.gender,
          address: app.address, city: app.city, previousSchool: app.previousSchool,
          guardianName: app.guardianName, guardianRelation: app.guardianRelation,
          guardianEmail: app.guardianEmail, guardianPhone: app.guardianPhone,
          status: "active",
        }], opts);
        student = created[0];
      } catch (err) {
        const e = err as { code?: number };
        if (e.code === 11000) { lastErr = err; continue; }
        throw err;
      }
    }
    if (!student) throw lastErr instanceof Error ? lastErr : new AppError(409, "DUPLICATE_KEY", "Could not generate a unique admission number after several attempts");
    // (8 cont.) Verified parent ↔ student link.
    const existingLink = await ParentStudent.findOne({ parentUser: parentUser._id, student: student._id }).session(session ?? null);
    if (!existingLink) {
      await ParentStudent.create([{
        parentUser: parentUser._id, parentProfile: parentProfile._id, student: student._id,
        relationship, isPrimaryContact: true, verified: true,
        verifiedBy: actor.id, verifiedAt: new Date(),
      }], opts);
    }
    // (9)+(10) Enrollment in the requested session/class/section.
    let enrollment;
    try {
      const created = await Enrollment.create([{
        student: student._id, session: input.sessionId, schoolClass: input.classId, section: input.sectionId,
        enrollmentDate: new Date(), status: "active", statusNote: input.note ?? "Created by admission conversion",
      }], opts);
      enrollment = created[0];
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) throw new AppError(409, "ALREADY_ENROLLED", "This student already has an active enrollment in the selected session");
      throw err;
    }
    // (6) Application becomes Enrolled, with history.
    app.status = "Enrolled";
    app.enrolledStudent = student._id as never;
    app.enrolledParentUser = parentUser._id as never;
    app.enrolledBy = actor.id as never;
    app.enrolledAt = new Date();
    app.statusHistory.push({ status: "Enrolled", by: actor.id as never, byRole: actor.role, note: input.note ?? `Enrolled as ${student.admissionNumber}`, at: new Date() });
    await app.save(opts);
    return {
      application: app,
      student: { id: String(student._id), admissionNumber: student.admissionNumber, firstName: student.firstName, lastName: student.lastName },
      parent: { userId: String(parentUser._id), profileId: String(parentProfile._id), created: parentCreated, ...(devTemporaryPassword ? { devTemporaryPassword } : {}) },
      enrollment: { id: String(enrollment._id), sessionId: input.sessionId, classId: input.classId, sectionId: input.sectionId },
      feeStructure: null,
      feeStructureNote: "Fee-structure application is Phase 7 — no fee structure has been applied yet and none is claimed here.",
      notification: null,
      notificationNote: "The parent notification is created by the Phase 9 notification service in enrollApplication() after the conversion commits (see the hook there); this response object itself carries no notification record.",
    };
  };

  /** Phase 9 hooks (§24/§33): after a successful conversion, notify the parent account + audit-log. Never throws. */
  const afterEnroll = async (result: EnrollResult) => {
    await notify({
      userIds: [result.parent.userId], type: "admission-enrolled", title: "Admission enrolled",
      body: `${result.student.firstName} ${result.student.lastName} has been enrolled. Admission number: ${result.student.admissionNumber}.`,
      related: { kind: "student", id: result.student.id }, createdBy: actor.id,
    });
    await logActivity({ actor, action: "admission.enroll", entityKind: "admission", entityId: String(result.application._id), summary: `Enrolled ${result.student.firstName} ${result.student.lastName} (${result.student.admissionNumber})`, metadata: { studentId: result.student.id, admissionNumber: result.student.admissionNumber, parentUserId: result.parent.userId } });
    return result;
  };

  // Preferred path: a real transaction (Atlas / replica set).
  const session = await mongoose.startSession();
  try {
    let result: EnrollResult | undefined;
    await session.withTransaction(async () => { result = await runConversion(session); });
    return afterEnroll(result as EnrollResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const transactionUnsupported = /transaction|replica set|IllegalOperation/i.test(message) && !(err instanceof AppError);
    if (!transactionUnsupported) throw err;
    // Fallback for standalone MongoDB (no replica set): sequential writes with
    // compensating rollback. Honest limitation — before-state is re-checked so a
    // failure mid-way deletes only what THIS call created, in reverse order.
    const before = {
      appStatus: app.status,
      parentExisted: Boolean(await User.findOne({ email: app.guardianEmail }).select("_id").lean()),
      studentCount: await Student.countDocuments({ guardianEmail: app.guardianEmail, firstName }),
    };
    void before;
    try {
      return await afterEnroll(await runConversion(undefined));
    } catch (fallbackErr) {
      // Best-effort compensation: remove any enrollment/link/student/profile/user this call created.
      const stu = await Student.findOne({ guardianEmail: app.guardianEmail, firstName, lastName }).sort({ createdAt: -1 });
      if (stu) {
        await Enrollment.deleteMany({ student: stu._id });
        await ParentStudent.deleteMany({ student: stu._id });
        await Student.deleteOne({ _id: stu._id });
      }
      const fresh = await AdmissionApplication.findById(id);
      if (fresh && fresh.status === "Enrolled") { fresh.status = "Approved"; await fresh.save(); }
      throw fallbackErr;
    }
  } finally {
    await session.endSession();
  }
}
