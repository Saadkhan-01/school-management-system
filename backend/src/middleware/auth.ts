
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import type { UserRole } from "../modules/users/user.model";
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new AppError(401, "UNAUTHENTICATED", "Missing or invalid Authorization header"));
  try {
    const p = jwt.verify(header.slice(7), env.jwtAccessSecret) as jwt.JwtPayload & { role?: UserRole };
    if (!p.sub || !p.role) throw new Error("bad payload");
    req.user = { id: String(p.sub), role: p.role, email: String((p as { email?: string }).email ?? "") };
    return next();
  } catch { return next(new AppError(401, "TOKEN_EXPIRED_OR_INVALID", "Session expired or invalid — please log in again")); }
}
/** Real backend RBAC: role check on every protected route. */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Authentication required"));
    if (roles.length && !roles.includes(req.user.role)) return next(new AppError(403, "FORBIDDEN", `Role '${req.user.role}' is not allowed to perform this action`));
    return next();
  };
}
/** Permission-key check backed by the static role->permission map (DB-backed roles/permissions collections extend this in Phase 3+). */
import { ROLE_PERMISSIONS } from "./permissions";
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Authentication required"));
    if (req.user.role === "admin") return next();
    if (!ROLE_PERMISSIONS[req.user.role]?.includes(permission)) return next(new AppError(403, "FORBIDDEN", `Missing permission: ${permission}`));
    return next();
  };
}
