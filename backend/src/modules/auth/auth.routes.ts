
import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { validate } from "../../middleware/validate";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { AppError } from "../../utils/AppError";
import { loginSchema, registerSchema, forgotSchema, resetSchema, changePasswordSchema, updateProfileSchema } from "./auth.validation";
import * as svc from "./auth.service";
const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts — try again later" } } });
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
function setRefreshCookie(res: Response, token: string) { res.cookie("refreshToken", token, { httpOnly: true, secure: env.cookieSecure, sameSite: env.isProduction ? "strict" : "lax", path: "/api/v1/auth", maxAge: env.refreshExpiresDays * 24 * 60 * 60 * 1000 }); }
function clearRefreshCookie(res: Response) { res.clearCookie("refreshToken", { httpOnly: true, secure: env.cookieSecure, sameSite: env.isProduction ? "strict" : "lax", path: "/api/v1/auth" }); }
r.post("/login", authLimiter, validate(loginSchema), requireDb, wrap(async (req, res) => { const { user, accessToken, refreshToken } = await svc.login(req.body.email, req.body.password, { ip: req.ip, userAgent: req.headers["user-agent"] }); setRefreshCookie(res, refreshToken); res.json({ success: true, data: { user, accessToken } }); }));
r.post("/register", requireDb, authenticate, authorize("admin"), validate(registerSchema), wrap(async (req, res) => { const user = await svc.registerUser(req.body); res.status(201).json({ success: true, data: { user } }); }));
r.post("/logout", authenticate, wrap(async (req, res) => { if (req.user) await svc.logout(req.user.id).catch(() => undefined); clearRefreshCookie(res); res.json({ success: true, data: { loggedOut: true } }); }));
r.post("/refresh", requireDb, wrap(async (req, res) => { const token = (req.cookies as Record<string, string> | undefined)?.refreshToken; if (!token) throw new AppError(401, "UNAUTHENTICATED", "No refresh session"); const { user, accessToken, refreshToken } = await svc.refresh(token); setRefreshCookie(res, refreshToken); res.json({ success: true, data: { user, accessToken } }); }));
r.post("/forgot-password", authLimiter, validate(forgotSchema), requireDb, wrap(async (req, res) => { const out = await svc.forgotPassword(req.body.email); res.json({ success: true, data: { message: "If this email exists, a reset link has been issued.", ...(out.resetToken ? { devResetToken: out.resetToken } : {}) } }); }));
r.post("/reset-password", authLimiter, validate(resetSchema), requireDb, wrap(async (req, res) => { await svc.resetPassword(req.body.token, req.body.newPassword); res.json({ success: true, data: { passwordReset: true } }); }));
r.post("/change-password", requireDb, authenticate, validate(changePasswordSchema), wrap(async (req, res) => { await svc.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword); clearRefreshCookie(res); res.json({ success: true, data: { passwordChanged: true } }); }));
r.get("/me", authenticate, requireDb, wrap(async (req, res) => { res.json({ success: true, data: { user: await svc.getMe(req.user!.id) } }); }));
/* Phase 6 (§6): self-service profile edit. Order authenticate → validate → requireDb so 401/422 are probeable without a database; the strict schema rejects role/email/isActive smuggling with 422. */
r.patch("/me/profile", authenticate, validate(updateProfileSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { user: await svc.updateMyProfile(req.user!.id, req.body) } }); }));
export default r;
