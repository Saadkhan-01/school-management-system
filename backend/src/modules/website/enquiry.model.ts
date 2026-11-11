import mongoose, { Schema, type Document } from "mongoose";

/** Enquiry — a message submitted through the public Contact form (§5). Handled by Admin/Receptionist. */
export const ENQUIRY_STATUSES = ["new", "contacted", "resolved", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface IEnquiry extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: EnquiryStatus;
  source: string;
  internalNotes?: string;
  handledBy?: mongoose.Types.ObjectId;
  statusHistory: Array<{ status: EnquiryStatus; by?: mongoose.Types.ObjectId; note?: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema({
  status: { type: String, enum: ENQUIRY_STATUSES, required: true },
  by: { type: Schema.Types.ObjectId, ref: "User" },
  note: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const enquirySchema = new Schema<IEnquiry>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
  phone: { type: String, trim: true, maxlength: 40 },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ENQUIRY_STATUSES, default: "new", index: true },
  source: { type: String, default: "website-contact", maxlength: 60 },
  internalNotes: { type: String, trim: true, maxlength: 2000 },
  handledBy: { type: Schema.Types.ObjectId, ref: "User" },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true });

export const Enquiry = (mongoose.models.Enquiry as mongoose.Model<IEnquiry>) || mongoose.model<IEnquiry>("Enquiry", enquirySchema);
