import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

export const enrollSchema = z.object({
  studentId: objectId,
  sessionId: objectId,
  classId: objectId,
  sectionId: objectId,
  enrollmentDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const transferSchema = z.object({
  classId: objectId,
  sectionId: objectId,
  notes: z.string().trim().max(1000).optional(),
});

export const withdrawSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const promoteSchema = z.object({
  toSessionId: objectId,
  toClassId: objectId,
  toSectionId: objectId,
  notes: z.string().trim().max(1000).optional(),
});
