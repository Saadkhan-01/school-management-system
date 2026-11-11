# Messaging (§24) — Phase 9

Conversation + Message models with participant-only access enforced in the
service (a non-participant reading by id gets 403 — conversations never leak
by URL guessing).

Allowed creation pairs (else 403 `CONVERSATION_NOT_ALLOWED`):
- Parent ↔ Teacher of a verified-linked child (validated via TeacherAssignment
  + active Enrollment + verified ParentStudent links; optional `studentId`
  context narrows the check to that child);
- Parent ↔ Admin/Receptionist (school office);
- Staff ↔ Staff (any two staff-role users).
Students cannot use messaging.

Endpoints: GET /contacts (allowed directory for the caller), POST
/conversations (find-or-create), GET /conversations (own, with unread
counts), GET/POST /conversations/:id/messages (participants only),
PATCH /conversations/:id/read. Sending a message creates a `message`
notification for the other participants via the notification service.
