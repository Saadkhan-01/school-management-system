
import mongoose, { Schema, type Document } from "mongoose";
/**
 * Certificates (§26) — Phase 8.
 * Reference format: CERT-<year>-<6-digit sequence> (e.g. CERT-2026-000007),
 * unique index is the real guard; creation retries on duplicate key (same
 * pattern as INV-/RCP- numbering). PUBLIC verification returns ONLY student
 * name, type, issue date and status — never DOB/contacts/fees.
 * Fee-clearance certificates are gated in the service on the student's real
 * Phase 7 invoice balances (outstanding > 0 → 422 with the balance).
 */
export const CERTIFICATE_TYPES = ["character","bonafide","leaving","transfer","enrollment","fee-clearance","other"] as const;
export const CERTIFICATE_STATUSES = ["issued","revoked"] as const;
export interface ICertificate extends Document { student: mongoose.Types.ObjectId; type: (typeof CERTIFICATE_TYPES)[number]; referenceNumber: string; issueDate: Date; issuedBy: mongoose.Types.ObjectId; status: (typeof CERTIFICATE_STATUSES)[number]; revokeReason?: string; revokedBy?: mongoose.Types.ObjectId; revokedAt?: Date; notes?: string; createdAt: Date; updatedAt: Date }
const s = new Schema<ICertificate>({ student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true }, type: { type: String, enum: CERTIFICATE_TYPES, required: true, index: true }, referenceNumber: { type: String, required: true, unique: true, index: true }, issueDate: { type: Date, required: true, default: Date.now }, issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, status: { type: String, enum: CERTIFICATE_STATUSES, default: "issued", index: true }, revokeReason: { type: String, trim: true, maxlength: 500 }, revokedBy: { type: Schema.Types.ObjectId, ref: "User" }, revokedAt: { type: Date }, notes: { type: String, trim: true, maxlength: 500 } }, { timestamps: true });
export const Certificate = (mongoose.models.Certificate as mongoose.Model<ICertificate>) || mongoose.model<ICertificate>("Certificate", s);
export const CERT_REFERENCE_RX = /^CERT-\d{4}-\d{6}$/;
