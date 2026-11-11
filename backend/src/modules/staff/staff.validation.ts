import { z } from "zod";
import { EMPLOYMENT_STATUSES } from "./staff.model";

/** Roles that may hold a staff (HR) profile — students and parents never do. */
export const STAFF_ROLES = ["admin", "principal", "accountant", "librarian", "receptionist", "teacher"] as const;
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const staffCreateSchema = z.object({
  userId: objectId.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  employeeId: z.string().trim().min(2).max(40),
  department: z.string().trim().min(2).max(120),
  designation: z.string().trim().min(2).max(120),
  joiningDate: z.coerce.date().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  phone: optStr(40),
  address: optStr(500),
}).refine((v) => Boolean(v.userId) || Boolean(v.name && v.email && v.password), {
  message: "Provide either userId (existing staff account) or name + email + password (new account)",
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  employeeId: z.string().trim().min(2).max(40).optional(),
  department: z.string().trim().min(2).max(120).optional(),
  designation: z.string().trim().min(2).max(120).optional(),
  joiningDate: z.coerce.date().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  phone: optStr(40),
  address: optStr(500),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
