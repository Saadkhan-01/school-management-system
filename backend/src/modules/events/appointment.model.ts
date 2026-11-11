import mongoose, { Schema, type Document } from "mongoose";

/**
 * Appointment (§15 receptionist appointment scheduling) — carried over from
 * Phase 8 into Phase 9 (it belongs with the ERP calendar work).
 * Booked by Receptionist/Admin for a visitor/parent to meet a staff member.
 * The service enforces a per-staff overlap rule: two `scheduled` appointments
 * for the same staff member may not overlap in time (409).
 */
export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "no-show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface IAppointment extends Document {
  visitorName: string;
  visitorPhone?: string;
  visitorEmail?: string;
  purpose: string;
  scheduledAt: Date;
  durationMinutes: number;
  staffToMeet: mongoose.Types.ObjectId;
  status: AppointmentStatus;
  note?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const appointmentSchema = new Schema<IAppointment>({
  visitorName: { type: String, required: true, trim: true, maxlength: 160, index: true },
  visitorPhone: { type: String, trim: true, maxlength: 40 },
  visitorEmail: { type: String, trim: true, maxlength: 160 },
  purpose: { type: String, required: true, trim: true, maxlength: 500 },
  scheduledAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, required: true, min: 5, max: 480, validate: { validator: Number.isInteger, message: "Duration must be a whole number of minutes" } },
  staffToMeet: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: "scheduled", index: true },
  note: { type: String, trim: true, maxlength: 1000 },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const Appointment = (mongoose.models.Appointment as mongoose.Model<IAppointment>) || mongoose.model<IAppointment>("Appointment", appointmentSchema);
