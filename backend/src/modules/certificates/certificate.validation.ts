
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const issueSchema = z.object({ studentId: objectId, type: z.enum(["character","bonafide","leaving","transfer","enrollment","fee-clearance","other"]), issueDate: z.coerce.date().optional(), notes: z.string().trim().max(500).optional() });
export const revokeSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const verifyParamsSchema = z.object({ reference: z.string().regex(/^CERT-\d{4}-\d{6}$/, "Reference must look like CERT-2026-000001") });
