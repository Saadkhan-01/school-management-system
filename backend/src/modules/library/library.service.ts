
import { AppError } from "../../utils/AppError";
import { escapeRegex, pageOptions } from "../website/website.service";
import { Book, BookCategory, BookCopy, BookIssue, LIBRARY_LOAN_DAYS, computeFineMinor, type IBookIssue } from "./library.model";
import { Student } from "../students/student.model";
import { ownStudent, parentLinkedStudentIds } from "../academic-scope";
import type { Actor } from "../academic-scope";

const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });

export async function createCategory(input: { name: string; description?: string }) {
  if (await BookCategory.findOne({ name: input.name }).lean()) throw new AppError(409, "CATEGORY_EXISTS", "A library category with this name already exists");
  return BookCategory.create(input);
}
export async function listCategories() { return BookCategory.find().sort({ name: 1 }).lean(); }
export async function updateCategory(id: string, input: Record<string, unknown>) {
  const doc = await BookCategory.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found"); return doc;
}
export async function createBook(input: { title: string; author: string; isbn?: string; categoryId: string; publisher?: string; publicationYear?: number }) {
  if (!(await BookCategory.findById(input.categoryId).lean())) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return Book.create({ title: input.title, author: input.author, isbn: input.isbn, category: input.categoryId, publisher: input.publisher, publicationYear: input.publicationYear });
}
export async function listBooks(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (typeof query.categoryId === "string") filter.category = query.categoryId;
  if (typeof query.search === "string" && query.search.trim()) { const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" }; filter.$or = [{ title: rx }, { author: rx }, { isbn: rx }]; }
  const [items, total] = await Promise.all([Book.find(filter).populate("category", "name").sort({ title: 1 }).skip((page - 1) * limit).limit(limit).lean(), Book.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
/** Catalogue for students/parents/teachers: availability counts ONLY — no borrower identities (§14). */
export async function catalogue(query: Record<string, unknown>) {
  const { items, meta: m } = await listBooks(query);
  const out = [];
  for (const b of items) {
    const copies = await BookCopy.find({ book: b._id }).select("status").lean();
    out.push({ book: b, totalCopies: copies.length, availableCopies: copies.filter((c) => c.status === "available").length });
  }
  return { items: out, meta: m };
}
export async function updateBook(id: string, input: Record<string, unknown>) {
  const patch: Record<string, unknown> = { ...input }; if (input.categoryId) { patch.category = input.categoryId; delete patch.categoryId; }
  const doc = await Book.findByIdAndUpdate(id, patch, { new: true }); if (!doc) throw new AppError(404, "BOOK_NOT_FOUND", "Book not found"); return doc;
}
export async function createCopy(input: { bookId: string; copyCode: string; status?: string }) {
  if (!(await Book.findById(input.bookId).lean())) throw new AppError(404, "BOOK_NOT_FOUND", "Book not found");
  if (await BookCopy.findOne({ copyCode: input.copyCode }).lean()) throw new AppError(409, "COPY_CODE_EXISTS", "A copy with this code already exists");
  return BookCopy.create({ book: input.bookId, copyCode: input.copyCode, status: input.status ?? "available" });
}
export async function listCopies(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (typeof query.status === "string") filter.status = query.status;
  if (typeof query.bookId === "string") filter.book = query.bookId;
  const [items, total] = await Promise.all([BookCopy.find(filter).populate("book", "title author").sort({ copyCode: 1 }).skip((page - 1) * limit).limit(limit).lean(), BookCopy.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function updateCopy(id: string, input: { status: string }) {
  const copy = await BookCopy.findById(id); if (!copy) throw new AppError(404, "COPY_NOT_FOUND", "Copy not found");
  if (copy.status === "issued") throw new AppError(409, "COPY_ISSUED", "An issued copy cannot change status until it is returned");
  copy.status = input.status as typeof copy.status; await copy.save(); return copy;
}
export async function issueBook(actor: Actor, input: { copyId: string; studentId: string; issueDate?: Date; dueDate?: Date }) {
  const copy = await BookCopy.findById(input.copyId); if (!copy) throw new AppError(404, "COPY_NOT_FOUND", "Copy not found");
  if (copy.status !== "available") throw new AppError(409, "COPY_NOT_AVAILABLE", `Copy is not available (status: ${copy.status})`);
  if (await BookIssue.findOne({ copy: copy._id, returnDate: { $exists: false } }).lean()) throw new AppError(409, "COPY_ALREADY_ISSUED", "This copy already has an open issue");
  if (!(await Student.findById(input.studentId).lean())) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  const issueDate = input.issueDate ?? new Date();
  const dueDate = input.dueDate ?? new Date(issueDate.getTime() + LIBRARY_LOAN_DAYS * 86_400_000);
  const issue = await BookIssue.create({ copy: copy._id, book: copy.book, borrowerStudent: input.studentId, issuedBy: actor.id, issueDate, dueDate, fineAmount: 0, fineStatus: "none" });
  copy.status = "issued"; await copy.save(); return issue;
}
export async function returnBook(input: { returnDate?: Date; fineStatus?: string }, issueId: string) {
  const issue = await BookIssue.findById(issueId); if (!issue) throw new AppError(404, "ISSUE_NOT_FOUND", "Issue record not found");
  if (issue.returnDate) throw new AppError(409, "ALREADY_RETURNED", "This copy has already been returned");
  const returnDate = input.returnDate ?? new Date();
  if (returnDate < issue.issueDate) throw new AppError(422, "RETURN_BEFORE_ISSUE", "Return date cannot be before the issue date");
  const fine = computeFineMinor(issue.dueDate, returnDate);
  issue.returnDate = returnDate; issue.fineAmount = fine; issue.fineStatus = fine > 0 ? (input.fineStatus as IBookIssue["fineStatus"]) ?? "unpaid" : "none";
  await issue.save();
  await BookCopy.findByIdAndUpdate(issue.copy, { status: "available" });
  return issue;
}
async function scopeStudentIds(actor: Actor, requested?: string): Promise<string[] | null> {
  if (actor.role === "admin" || actor.role === "librarian" || actor.role === "principal") return requested ? [requested] : null;
  if (actor.role === "student") { const self = await ownStudent(actor.id); if (!self) throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your account"); if (requested && requested !== String(self._id)) throw new AppError(403, "FORBIDDEN", "You can only view your own borrowing history"); return [String(self._id)]; }
  if (actor.role === "parent" || actor.role === "teacher") { const ids = actor.role === "parent" ? await parentLinkedStudentIds(actor.id) : []; if (actor.role === "teacher") throw new AppError(403, "FORBIDDEN", "Teachers view borrowing via the catalogue only"); if (requested && !ids.includes(requested)) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account"); return requested ? [requested] : ids; }
  throw new AppError(403, "FORBIDDEN", "Your role cannot access borrowing history");
}
export async function listIssues(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const ids = await scopeStudentIds(actor, typeof query.studentId === "string" ? query.studentId : undefined);
  const filter: Record<string, unknown> = {}; if (ids) filter.borrowerStudent = { $in: ids };
  if (query.overdue === "true") { filter.returnDate = { $exists: false }; filter.dueDate = { $lt: new Date() }; }
  const [items, total] = await Promise.all([BookIssue.find(filter).populate("book", "title author").populate("copy", "copyCode").populate("borrowerStudent", "firstName lastName admissionNumber").sort({ issueDate: -1 }).skip((page - 1) * limit).limit(limit).lean(), BookIssue.countDocuments(filter)]);
  // Students/parents must not see other borrowers: scope above already restricts rows to their own/linked students.
  return { items, meta: meta(page, limit, total) };
}
export async function reportSummary() {
  const now = new Date();
  const [totalBooks, totalCopies, available, issued, overdueCount, fines] = await Promise.all([
    Book.countDocuments(), BookCopy.countDocuments(), BookCopy.countDocuments({ status: "available" }), BookCopy.countDocuments({ status: "issued" }),
    BookIssue.countDocuments({ returnDate: { $exists: false }, dueDate: { $lt: now } }),
    BookIssue.aggregate([{ $group: { _id: "$fineStatus", total: { $sum: "$fineAmount" } } }]),
  ]);
  const fineTotals: Record<string, number> = {}; for (const f of fines) fineTotals[String(f._id)] = Number(f.total);
  return { totalBooks, totalCopies, availableCopies: available, issuedCopies: issued, overdueOpenIssues: overdueCount, fineTotalsMinor: fineTotals, loanDays: LIBRARY_LOAN_DAYS };
}
