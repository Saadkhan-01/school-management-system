# Audit module (§33) — Phase 9

`ActivityLog` + the fail-safe `logActivity()` helper. Every writer goes through
the helper, which strips password/token/secret-shaped metadata keys and never
throws (a missing DB or a failed write is logged and ignored, so auditing can
never break a business operation).

Wired call sites (see docs/feature-tracker.md Phase 9 table for the full list):
user role change / activation toggle, invoice generate / bulk / cancel /
adjustment, payment verify / reject / reverse, marks bulk entry / correction,
attendance correction, enrollment enroll / transfer / withdraw / promote,
certificate issue / revoke, admission status decision / enrollment conversion.

Viewer: `GET /api/v1/reports/activity-logs` (Admin only — permissions matrix
gives audit logs to Admin ● and every other role ○).
