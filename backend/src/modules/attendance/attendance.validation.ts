import { z } from "zod";
import { ATTENDANCE_STATUSES } from "./attendance.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const day = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), { message: "Must be a valid date" });

export const bulkMarkSchema = z.object({
  classId: objectId,
  sectionId: objectId,
  sessionId: objectId,
  date: day,
  records: z.array(z.object({
    studentId: objectId,
    status: z.enum(ATTENDANCE_STATUSES),
    note: z.string().trim().max(500).optional(),
  })).min(1).max(200),
}).refine((v) => new Set(v.records.map((r) => r.studentId)).size === v.records.length, { message: "Duplicate student in records" });

export const correctionSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().trim().max(500).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const classQuerySchema = z.object({
  classId: objectId,
  sectionId: objectId,
  sessionId: objectId,
  date: day,
});

export const reportQuerySchema = z.object({
  sessionId: objectId,
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  studentId: objectId.optional(),
  from: day,
  to: day,
}).refine((v) => v.to.getTime() >= v.from.getTime(), { message: "to must be on or after from" });

export const rosterQuerySchema = z.object({
  classId: objectId,
  sectionId: objectId,
  sessionId: objectId,
});

export const leavesQuerySchema = z.object({
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  sessionId: objectId.optional(),
  date: day,
});
