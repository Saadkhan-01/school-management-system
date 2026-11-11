
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.jwtAccessSecret, { expiresIn: env.accessExpiresIn as jwt.SignOptions["expiresIn"] });
}
export function signRefreshToken(userId: string): string {
  // jti: every issued refresh token MUST be unique. Without it, two tokens
  // signed for the same user within the same second are byte-identical
  // (JWT iat has 1-second resolution), which silently defeats refresh-token
  // rotation — the "old" token would still match the stored hash.
  // (Found by the Phase 10 §36 auth integration tests.)
  return jwt.sign({ sub: userId, type: "refresh" }, env.jwtRefreshSecret, { expiresIn: `${env.refreshExpiresDays}d` as jwt.SignOptions["expiresIn"], jwtid: crypto.randomUUID() });
}
export function verifyRefreshToken(token: string): { sub: string } {
  const p = jwt.verify(token, env.jwtRefreshSecret) as jwt.JwtPayload;
  if (!p.sub || (p as { type?: string }).type !== "refresh") throw new Error("Invalid refresh token");
  return { sub: String(p.sub) };
}
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const randomToken = () => crypto.randomBytes(32).toString("hex");
