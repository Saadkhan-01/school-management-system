import mongoose, { Schema, type Document } from "mongoose";

/**
 * Academic structure models (§17, §29 Academics). All in one file because they are
 * small, tightly referenced, and always used together:
 * AcademicSession → SchoolClass → Section, Subject, Classroom,
 * TeacherAssignment, GradingScale.
 * Uniqueness rules from docs/database-design.md are enforced with compound
 * unique indexes; service-layer checks produce friendly 409s before insert.
 */

export interface IAcademicSession extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const sessionSchema = new Schema<IAcademicSession>({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false, index: true },
}, { timestamps: true });
export const AcademicSession = (mongoose.models.AcademicSession as mongoose.Model<IAcademicSession>) || mongoose.model<IAcademicSession>("AcademicSession", sessionSchema);

export interface ISchoolClass extends Document {
  name: string;
  session: mongoose.Types.ObjectId;
  level?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
const classSchema = new Schema<ISchoolClass>({
  name: { type: String, required: true, trim: true, maxlength: 60, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  level: { type: Number, min: 0, max: 20 },
  description: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });
classSchema.index({ name: 1, session: 1 }, { unique: true });
export const SchoolClass = (mongoose.models.SchoolClass as mongoose.Model<ISchoolClass>) || mongoose.model<ISchoolClass>("SchoolClass", classSchema);

export interface ISection extends Document {
  schoolClass: mongoose.Types.ObjectId;
  name: string;
  capacity?: number;
  classTeacher?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const sectionSchema = new Schema<ISection>({
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  capacity: { type: Number, min: 1, max: 500 },
  classTeacher: { type: Schema.Types.ObjectId, ref: "TeacherProfile" },
}, { timestamps: true });
sectionSchema.index({ schoolClass: 1, name: 1 }, { unique: true });
export const Section = (mongoose.models.Section as mongoose.Model<ISection>) || mongoose.model<ISection>("Section", sectionSchema);

export interface ISubject extends Document {
  name: string;
  code: string;
  session: mongoose.Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
const subjectSchema = new Schema<ISubject>({
  name: { type: String, required: true, trim: true, maxlength: 120, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  description: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });
subjectSchema.index({ code: 1, session: 1 }, { unique: true });
export const Subject = (mongoose.models.Subject as mongoose.Model<ISubject>) || mongoose.model<ISubject>("Subject", subjectSchema);

export interface IClassroom extends Document {
  name: string;
  capacity?: number;
  location?: string;
  facilities?: string;
  createdAt: Date;
  updatedAt: Date;
}
const classroomSchema = new Schema<IClassroom>({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80, index: true },
  capacity: { type: Number, min: 1, max: 1000 },
  location: { type: String, trim: true, maxlength: 200 },
  facilities: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });
export const Classroom = (mongoose.models.Classroom as mongoose.Model<IClassroom>) || mongoose.model<IClassroom>("Classroom", classroomSchema);

export interface ITeacherAssignment extends Document {
  teacher: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const teacherAssignmentSchema = new Schema<ITeacherAssignment>({
  teacher: { type: Schema.Types.ObjectId, ref: "TeacherProfile", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
}, { timestamps: true });
teacherAssignmentSchema.index({ teacher: 1, schoolClass: 1, section: 1, subject: 1, session: 1 }, { unique: true });
export const TeacherAssignment = (mongoose.models.TeacherAssignment as mongoose.Model<ITeacherAssignment>) || mongoose.model<ITeacherAssignment>("TeacherAssignment", teacherAssignmentSchema);

export interface GradeRange { min: number; max: number; grade: string; points?: number; remark?: string }
export interface IGradingScale extends Document {
  name: string;
  session?: mongoose.Types.ObjectId;
  ranges: GradeRange[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const rangeSchema = new Schema<GradeRange>({
  min: { type: Number, required: true, min: 0, max: 100 },
  max: { type: Number, required: true, min: 0, max: 100 },
  grade: { type: String, required: true, trim: true, maxlength: 10 },
  points: { type: Number, min: 0, max: 10 },
  remark: { type: String, trim: true, maxlength: 120 },
}, { _id: false });
const gradingScaleSchema = new Schema<IGradingScale>({
  name: { type: String, required: true, trim: true, maxlength: 120, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", index: true },
  ranges: {
    type: [rangeSchema], required: true,
    validate: { validator: (v: GradeRange[]) => v.length > 0 && v.every((r) => r.min <= r.max), message: "Each grade range must have min <= max and at least one range is required" },
  },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });
export const GradingScale = (mongoose.models.GradingScale as mongoose.Model<IGradingScale>) || mongoose.model<IGradingScale>("GradingScale", gradingScaleSchema);
