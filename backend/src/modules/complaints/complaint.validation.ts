
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const complaintCreateSchema = z.object({ studentId: objectId.optional(), category: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(3000), attachmentName: z.string().trim().max(200).optional() });
export const respondSchema = z.object({ message: z.string().trim().min(1).max(2000) });
export const statusSchema = z.object({ status: z.enum(["open","in-progress","resolved","closed"]), assignedTo: objectId.optional(), resolutionNote: z.string().trim().max(1000).optional() }).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const disciplineCreateSchema = z.object({ studentId: objectId, incidentDate: z.coerce.date(), category: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(3000), actionTaken: z.string().trim().min(2).max(1000) });
export const disciplineUpdateSchema = disciplineCreateSchema.partial().omit({ studentId: true }).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
