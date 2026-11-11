# Events & Appointments (§23 calendar, §15 appointments) — Phase 9

- `event.*` — internal ERP `CalendarEvent` calendar (holiday / exam /
  parent-meeting / event / announcement) with role audiences. Lists are
  audience-sliced in the service (Admin/Principal see all). Creating an
  `announcement` event notifies its audience via the notification service.
  Separate from the Phase 2 public website items — nothing here is public.
- `appointment.*` — receptionist appointment scheduling (carried over from
  Phase 8): Receptionist/Admin manage; staff see only appointments where
  they are `staffToMeet`. Overlap for the same staff member → 409
  `STAFF_DOUBLE_BOOKED` (service check over scheduled appointments).
  Creating an appointment notifies the staff member.
