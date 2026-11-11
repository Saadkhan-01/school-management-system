import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { adminResetPasswordSchema, userCreateSchema, userStatusSchema, userUpdateSchema } from "./user.validation";
import * as svc from "./user.service";
import { logActivity } from "../audit/audit.service";

/** User Management (§7) — Admin only; docs/permissions.md gives every other role ○ for user/role management. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.post("/", authenticate, authorize("admin"), validate(userCreateSchema), requireDb, wrap(async (req, res) => {
  const user = await svc.createUser(req.body);
  res.status(201).json({ success: true, data: { user } });
}));
r.get("/", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  const out = await svc.listUsers(req.query as Record<string, unknown>);
  res.json({ success: true, data: { users: out.items }, meta: out.meta });
}));
r.get("/:id/login-history", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  const out = await svc.getLoginHistory(req.params.id, req.query as Record<string, unknown>);
  res.json({ success: true, data: { user: out.user, loginHistory: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { user: await svc.getUser(req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(userUpdateSchema), requireDb, wrap(async (req, res) => {
  const user = await svc.updateUser(req.params.id, req.body);
  // Phase 9 audit (§33): role/status-relevant user changes are logged (never the password, never tokens).
  if (req.body.role) await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: "user.role-change", entityKind: "user", entityId: req.params.id, summary: `Changed a user's role to "${String(req.body.role)}"`, metadata: { newRole: String(req.body.role) }, ip: req.ip });
  res.json({ success: true, data: { user } });
}));
r.patch("/:id/status", authenticate, authorize("admin"), validate(userStatusSchema), requireDb, wrap(async (req, res) => {
  const user = await svc.setUserActive(req.params.id, req.body.isActive, req.user!.id);
  await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: req.body.isActive ? "user.activate" : "user.deactivate", entityKind: "user", entityId: req.params.id, summary: `${req.body.isActive ? "Activated" : "Deactivated"} a user account`, metadata: { isActive: Boolean(req.body.isActive) }, ip: req.ip });
  res.json({ success: true, data: { user } });
}));
r.post("/:id/reset-password", authenticate, authorize("admin"), validate(adminResetPasswordSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.adminResetPassword(req.params.id, req.body.newPassword) });
}));
r.delete("/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteUser(req.params.id, req.user!.id) });
}));

export default r;
