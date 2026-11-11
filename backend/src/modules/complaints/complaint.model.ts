
import mongoose, { Schema, type Document } from "mongoose";
/**
 * Complaints + Discipline (§25) — Phase 8.
 * DISCIPLINE VISIBILITY DECISION (docs/permissions.md, followed exactly):
 * the matrix row "Discipline" is Admin ●, Principal ● and ○ for EVERY other
 * role — including Parent ○ and Student ○. Therefore NO parent/student/
 * teacher read of discipline records is implemented (403 at route level),
 * even as a summary. If the school later wants parent visibility, the matrix
 * must be changed first; the code follows the matrix, not the reverse.
 * Attachments are metadata only (file storage §34 not configured).
 */
export const COMPLAINT_STATUSES = ["open","in-progress","resolved","closed"] as const;
export interface ComplaintResponse { author: mongoose.Types.ObjectId; authorRole: string; message: string; at: Date }
export interface IComplaint extends Document { submittedBy: mongoose.Types.ObjectId; submittedByRole: string; student?: mongoose.Types.ObjectId; category: string; description: string; attachmentName?: string; assignedTo?: mongoose.Types.ObjectId; status: (typeof COMPLAINT_STATUSES)[number]; responses: ComplaintResponse[]; resolutionNote?: string; createdAt: Date; updatedAt: Date }
const respSchema = new Schema<ComplaintResponse>({ author: { type: Schema.Types.ObjectId, ref: "User", required: true }, authorRole: { type: String, required: true }, message: { type: String, required: true, maxlength: 2000 }, at: { type: Date, default: Date.now } }, { _id: false });
const s = new Schema<IComplaint>({ submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, submittedByRole: { type: String, required: true }, student: { type: Schema.Types.ObjectId, ref: "Student", index: true }, category: { type: String, required: true, trim: true, maxlength: 80, index: true }, description: { type: String, required: true, trim: true, maxlength: 3000 }, attachmentName: { type: String, trim: true, maxlength: 200 }, assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true }, status: { type: String, enum: COMPLAINT_STATUSES, default: "open", index: true }, responses: { type: [respSchema], default: [] }, resolutionNote: { type: String, trim: true, maxlength: 1000 } }, { timestamps: true });
export const Complaint = (mongoose.models.Complaint as mongoose.Model<IComplaint>) || mongoose.model<IComplaint>("Complaint", s);

export interface IDisciplineRecord extends Document { student: mongoose.Types.ObjectId; incidentDate: Date; category: string; description: string; actionTaken: string; recordedBy: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date }
const d = new Schema<IDisciplineRecord>({ student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true }, incidentDate: { type: Date, required: true }, category: { type: String, required: true, trim: true, maxlength: 80 }, description: { type: String, required: true, trim: true, maxlength: 3000 }, actionTaken: { type: String, required: true, trim: true, maxlength: 1000 }, recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
export const DisciplineRecord = (mongoose.models.DisciplineRecord as mongoose.Model<IDisciplineRecord>) || mongoose.model<IDisciplineRecord>("DisciplineRecord", d);
