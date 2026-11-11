import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const sessionCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
}).refine((v) => v.endDate.getTime() > v.startDate.getTime(), { message: "endDate must be after startDate" });
export const sessionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const classCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sessionId: objectId,
  level: z.number().int().min(0).max(20).optional(),
  description: optStr(500),
});
export const classUpdateSchema = classCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const sectionCreateSchema = z.object({
  classId: objectId,
  name: z.string().trim().min(1).max(40),
  capacity: z.number().int().min(1).max(500).optional(),
  classTeacherId: objectId.optional(),
});
export const sectionUpdateSchema = sectionCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(30),
  sessionId: objectId,
  description: optStr(500),
});
export const subjectUpdateSchema = subjectCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const classroomCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(1000).optional(),
  location: optStr(200),
  facilities: optStr(500),
});
export const classroomUpdateSchema = classroomCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const teacherAssignmentCreateSchema = z.object({
  teacherId: objectId,
  classId: objectId,
  sectionId: objectId,
  subjectId: objectId,
  sessionId: objectId,
});

const gradeRange = z.object({
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  grade: z.string().trim().min(1).max(10),
  points: z.number().min(0).max(10).optional(),
  remark: optStr(120),
}).refine((r) => r.min <= r.max, { message: "Range min must be <= max" });

export const gradingScaleCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sessionId: objectId.optional(),
  ranges: z.array(gradeRange).min(1).max(30),
  isDefault: z.boolean().optional(),
});
export const gradingScaleUpdateSchema = gradingScaleCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
