import { z } from "zod";
import { LEAVE_TYPES } from "./leave.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

export const leaveCreateSchema = z.object({
  studentId: objectId.optional(), // required for parents (child leave); forbidden for staff self-leave
  leaveType: z.enum(LEAVE_TYPES),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(2000),
}).refine((v) => v.toDate.getTime() >= v.fromDate.getTime(), { message: "toDate must be on or after fromDate" });

export const leaveDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decisionNote: z.string().trim().max(1000).optional(),
});
