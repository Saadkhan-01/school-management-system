import { z } from "zod";
import { EXAM_STATUSES } from "./exam.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)");

export const examCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.string().trim().min(2).max(80),
  sessionId: objectId,
  classIds: z.array(objectId).min(1).max(60),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(EXAM_STATUSES).optional(),
  gradingScaleId: objectId.optional(),
  allowPositions: z.boolean().optional(),
}).refine((v) => !v.startDate || !v.endDate || v.endDate.getTime() >= v.startDate.getTime(), { message: "endDate must be on or after startDate" });

export const examUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: z.string().trim().min(2).max(80).optional(),
  classIds: z.array(objectId).min(1).max(60).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(EXAM_STATUSES).optional(),
  gradingScaleId: objectId.optional(),
  allowPositions: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const scheduleCreateSchema = z.object({
  classId: objectId,
  sectionId: objectId.optional(),
  subjectId: objectId,
  date: z.coerce.date(),
  startTime: time.optional(),
  endTime: time.optional(),
  maxMarks: z.number().min(1).max(1000),
});

export const marksBulkSchema = z.object({
  examScheduleId: objectId,
  entries: z.array(z.object({
    studentId: objectId,
    obtainedMarks: z.number().min(0).max(1000),
  })).min(1).max(200),
});

export const markCorrectionSchema = z.object({
  obtainedMarks: z.number().min(0).max(1000),
  note: z.string().trim().max(500).optional(),
});
