import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { conversationCreateSchema, messageSendSchema } from "./message.validation";
import * as svc from "./message.service";

/**
 * Messaging (§24) under /api/v1/messages — Phase 9.
 * Students have no messaging access (route-level 403). Pair rules and
 * participant-only access are enforced in the service.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const ROLES = ["admin", "principal", "teacher", "parent", "accountant", "librarian", "receptionist"] as const;

r.get("/contacts", authenticate, authorize(...ROLES), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.listContacts(actor(req)) });
}));
r.post("/conversations", authenticate, authorize(...ROLES), validate(conversationCreateSchema), requireDb, wrap(async (req, res) => {
  const out = await svc.createConversation(actor(req), req.body);
  res.status(out.created ? 201 : 200).json({ success: true, data: out });
}));
r.get("/conversations", authenticate, authorize(...ROLES), requireDb, wrap(async (req, res) => {
  const out = await svc.listConversations(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { conversations: out.items }, meta: out.meta });
}));
r.get("/conversations/:id/messages", authenticate, authorize(...ROLES), requireDb, wrap(async (req, res) => {
  const out = await svc.listMessages(actor(req), req.params.id, req.query as Record<string, unknown>);
  res.json({ success: true, data: { messages: out.items }, meta: out.meta });
}));
r.post("/conversations/:id/messages", authenticate, authorize(...ROLES), validate(messageSendSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { message: await svc.sendMessage(actor(req), req.params.id, req.body.body) } });
}));
r.patch("/conversations/:id/read", authenticate, authorize(...ROLES), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.markConversationRead(actor(req), req.params.id) });
}));

export default r;
