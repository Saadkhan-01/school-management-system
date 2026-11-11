# Settings module (Phase 2 — implemented)

`settings.routes.ts` exposes school settings as a focused view over the WebsiteContent singleton (single source of truth for school identity): `GET /public` (published identity/contact), `GET /` and `PUT /` (Admin only). Full system settings (policies, session defaults, audit configuration) extend this module in later phases.
