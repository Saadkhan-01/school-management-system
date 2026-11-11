import mongoose, { Schema, type Document } from "mongoose";

/**
 * Enrollment (§17, §29 enrollments) — connects a student to session/class/section.
 * History is never overwritten: transfer, withdrawal and promotion close the
 * current record with a terminal status and (for transfer/promotion) create a new
 * record. ONE active enrollment per student per session is enforced two ways:
 *   1. a unique PARTIAL index on (student, session) where status = "active";
 *   2. a service-layer check that returns a friendly 409 before insert.
 */
export const ENROLLMENT_STATUSES = ["active", "transferred", "withdrawn", "promoted", "completed"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface IEnrollment extends Document {
  student: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  enrollmentDate: Date;
  status: EnrollmentStatus;
  statusNote?: string;
  previousEnrollment?: mongoose.Types.ObjectId;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>({
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  enrollmentDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ENROLLMENT_STATUSES, default: "active", index: true },
  statusNote: { type: String, trim: true, maxlength: 1000 },
  previousEnrollment: { type: Schema.Types.ObjectId, ref: "Enrollment" },
  closedAt: { type: Date },
}, { timestamps: true });
enrollmentSchema.index(
  { student: 1, session: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "one_active_enrollment_per_student_session" },
);

export const Enrollment = (mongoose.models.Enrollment as mongoose.Model<IEnrollment>) || mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
