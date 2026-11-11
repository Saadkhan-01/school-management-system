import { z } from "zod";
import { WEEKDAYS } from "./timetable.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)");

const entryBase = z.object({
  sessionId: objectId,
  classId: objectId,
  sectionId: objectId,
  subjectId: objectId,
  teacherId: objectId,
  classroomId: objectId.optional(),
  weekday: z.enum(WEEKDAYS),
  periodNumber: z.number().int().min(1).max(20),
  startTime: time,
  endTime: time,
});

export const entryCreateSchema = entryBase.refine((v) => v.endTime > v.startTime, { message: "endTime must be after startTime" });

export const entryUpdateSchema = entryBase.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
