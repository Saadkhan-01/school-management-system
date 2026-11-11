import { z } from "zod";
import { GENDERS, STUDENT_STATUSES } from "./student.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const studentCreateSchema = z.object({
  admissionNumber: z.string().trim().min(3).max(40).optional().or(z.literal("")),
  userId: objectId.optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.coerce.date().refine((d) => d.getTime() < Date.now(), { message: "Date of birth must be in the past" }),
  gender: z.enum(GENDERS),
  bloodGroup: optStr(10),
  photoUrl: optStr(1000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: optStr(40),
  address: optStr(500),
  city: optStr(120),
  guardianName: z.string().trim().min(2).max(120),
  guardianRelation: optStr(60),
  guardianEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  guardianPhone: z.string().trim().min(7).max(40),
  previousSchool: optStr(200),
  status: z.enum(STUDENT_STATUSES).optional(),
  notes: optStr(2000),
});

export const studentUpdateSchema = studentCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
