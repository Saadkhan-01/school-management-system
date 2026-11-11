
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const categoryCreateSchema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional() });
export const categoryUpdateSchema = categoryCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const bookCreateSchema = z.object({ title: z.string().trim().min(1).max(200), author: z.string().trim().min(1).max(160), isbn: z.string().trim().max(20).optional(), categoryId: objectId, publisher: z.string().trim().max(160).optional(), publicationYear: z.number().int().min(1000).max(2100).optional() });
export const bookUpdateSchema = bookCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const copyCreateSchema = z.object({ bookId: objectId, copyCode: z.string().trim().min(1).max(60), status: z.enum(["available","lost","archived"]).optional() });
export const copyUpdateSchema = z.object({ status: z.enum(["available","lost","archived"]) }).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const issueCreateSchema = z.object({ copyId: objectId, studentId: objectId, issueDate: z.coerce.date().optional(), dueDate: z.coerce.date().optional() }).refine((v) => !v.issueDate || !v.dueDate || v.dueDate > v.issueDate, { message: "dueDate must be after issueDate" });
export const returnSchema = z.object({ returnDate: z.coerce.date().optional(), fineStatus: z.enum(["unpaid","paid","waived"]).optional() });
export const listQuerySchema = z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(), search: z.string().trim().max(120).optional(), status: z.string().trim().max(40).optional(), categoryId: objectId.optional(), studentId: objectId.optional() }).passthrough();
