
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const markSchema = z.object({ userId: objectId, date: z.coerce.date(), status: z.enum(["present","absent","late","on-leave"]), note: z.string().trim().max(300).optional() });
export const bulkMarkSchema = z.object({ date: z.coerce.date(), records: z.array(z.object({ userId: objectId, status: z.enum(["present","absent","late","on-leave"]), note: z.string().trim().max(300).optional() })).min(1).max(200) });
export const updateSchema = z.object({ status: z.enum(["present","absent","late","on-leave"]), note: z.string().trim().max(300).optional() }).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
