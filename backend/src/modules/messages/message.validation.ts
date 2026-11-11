import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

export const conversationCreateSchema = z.object({
  otherUserId: objectId,
  studentId: objectId.optional(),
});

export const messageSendSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
