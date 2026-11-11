
import type { Request } from "express";
import { AppError } from "../utils/AppError";
/**
 * Ownership-scope helpers — the anti-IDOR layer (§4).
 * Services MUST use these (or equivalent checks) so changing an ID in a URL never grants access.
 * - student: resource.studentUserId must equal req.user.id
 * - parent: resource must belong to a student verified-linked to the parent (checked against parentStudents in the service, Phase 6)
 * - teacher: resource class/subject must be in teacherAssignments for that teacher (service check, Phase 5)
 */
export function assertSelf(req: Request, ownerUserId: string, message = "You can only access your own records") {
  if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  if (req.user.role === "admin") return;
  if (req.user.id !== ownerUserId) throw new AppError(403, "FORBIDDEN", message);
}
export function scopeFilter(req: Request): Record<string, unknown> {
  if (!req.user || req.user.role === "admin" || req.user.role === "principal") return {};
  if (req.user.role === "student") return { studentUserId: req.user.id };
  if (req.user.role === "parent") return { parentUserId: req.user.id };
  if (req.user.role === "teacher") return { teacherUserId: req.user.id };
  return { __denyAll: true };
}
