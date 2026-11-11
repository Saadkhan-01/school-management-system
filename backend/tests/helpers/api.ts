import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import app from "../../src/app";
import { env } from "../../src/config/env";

/** The REAL Express app (src/app.ts) — no mocks, no test-only routes. */
export const api = () => request(app as unknown as Express);

type Agent = ReturnType<typeof request.agent>;
/** A supertest agent that keeps the HttpOnly refresh cookie between calls. */
export const agent = (): Agent => request.agent(app as unknown as Express);

/**
 * A token signed with the TEST refresh secret that is already expired.
 * Used for the "expired session → 401" case (an expired ACCESS token is
 * rejected by the auth middleware the same way; the refresh path is the one
 * users hit when a session lapses).
 */
export function expiredRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, env.jwtRefreshSecret, { expiresIn: "-1h" });
}

/** An access token signed with the WRONG secret — must always 401. */
export function forgedAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, "not-the-real-secret", { expiresIn: "15m" });
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
