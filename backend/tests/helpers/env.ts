// Test environment — MUST be set before src/config/env.ts loads.
// mongodb-memory-server: if the library's own binary download cannot be used,
// set MONGOMS_SYSTEM_BINARY (see the Phase 10 note in docs/feature-tracker.md).
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-phase10";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-phase10";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
// Payments gateway stays UNCONFIGURED in tests — §36 expects checkout → 503.
delete process.env.PAYMENT_PROVIDER;
delete process.env.PAYMENT_GATEWAY_KEY;
delete process.env.PAYMENT_GATEWAY_SECRET;
delete process.env.PAYMENT_WEBHOOK_SECRET;
