import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, clearTestDb, stopTestDb } from "../helpers/testDb";
import { api, agent, bearer, expiredRefreshToken, forgedAccessToken } from "../helpers/api";
import { seedUser, loginAs, PASSWORD } from "../helpers/seed";
import { User } from "../../src/modules/users/user.model";

/**
 * §36 — Authentication suite against the REAL app + REAL (in-memory) MongoDB.
 * Covers: valid login, invalid login, logout, refresh-token rotation,
 * expired/invalid token 401, deactivated account blocked, admin-only register.
 */
describe("§36 Auth", () => {
  beforeAll(async () => { await startTestDb(); });
  afterAll(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearTestDb(); });

  it("valid login returns a token, the user, and sets the HttpOnly refresh cookie", async () => {
    const u = await seedUser("admin");
    const res = await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(u.email);
    expect(res.body.data.user.role).toBe("admin");
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies?.join(" ")).toMatch(/refreshToken=/);
    expect(cookies?.join(" ")).toMatch(/HttpOnly/i);
  });

  it("invalid password → 401 INVALID_CREDENTIALS; unknown email → 401", async () => {
    const u = await seedUser("teacher");
    const bad = await api().post("/api/v1/auth/login").send({ email: u.email, password: "WrongPass#1" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    const ghost = await api().post("/api/v1/auth/login").send({ email: "nobody@test.local", password: PASSWORD });
    expect(ghost.status).toBe(401);
  });

  it("malformed login body → 422", async () => {
    const res = await api().post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deactivated account login is blocked with 403 ACCOUNT_INACTIVE", async () => {
    const u = await seedUser("teacher", { isActive: false });
    const res = await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("missing token → 401; forged token → 401; expired refresh token → 401", async () => {
    const u = await seedUser("admin");
    const noTok = await api().get("/api/v1/auth/me");
    expect(noTok.status).toBe(401);
    const forged = await api().get("/api/v1/auth/me").set(bearer(forgedAccessToken(u.id, "admin")));
    expect(forged.status).toBe(401);
    const ag = agent();
    const expired = await ag.post("/api/v1/auth/refresh").set("Cookie", [`refreshToken=${expiredRefreshToken(u.id)}`]);
    expect(expired.status).toBe(401);
  });

  it("refresh ROTATES the refresh token: old cookie is rejected after one use, new one works", async () => {
    const u = await seedUser("admin");
    const ag = agent();
    const login = await ag.post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD });
    expect(login.status).toBe(200);
    const oldCookie = (login.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("refreshToken="))!;
    const oldToken = oldCookie.split(";")[0].split("=")[1];

    const r1 = await ag.post("/api/v1/auth/refresh");
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeTruthy();
    const newCookie = (r1.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("refreshToken="));
    expect(newCookie).toBeTruthy();
    expect(newCookie!.split(";")[0].split("=")[1]).not.toBe(oldToken);

    // Replaying the OLD refresh token must fail (rotation) — reuse detection.
    const replay = await api().post("/api/v1/auth/refresh").set("Cookie", [`refreshToken=${oldToken}`]);
    expect(replay.status).toBe(401);
  });

  it("logout revokes the session: refresh after logout → 401", async () => {
    const u = await seedUser("admin");
    const { agent: ag, token } = await loginAs(u.email);
    const out = await ag.post("/api/v1/auth/logout").set(bearer(token));
    expect(out.status).toBe(200);
    const refresh = await ag.post("/api/v1/auth/refresh");
    expect(refresh.status).toBe(401);
  });

  it("register is Admin-only: non-admin → 403, anonymous → 401, admin → 201", async () => {
    const admin = await seedUser("admin");
    const teacher = await seedUser("teacher");
    const { token: aTok } = await loginAs(admin.email);
    const { token: tTok } = await loginAs(teacher.email);
    const body = { name: "New Person", email: "new.person@test.local", password: "NewPass#123", role: "librarian" };
    const anon = await api().post("/api/v1/auth/register").send(body);
    expect(anon.status).toBe(401);
    const asTeacher = await api().post("/api/v1/auth/register").set(bearer(tTok)).send(body);
    expect(asTeacher.status).toBe(403);
    const asAdmin = await api().post("/api/v1/auth/register").set(bearer(aTok)).send(body);
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.user.role).toBe("librarian");
    const dupe = await api().post("/api/v1/auth/register").set(bearer(aTok)).send(body);
    expect(dupe.status).toBe(409);
  });

  it("deactivating an account mid-session blocks further logins but the stored hash exists", async () => {
    const u = await seedUser("parent");
    const ok = await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    await User.updateOne({ _id: u.id }, { $set: { isActive: false } });
    const blocked = await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD });
    expect(blocked.status).toBe(403);
  });
});
