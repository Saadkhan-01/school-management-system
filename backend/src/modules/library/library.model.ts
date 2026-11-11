
import mongoose, { Schema, type Document } from "mongoose";
/**
 * Library (§14, §29) — Phase 8.
 * FINE POLICY (school policy constants, documented): loan period
 * LIBRARY_LOAN_DAYS = 14 days; overdue fine LIBRARY_FINE_PER_DAY_MINOR = 500
 * minor units (5.00) per overdue day, integer minor units (Phase 7 money
 * convention). Fine is computed in the service on return from
 * (returnDate - dueDate) whole days; never negative, never silently dropped:
 * it is stored on the BookIssue with fineStatus unpaid|paid|waived.
 * Each physical copy is its own BookCopy row; BookIssue.copy has a unique
 * PARTIAL index on open issues (returnDate unset) so a copy can never be
 * issued twice concurrently — the service also pre-checks copy status (409).
 */
export const LIBRARY_LOAN_DAYS = 14;
export const LIBRARY_FINE_PER_DAY_MINOR = 500;
export const COPY_STATUSES = ["available","issued","lost","archived"] as const;
export const FINE_STATUSES = ["none","unpaid","paid","waived"] as const;

export interface IBookCategory extends Document { name: string; description?: string; createdAt: Date; updatedAt: Date }
const catSchema = new Schema<IBookCategory>({ name: { type: String, required: true, trim: true, maxlength: 120, unique: true }, description: { type: String, trim: true, maxlength: 500 } }, { timestamps: true });
export const BookCategory = (mongoose.models.BookCategory as mongoose.Model<IBookCategory>) || mongoose.model<IBookCategory>("BookCategory", catSchema);

export interface IBook extends Document { title: string; author: string; isbn?: string; category: mongoose.Types.ObjectId; publisher?: string; publicationYear?: number; createdAt: Date; updatedAt: Date }
const bookSchema = new Schema<IBook>({ title: { type: String, required: true, trim: true, maxlength: 200, index: true }, author: { type: String, required: true, trim: true, maxlength: 160, index: true }, isbn: { type: String, trim: true, maxlength: 20, index: true }, category: { type: Schema.Types.ObjectId, ref: "BookCategory", required: true, index: true }, publisher: { type: String, trim: true, maxlength: 160 }, publicationYear: { type: Number, min: 1000, max: 2100 } }, { timestamps: true });
export const Book = (mongoose.models.Book as mongoose.Model<IBook>) || mongoose.model<IBook>("Book", bookSchema);

export interface IBookCopy extends Document { book: mongoose.Types.ObjectId; copyCode: string; status: (typeof COPY_STATUSES)[number]; createdAt: Date; updatedAt: Date }
const copySchema = new Schema<IBookCopy>({ book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true }, copyCode: { type: String, required: true, trim: true, maxlength: 60, unique: true }, status: { type: String, enum: COPY_STATUSES, default: "available", index: true } }, { timestamps: true });
export const BookCopy = (mongoose.models.BookCopy as mongoose.Model<IBookCopy>) || mongoose.model<IBookCopy>("BookCopy", copySchema);

export interface IBookIssue extends Document { copy: mongoose.Types.ObjectId; book: mongoose.Types.ObjectId; borrowerStudent: mongoose.Types.ObjectId; issuedBy: mongoose.Types.ObjectId; issueDate: Date; dueDate: Date; returnDate?: Date; fineAmount: number; fineStatus: (typeof FINE_STATUSES)[number]; createdAt: Date; updatedAt: Date }
const issueSchema = new Schema<IBookIssue>({ copy: { type: Schema.Types.ObjectId, ref: "BookCopy", required: true, index: true }, book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true }, borrowerStudent: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true }, issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, issueDate: { type: Date, required: true }, dueDate: { type: Date, required: true }, returnDate: { type: Date }, fineAmount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "Fine must be integer minor units" } }, fineStatus: { type: String, enum: FINE_STATUSES, default: "none" } }, { timestamps: true });
issueSchema.index({ copy: 1 }, { unique: true, partialFilterExpression: { returnDate: { $exists: false } }, name: "one_open_issue_per_copy" });
export const BookIssue = (mongoose.models.BookIssue as mongoose.Model<IBookIssue>) || mongoose.model<IBookIssue>("BookIssue", issueSchema);

export function computeFineMinor(dueDate: Date, returnDate: Date): number {
  const ms = returnDate.getTime() - dueDate.getTime();
  if (ms <= 0) return 0;
  const days = Math.floor(ms / 86_400_000);
  return days * LIBRARY_FINE_PER_DAY_MINOR;
}
