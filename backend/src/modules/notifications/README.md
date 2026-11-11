# Notifications (§24/§35) — Phase 9

- `notification.model.ts` — persisted in-app notifications (offline users
  still see them; sockets are only a live accelerator, never the record).
- `notification.service.ts` — the central `notify()` (persist → Socket.IO emit
  → external-channel stubs). NEVER throws: a notification failure cannot fail
  the business operation. Recipient resolvers: `userIdsForStudents` (student
  logins + VERIFIED parents), `userIdsForClassSection`, `userIdsForExamClasses`.
- `socket.ts` — Socket.IO attached to the HTTP server in `server.ts`. JWT
  handshake auth verifies the access-token signature only (no DB lookup, so
  it works/probes without MongoDB); each socket joins only its own
  server-assigned room `user:<id>`.
- `channels.ts` — email/SMS/WhatsApp: interface + unconfigured no-op
  implementations behind env gates (SMTP_*/SMS_*/WHATSAPP_*). A send is never
  faked; no real provider adapter exists yet.
- REST: GET / (own, paginated, `?unread=true`), GET /unread-count,
  PATCH /:id/read (own only), PATCH /read-all.

Event hooks wired into existing flows are listed in docs/feature-tracker.md
(Phase 9) and docs/api-documentation.md.
