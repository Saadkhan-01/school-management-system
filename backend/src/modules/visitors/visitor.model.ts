
import mongoose, { Schema, type Document } from "mongoose";
/** Visitors (§15) — Phase 8. Recorded by Receptionist/Admin only; checkOutAt must not precede checkInAt (422 in service + validation). */
export interface IVisitor extends Document { name: string; phone: string; purpose: string; visitingWhom: string; checkInAt: Date; checkOutAt?: Date; recordedBy: mongoose.Types.ObjectId; note?: string; createdAt: Date; updatedAt: Date }
const s = new Schema<IVisitor>({ name: { type: String, required: true, trim: true, maxlength: 120, index: true }, phone: { type: String, required: true, trim: true, maxlength: 30 }, purpose: { type: String, required: true, trim: true, maxlength: 200 }, visitingWhom: { type: String, required: true, trim: true, maxlength: 120 }, checkInAt: { type: Date, required: true, default: Date.now }, checkOutAt: { type: Date }, recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, note: { type: String, trim: true, maxlength: 300 } }, { timestamps: true });
export const Visitor = (mongoose.models.Visitor as mongoose.Model<IVisitor>) || mongoose.model<IVisitor>("Visitor", s);
