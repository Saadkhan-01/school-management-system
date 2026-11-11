import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import * as svc from "./notification.service";

/**
 * Notifications (§24) under /api/v1/notifications — Phase 9.
 * Every route is STRICTLY own-scope: the recipient is always the caller;
 * there is no way to list or mutate another user's notifications.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.get("/", authenticate, requireDb, wrap(async (req, res) => {
  const out = await svc.listNotifications(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { notifications: out.items, unread: out.unread }, meta: out.meta });
}));
r.get("/unread-count", authenticate, requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.unreadCount(actor(req)) });
}));
r.patch("/read-all", authenticate, requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.markAllRead(actor(req)) });
}));
r.patch("/:id/read", authenticate, requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { notification: await svc.markRead(actor(req), req.params.id) } });
}));

export default r;
