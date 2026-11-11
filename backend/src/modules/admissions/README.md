# Admissions module (Phase 2 — implemented up to decision)

- `admission.model.ts` — AdmissionApplication with status enum + statusHistory.
- `admission.routes.ts` — `POST /public` (rate-limited, Zod-validated, status Submitted), office list/detail, `PATCH /:id/status`.
- Workflow enforced in `admission.service.ts`: Submitted → (Receptionist/Admin/Principal) Under Review → (Admin/Principal) Approved/Rejected.
- Phase 2 stops at Approved/Rejected. Enrollment conversion (unique admission number, verified parent account, class/section/session, fee structure, notification) is Phase 4 — requesting status "Enrolled" returns an explicit 422 `ENROLLMENT_NOT_IN_PHASE_2`.
- Documents on the public form are metadata (names) only until secure storage is configured (§34).
