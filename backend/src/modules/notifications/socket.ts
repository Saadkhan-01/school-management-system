import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import type { UserRole } from "../users/user.model";

/**
 * Socket.IO server (§35 real-time) — Phase 9.
 *
 * Auth design: the handshake carries the SAME JWT access token as the REST
 * API (`socket.handshake.auth.token`). The middleware verifies the signature
 * against JWT_ACCESS_SECRET ONLY — no database lookup — so socket auth works
 * (and is probeable) even while MongoDB is unavailable; a REST call after
 * connecting still enforces DB-backed state (isActive etc.) on every request.
 * Unauthenticated sockets are rejected in the handshake middleware, so they
 * never reach the connection handler.
 *
 * Every authenticated socket joins exactly one room: `user:<own id>`.
 * Emitters address users by room, so a client can never subscribe itself to
 * another user's stream (room membership is assigned server-side only).
 */
let io: Server | null = null;

export function attachSocket(server: HttpServer): Server {
  if (io) return io;
  io = new Server(server, { cors: { origin: env.corsOrigin, credentials: true } });
  io.use((socket: Socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? "";
    if (!token) return next(new Error("UNAUTHENTICATED: missing token"));
    try {
      const p = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload & { role?: UserRole };
      if (!p.sub || !p.role) return next(new Error("UNAUTHENTICATED: bad payload"));
      socket.data.user = { id: String(p.sub), role: p.role, email: String((p as { email?: string }).email ?? "") };
      return next();
    } catch {
      return next(new Error("UNAUTHENTICATED: invalid or expired token"));
    }
  });
  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string; role: UserRole };
    socket.join(`user:${user.id}`);
    socket.emit("connected", { userId: user.id, role: user.role });
    logger.debug(`[socket] connected user=${user.id} role=${user.role}`);
    socket.on("disconnect", () => logger.debug(`[socket] disconnected user=${user.id}`));
  });
  logger.info("[socket] Socket.IO attached (JWT handshake auth, per-user rooms)");
  return io;
}

export function getIo(): Server | null { return io; }

/** Emit to one user's room; a no-op when sockets are not attached (e.g. tests importing the app only). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}
