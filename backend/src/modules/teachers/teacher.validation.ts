import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Create a teacher: existing teacher-role user (`userId`) or a new account (name+email+password). */
export const teacherCreateSchema = z.object({
  userId: objectId.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  password: z.string().min(8).max(200).optional(),
  employeeId: z.string().trim().min(2).max(40),
  qualification: optStr(200),
  specialization: optStr(200),
  subjectsNote: optStr(500),
  phone: optStr(40),
  address: optStr(500),
  joiningDate: z.coerce.date().optional(),
}).refine((v) => Boolean(v.userId) || Boolean(v.name && v.email && v.password), {
  message: "Provide either userId (existing teacher account) or name + email + password (new account)",
});

export const teacherUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  employeeId: z.string().trim().min(2).max(40).optional(),
  qualification: optStr(200),
  specialization: optStr(200),
  subjectsNote: optStr(500),
  phone: optStr(40),
  address: optStr(500),
  joiningDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
