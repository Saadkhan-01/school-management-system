# API Documentation — Base: `/api/v1`

Response envelope: success `{ success: true, data, meta? }`; error `{ success: false, error: { code, message, details? } }`.
Auth: `Authorization: Bearer <accessToken>`; refresh token in HttpOnly cookie `refreshToken` (path `/api/v1/auth`).

## Implemented in Phase 1 (auth core)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /health | Public | No DB required; returns status + db state |
| POST | /auth/login | Public (rate-limited) | {email, password} → access token + user; sets refresh cookie |
| POST | /auth/logout | Authenticated | Clears refresh cookie, revokes stored refresh hash |
| POST | /auth/refresh | Refresh cookie | Rotates refresh token, returns new access token |
| POST | /auth/forgot-password | Public (rate-limited) | Issues hashed reset token (dev: token returned only when NODE_ENV!=production AND no mailer configured — documented, never in prod) |
| POST | /auth/reset-password | Public | {token, newPassword} |
| POST | /auth/change-password | Authenticated | {currentPassword, newPassword} |
| GET | /auth/me | Authenticated | Current user profile (no password fields) |
| POST | /auth/register | Admin only | Creates any account incl. staff; public self-registration is disabled by design (§4) |

Validation: Zod schemas on every auth route. RBAC: `authenticate` + `authorize(...roles)` middleware; ownership helper `assertOwnership / scopeFilter` in `src/middleware/ownership.ts`.

## Implemented in Phase 2 (Public Website CMS, enquiries, admissions intake)
All DB-backed routes return `503 DB_UNAVAILABLE` when MongoDB is not connected — never fake success. Validation runs before the DB check, so malformed requests return `422` even without a database. Public form POSTs are rate-limited (30 / 15 min per IP).

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /website/public | Public | Published WebsiteContent singleton, or `data.content = null` when nothing is published yet (frontend then shows demo-marked fallback) |
| GET | /website/public/items?type=news\|event\|gallery\|announcement | Public | Only `status=published`, `publishAt <= now`, audience `public`/`all` — role-targeted announcements never leak |
| POST | /website/enquiries | Public (rate-limited) | Contact-form enquiry → saved as `new` with status history → `201 {id, status}` |
| GET | /website/admin/content | Admin | Stored CMS document or `null` |
| PUT | /website/admin/content | Admin | Merge-update of the singleton (arrays replace wholesale); `isPublished` gates public visibility |
| GET | /website/admin/items | Admin, Principal | Filter `type`, `status`, `search`; paginated |
| POST | /website/admin/items | Admin, Principal | Principals: announcements only (service-enforced 403 otherwise) |
| PUT | /website/admin/items/:id | Admin, Principal | Same principal restriction |
| DELETE | /website/admin/items/:id | Admin | Hard delete (CMS content has no historical-record duty) |
| GET | /website/admin/enquiries | Admin, Receptionist | Filter `status`, `search`; paginated |
| PATCH | /website/admin/enquiries/:id/status | Admin, Receptionist | `{status: new\|contacted\|resolved\|closed, internalNotes?, note?}`; appends history, records handler |
| GET | /settings/public | Public | Published school identity + contact subset |
| GET | /settings | Admin | Settings view over the WebsiteContent singleton (single source of truth) |
| PUT | /settings | Admin | Update identity/contact/footer/admissionOpen subset |
| POST | /admissions/public | Public (rate-limited) | Online application (§16 fields + document metadata) → saved `Submitted` + history → `201 {id, status}` |
| GET | /admissions | Admin, Principal, Receptionist | Filter `status`, `search`; paginated |
| GET | /admissions/:id | Admin, Principal, Receptionist | Single application incl. status history |
| PATCH | /admissions/:id/status | Admin, Principal, Receptionist | Transitions validated in service: `Submitted → Under Review` (Receptionist/Admin/Principal), `Under Review → Approved\|Rejected` (Admin/Principal only). Invalid sequence → `409 INVALID_STATUS_TRANSITION`; wrong deciding role → `403`; `Enrolled` → `422 USE_ENROLL_ENDPOINT` (conversion is the dedicated endpoint below, Phase 4) |
| POST | /admissions/:id/enroll | Admin | Phase 4 conversion (§16 steps 6–12): body `{sessionId, classId, sectionId, guardianRelation?, parentPassword?, note?}`. Only from `Approved` (else 409; already Enrolled → 409 `ALREADY_ENROLLED`). Creates the Student (generated `ADM-<year>-<seq>` admission number), creates/reuses the parent account + profile with a verified ParentStudent link, creates the active Enrollment, marks the application `Enrolled` with history → `201` with student/parent/enrollment summaries. Fee structure: Phase 7 (`feeStructure: null` + note). Parent notification: Phase 9 (`notification: null` + note) — never faked. A new parent account's temporary password is returned only when `NODE_ENV != production` |

Seed: `cd backend && npm run seed:admin` — creates the first Admin from `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars only; refuses to run without them, never overwrites an existing account, never prints the password.

## Implemented in Phase 4 (People, Academics, Enrollments, Dashboard Reports)
Same conventions: Zod validation on every write, route order authenticate → authorize → validate → requireDb, so without a database authorized+valid requests return `503 DB_UNAVAILABLE` (never fake success) while malformed ones return `422` first. All list endpoints accept `search`, module filters, `page`, `limit` and return `{ data: { <key>: [...] }, meta: { page, limit, total, pages } }`.

| Method | Route | Access | Notes |
|---|---|---|---|
| POST / GET | /users, /users/:id | Admin | Create any of the 8 roles (no public self-registration); list filters `role`, `isActive`, `search` |
| PATCH | /users/:id · /users/:id/status | Admin | Update profile/role/verified; `{isActive}` activate/deactivate (deactivating revokes the refresh session; self-deactivation → 422) |
| POST | /users/:id/reset-password | Admin | `{newPassword}` — hashes, revokes all sessions |
| GET | /users/:id/login-history | Admin | Paginated login history (newest first) + account summary |
| DELETE | /users/:id | Admin | Guarded: 409 `USER_HAS_HISTORY` when the account has login history or a student/parent/teacher/staff profile — deactivate instead |
| POST / GET / PATCH | /students, /students/:id, /students/:id/status | Writes: Admin. Reads: Admin, Principal (full); Receptionist, Librarian (limited fields — no DOB/guardian contacts/address/notes); Teacher (assigned-class scope); Student (own); Parent (verified-linked) | `admissionNumber` optional on create — generated `ADM-<year>-<4-digit seq>` with collision-safe retry. Filters: `status`, `gender`, `search` |
| POST / GET / PATCH | /parents, /parents/:id | Admin (Principal read) | Create with `userId` (existing parent account) or `name+email+password` (creates a verified parent account + profile). List items include verified/total linked-children counts |
| GET / POST | /parents/:id/students | Admin (GET also Principal) | Parent↔student links; POST body `{studentId, relationship?, isPrimaryContact?, verified?}` — Admin-created links default verified; pair is unique (409) |
| PATCH / DELETE | /parents/:id/students/:studentId/verify · /parents/:id/students/:studentId | Admin | Set link verified flag (records verifier + time) / remove link |
| POST / GET / PATCH | /teachers, /teachers/:id | Admin (Principal read) | Profile + optional new login account; `employeeId` unique (409 on clash) |
| POST / GET / PATCH | /staff, /staff/:id | Admin (Principal read) | HR profile: department, designation, joining date, employment status; login role may not be student/parent |
| POST / GET / PATCH / DELETE | /academics/sessions, /classes, /sections, /subjects, /classrooms, /grading-scales (+ /:id) | Writes: Admin. Reads: Admin, Principal, Teacher, Student, Parent | Uniqueness: session name; class per session; section per class; subject code per session; classroom name; grading ranges min ≤ max within 0–100. One `isCurrent` session and one `isDefault` grading scale at a time. Deletes are blocked with 409 while dependent records exist |
| POST / GET / DELETE | /academics/teacher-assignments | Admin (GET also Principal, Teacher) | `{teacherId, classId, sectionId, subjectId, sessionId}` — unique combination (409); section must belong to class and class to session (422) |
| POST / GET | /enrollments, /enrollments/:id | Admin (Principal read) | Enroll `{studentId, sessionId, classId, sectionId, enrollmentDate?, notes?}` — one active enrollment per student per session (service 409 + unique partial index). Filters: `studentId`, `sessionId`, `classId`, `sectionId`, `status` |
| POST | /enrollments/:id/transfer · /withdraw · /promote | Admin | Transfer: same session, new class/section. Withdraw: closes with status `withdrawn`. Promote: `{toSessionId, toClassId, toSectionId}` must be a different session — closes current as `promoted`, creates the next-session enrollment, history preserved via `previousEnrollment` |
| GET | /reports/dashboard/admin | Admin | Live counts from real collections (see report service). `attendanceToday` and `fees` are `null` with notes until Phases 5/7 |
| GET | /reports/dashboard/principal | Principal, Admin | Same real counts, principal variant |

## Implemented in Phase 5 (Academic Modules)
Same conventions: Zod validation on every write, route order authenticate → authorize → validate → requireDb, so without a database authorized+valid requests return `503 DB_UNAVAILABLE` while malformed ones return `422` first. Ownership scope (teacher = TeacherAssignment, parent = verified links, student = own record) is enforced in the services via `modules/academic-scope.ts`.

| Method | Route | Access | Notes |
|---|---|---|---|
| POST | /attendance/bulk | Admin, Teacher (assigned classes only) | `{classId, sectionId, sessionId, date, records:[{studentId, status, note?}]}` — status ∈ present/absent/late/excused. Every student must hold an active enrollment in that class/section/session (422 `ENROLLMENT_MISMATCH`). Duplicate day → 409 `ATTENDANCE_ALREADY_MARKED` (unique indexes on (student,date) and (enrollment,date)) |
| GET | /attendance/roster?classId&sectionId&sessionId&date? | Admin, Principal, Teacher (assigned) | Active enrollments for the marking screen + statuses already recorded that day |
| GET | /attendance/class?classId&sectionId&sessionId&date | Admin, Principal, Teacher (assigned) | One day's records for a class |
| GET | /attendance/student/:studentId?from&to&sessionId | Admin, Principal (full); Teacher (assigned); Student (own); Parent (verified-linked) | Records + summary `{total, counts, attendancePercentage}` |
| PUT | /attendance/:id | Admin, Teacher (assigned) | Correction `{status, note?}` — appends an editHistory entry (who/when/old→new); never overwrites history |
| GET | /attendance/report?sessionId&from&to&classId?&sectionId?&studentId? | Admin, Principal, Teacher (assigned scope); Student/Parent only with own/linked studentId | Any date range (daily/weekly/monthly): overall + per-student percentages computed from real records |
| GET | /attendance/approved-leaves?date&classId?&sectionId?&sessionId? | Admin, Principal, Teacher | Approved student leave overlapping the date (attendance-marking context) |
| POST / GET / PATCH / DELETE | /timetable, /timetable/:id | Writes: Admin. Reads: Admin, Principal, Teacher (own/assigned) | Conflicts on create/update → 409: `TIMETABLE_TEACHER_CONFLICT` (teacher double-booked, time-overlap), `TIMETABLE_CLASSROOM_CONFLICT`, `TIMETABLE_CLASS_PERIOD_CONFLICT`; unique indexes back all three. Body: `{sessionId, classId, sectionId, subjectId, teacherId, classroomId?, weekday, periodNumber, startTime, endTime}` (HH:MM, end > start else 422) |
| GET | /timetable/by-teacher/:teacherId?sessionId | Admin, Principal, Teacher (own only) | Teacher's entries |
| GET | /timetable/by-student/:studentId?sessionId | Admin, Principal, Teacher, Student (own), Parent (verified-linked) | Resolved through the student's active enrollment |
| POST / GET / PATCH | /exams, /exams/:id | Writes: Admin. Reads: Admin, Principal, Teacher, Student, Parent | Exam: `{name, type, sessionId, classIds[], startDate?, endDate?, status?, gradingScaleId?, allowPositions?}`. `resultStatus`: draft → in-review (first marks) → approved → published. Published exams lock configuration |
| POST / GET / DELETE | /exams/:id/schedules, /exams/:id/schedules/:scheduleId | Create/Delete: Admin. Read: same as exams | `{classId, sectionId?, subjectId, date, maxMarks, startTime?, endTime?}` — unique per exam/class/section/subject (409); class must be part of the exam (422); delete blocked while marks exist (409) |
| POST | /exams/:id/approve · /exams/:id/publish | Admin, Principal | Approve requires ≥1 entered mark (409 `NO_MARKS`); publish requires approved (409 `RESULT_NOT_APPROVED`) |
| POST | /marks/bulk | Admin, Teacher (assigned subject/class only → 403) | `{examScheduleId, entries:[{studentId, obtainedMarks}]}` — obtainedMarks > maxMarks → 422 `MARKS_EXCEED_MAX`; not-enrolled student → 422; existing marks are corrected with a change-history entry; published results → 409 |
| GET | /marks?examScheduleId&examId&studentId | Staff scoped; Student/Parent only when published | Student/Parent on unpublished exams → 404 `RESULT_NOT_PUBLISHED` |
| PATCH | /marks/:id | Admin, Teacher (assigned) | `{obtainedMarks, note?}` — same max/published checks, history appended |
| GET | /results/report-card/:examId/:studentId | Admin, Principal, Teacher (assigned), Student (own), Parent (verified-linked) | Structured JSON: subjects with marks/max, totals, percentage, grade from the GradingScale, position ONLY when the exam's `allowPositions` policy flag is on (default off). Student/Parent before publication → 404 `RESULT_NOT_PUBLISHED` |
| GET | /results/report-card/:examId/:studentId/pdf | Same as above | Real PDF generated server-side with pdfkit from the same computed data; `Content-Type: application/pdf`, attachment download |
| GET | /results/exam/:examId/summary | Admin, Principal, Teacher (assigned to ≥1 schedule) | Per-student totals for the exam |
| POST / GET / PATCH | /assignments, /assignments/:id | Create/Update: Teacher (own, assigned scope) / Admin. Reads: + Principal, Student (own class), Parent (verified-linked child, `?studentId=`) | Attachments are metadata only (`{name, url?, mimeType?, sizeBytes?}`) until file storage is configured — no upload is faked |
| POST | /assignments/:id/submissions | Student (own class only) | `{content?, attachments?}` — one submission per assignment (unique index). Late flag computed server-side vs deadline. Resubmission allowed BEFORE the deadline (resets grading); after it → 409 `SUBMISSION_LOCKED` |
| GET | /assignments/:id/submissions | Admin, Principal, Teacher (own assignment) | Submission list for grading |
| GET | /assignments/:id/my-submission?studentId= | Student (own), Parent (verified-linked), staff | Parents/students see marks+feedback only when `feedbackPublished` is true; otherwise those fields are withheld with a note |
| PATCH | /assignments/submissions/:submissionId/grade | Teacher (own assignment), Admin | `{marks?, feedback?, feedbackPublished?}` — marks above the assignment max → 422; grading with feedback publishes it unless `feedbackPublished: false` |
| POST / GET / DELETE | /study-materials, /study-materials/:id | Create/Delete: Teacher (assigned class/subject; own records) / Admin. Reads: + Principal, Student/Parent (enrollment-scoped) | Metadata/file-URL records (title, fileName, fileUrl) — storage phase adds real uploads |
| POST / GET | /leave, /leave/:id | Create: staff roles (self) + Parent (verified-linked child, `studentId` required). Reads scoped: own applications; Admin/Principal all | `{leaveType: sick\|casual\|annual\|emergency\|other, fromDate, toDate, reason, studentId?}` — toDate < fromDate → 422 |
| PATCH | /leave/:id/decide | Admin, Principal | `{status: approved\|rejected, decisionNote?}` — non-pending → 409 `ALREADY_DECIDED`; records decider + time |
| GET | /leave/approved?date= | Admin, Principal, Teacher | All approved leave (staff + student) overlapping the day |
| GET | /academics/my-assignments | Teacher | The signed-in teacher's TeacherAssignment rows (resolved via their profile) — powers the Teacher portal's My Classes view |

## Implemented in Phase 6 (Student & Parent Portals, profile self-service)
Same conventions: route order authenticate → authorize → validate → requireDb, so without a database 401/403/422 are probeable and authorized+valid requests return `503 DB_UNAVAILABLE`. Record scope is enforced in the services via `modules/academic-scope.ts` — the portal aggregates accept NO student id from the client for the student portal, and the parent child summary is gated by a verified-link check before any child data is read.

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /portal/student/me | Student only | One aggregated own-scope response computed from real records: `account`, `student` (incl. admission number), `enrollment` (active, populated session/class/section, or `null`), `subjects` + `teachers` (derived from TeacherAssignment rows for the enrollment's class/section/session), `attendance` (`summary` overall % + counts, `recent` last 10 records, `subjectWise: null` + note — the Attendance model is class/day-level with no subject field, so subject-wise attendance is honestly not offered), `assignments` (`upcomingCount` = all upcoming deadlines, `pendingCount` = upcoming with no submission, `upcoming` next 10), `publishedExams` (resultStatus=published only), `timetable` (entries for the enrollment). No linked student record → 404 `STUDENT_PROFILE_NOT_LINKED`. Other roles (incl. Admin) → 403: the portal is strictly the student's own view |
| GET | /portal/parent/me | Parent only | `account`, `profile` (ParentProfile or `null`), `children` — VERIFIED ParentStudent links only, each `{studentId, name, admissionNumber, status, relationship, isPrimaryContact, enrollment}` for the child switcher — and `unverifiedLinks: {count, note}`. Unverified links contribute ONLY a count: no names, no ids, no child data |
| GET | /portal/parent/children/:studentId/summary | Parent only | Per-child summary: student profile, enrollment, attendance (summary + recent), published exams list, assignments with the child's submission state (marks/feedback included ONLY when `feedbackPublished` is true, else a `feedbackNote`), `pendingCount`, timetable, and the parent's recent leave applications for that child. Scope gate: `assertStudentVisible` (academic-scope.ts) runs FIRST — a studentId with no VERIFIED link (or no link at all) returns **403 FORBIDDEN**, the scope layer's existing convention (same as attendance/assignments/results); a malformed id returns 400 `INVALID_ID` once the DB check passes |
| GET | /portal/announcements?type=announcement\|news\|event\|gallery | Any authenticated role | Published PublicContentItems (`status=published`, `publishAt <= now`) sliced by audience for the caller's role via the pure `audiencesForRole()` map in the portal service: everyone sees `public`/`all`; `students`→students only, `parents`→parents only, `teachers`→teachers (+staff), `staff`→staff roles (teacher/principal/accountant/librarian/receptionist/admin); Principal also sees student/parent slices (supervisory), Admin sees all. Role-targeted items never reach other roles. Response includes the matched `audiences` list for transparency. Invalid `type` → 422 before the DB check |
| PATCH | /auth/me/profile | Authenticated (any role) | Self-service profile edit (§6): body `{name?, phone?}` — at least one field required. Schema is STRICT (Zod `.strict()`): sending `role`, `email`, `isActive` or `isVerified` → 422 `VALIDATION_ERROR` — role/email/activation are never self-changeable here (Admin user management owns them). Updates `User.name`/`User.phone` (phone field added to the User model in Phase 6) and mirrors phone into the account's ERP profile (parent/teacher/staff/student) when one exists. `GET /auth/me` already existed (Phase 1) and now also returns `phone`; its middleware order was aligned to authenticate → requireDb so 401 is probeable without a DB. Password change reuses the existing `POST /auth/change-password` |

Frontend (Phase 6): full Student portal (`/student/dashboard|timetable|attendance|assignments|materials|results|fees|certificates|announcements|settings`) and Parent portal (`/parent/dashboard|attendance|results|assignments|timetable|leave|fees|announcements|settings`) replacing the Phase 5 minimal Portal component (removed). Detail views reuse the Phase 5 scoped endpoints (attendance records, assignments + my-submission + submit, study materials, timetable by-student, report card JSON + PDF, leave create/list). The parent child switcher lists only the verified children from `/portal/parent/me`, persists the selection, and every page re-scopes to it (server re-validates on each request). Fees pages (both portals) and the student Certificates page are honest pending states — the Phase 7 fee API and Phase 8 certificate issuance do not exist yet, so those pages call no endpoint and show no invented data.

## Implemented in Phase 7 (Finance & HR/Payroll)
Same conventions: Zod validation on every write, route order authenticate → authorize → validate → requireDb, so without a database authorized+valid requests return `503 DB_UNAVAILABLE` while malformed ones return `422` first (the two payment-gateway endpoints below are the documented exceptions — they fail on gateway configuration before any DB access).

**MONEY CONVENTION (all Phase 7 endpoints):** every amount is an **integer count of minor units** (150000 = 1,500.00). Decimal amounts are rejected with 422. Totals (fee-structure total, invoice subtotal/totalDue, salary net, payroll gross/net) are ALWAYS computed server-side; clients never submit them. `Invoice.amountPaid` is derived from **verified payments only** and recomputed after every verification/reversal — it is never client-settable.

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /fees/reference-data | Admin, Accountant, Principal | Minimal sessions/classes/sections (id + name) for finance forms — Accountant has no general Academics access per the matrix, so finance uses this scoped lookup |
| GET | /fees/student-lookup?search= | Admin, Accountant | Minimal student search (admission number / name → id, name, admissionNumber, status) for invoice/scholarship forms; never full student records |
| POST / GET / PATCH / DELETE | /fees/structures, /fees/structures/:id | Writes: Admin, Accountant. Reads: + Principal | Line items `[{label, amount}]`; `totalAmount` computed server-side; `lateFeePolicy {type: flat\|percent, value, graceDays}` (percent ≤ 100); `partialPaymentsAllowed`; `periodLabel`. DELETE → 409 once invoices reference the structure (deactivate instead) |
| POST / GET / PATCH | /fees/scholarships, /fees/scholarships/:id | Writes: Admin, Accountant. Reads: + Principal | `{studentId, sessionId?, type: percent\|flat, value, reason}` — percent ≤ 100; applied automatically at invoice generation and available as an invoice adjustment |
| POST | /invoices | Admin, Accountant | Generate one invoice `{studentId, feeStructureId, enrollmentId?, dueDate, periodLabel?}` — enrollment resolved/validated against the structure's session/class/section (422 on mismatch); active scholarships become adjustments; number `INV-<year>-<6-digit seq>` (unique index + retry) |
| POST | /invoices/bulk | Admin, Accountant | Bulk-generate for the structure's class/section → `{created, skipped, errors, totalEnrolled}`; already-invoiced students (same structure + period) are skipped — unique partial index `one_invoice_per_student_structure_period` backs this |
| GET | /invoices, /invoices/:id | Admin, Accountant, Principal (full); Student (own); Parent (verified-linked) | Response adds computed `balance` and effective `status` — `overdue` is COMPUTED from dueDate + unpaid balance, never hand-set. `?status=overdue` filters computed-overdue rows |
| GET | /invoices/:id/challan-pdf | Same as invoice reads | Real pdfkit challan from the stored invoice, same scope checks (`Content-Type: application/pdf`) |
| POST | /invoices/:id/adjustments | Admin, Accountant | `{label, amount, type: discount\|scholarship\|late-fee\|charge, scholarshipId?, note?}` — totals recomputed, change appended to the invoice `history` audit trail; 409 if the new totalDue would fall below verified amountPaid |
| POST | /invoices/:id/apply-late-fee | Admin, Accountant | Applies the snapshotted late-fee policy once (409 when not past grace, already applied, paid, or no policy) |
| POST | /invoices/:id/cancel | Admin, Accountant | `{reason}` — 409 when any verified payment exists (reverse payments first); cancelled invoices keep their full history |
| POST | /payments | Parent (own child's invoice), Admin, Accountant | Manual/offline submission `{invoiceId, amount, method: manual\|cash\|bank-transfer, reference?, proofFileName?, proofUrl?, note?}` → status `pending-verification`. `method: "online"` → 422 (online exists only via gateway checkout). Amount > balance → 422 `OVERPAYMENT`; partial amount when the structure disallows partials → 422 `PARTIAL_NOT_ALLOWED`. Proof is METADATA ONLY — file storage (§34) is not configured |
| GET | /payments, /payments/:id | Admin, Accountant (full); Student (own); Parent (verified-linked) | Principal has NO payment access (matrix) |
| POST | /payments/:id/verify | Admin, Accountant | Creates the payment's ONE Receipt (`RCP-<year>-<6-digit seq>`; `Receipt.payment` unique) and recomputes the invoice from verified payments. Already verified → 409 `ALREADY_VERIFIED` (idempotent — no second receipt is possible) |
| POST | /payments/:id/reject | Admin, Accountant | `{reason}` required; the invoice is NOT touched |
| POST | /payments/:id/reverse | Admin, Accountant | `{reason}` required; verified payments only. Creates a PaymentReversal audit record, voids the receipt, sets the payment `reversed`, recomputes the invoice (balance reopens). Nothing is deleted |
| GET | /payments/receipts, /payments/receipts/:id/pdf | Same scoping as payments | Receipts exist ONLY for verified payments; a reversed payment's receipt is `void` and its PDF says so |
| POST | /payments/online/checkout | Admin, Accountant, Parent, Student | **STRUCTURE ONLY — NOT LIVE.** While `PAYMENT_PROVIDER` / `PAYMENT_GATEWAY_KEY` / `PAYMENT_GATEWAY_SECRET` / `PAYMENT_WEBHOOK_SECRET` are not all set in `backend/.env`: 503 `PAYMENT_GATEWAY_NOT_CONFIGURED` with setup guidance (checked before the DB). A real adapter must be implemented in `modules/payments/payment-provider.ts`; only a verified webhook may ever create a verified online payment — a frontend "success" never marks anything paid |
| POST | /payments/webhooks/provider | Public gateway callback (signature is the trust) | No webhook secret configured → 503; provider incomplete → 503; bad `x-webhook-signature` (HMAC-SHA256 hex over the raw body) → 401 `WEBHOOK_SIGNATURE_INVALID`. Verified deliveries are recorded in `paymentWebhookEvents` (unique provider+eventId — duplicates acknowledged, never reprocessed) with `processed: false`: this structure build NEVER marks anything paid from a webhook |
| POST / GET / PATCH / DELETE | /expenses, /expenses/:id | Admin, Accountant | Expense records (category, amount, date, payee, method, note, recordedBy). DELETE always → 409 `FINANCE_RECORDS_NOT_DELETABLE` (audit trail; correct by editing) |
| POST / GET / PATCH / DELETE | /finance/income, /finance/income/:id | Admin, Accountant | Non-fee income (donation/rental/sale/grant/other). Fee income is NEVER recorded here — it derives from verified payments (see summary rule). DELETE → 409 as above |
| GET | /finance/summary | Admin, Accountant, Principal | Daily/monthly/yearly (+ optional `?from&to`) income vs expense. **Income rule:** fee income = Σ payments with status `verified` (by verifiedAt); pending/rejected/reversed never count |
| GET | /finance/dashboard/accountant | Accountant, Admin | Phase-4-pattern stats: total + monthly verified collection, pending fees total, overdue count/total, manual payments awaiting verification, expenses total/monthly, other income, payroll draft/paid overview — all real aggregates |
| GET | /finance/dashboard/principal | Principal, Admin | Read-only fee overview (collections + pending + overdue) — no expense detail, no salary data |
| GET | /payroll/employees | Admin, Accountant | Minimal employee directory (teacher/staff profile id, employeeId, name) for salary-structure forms |
| POST / GET / PATCH | /payroll/structures, /payroll/structures/:id | Admin, Accountant ONLY | `{teacherId XOR staffId, baseSalary, allowances[], deductions[]}` — one structure per employee (unique indexes); totals + net computed server-side; deductions exceeding gross → 422. Teacher/Principal/Librarian/Receptionist → 403 |
| POST | /payroll/runs/generate | Admin, Accountant | `{month, year}` — one draft run per active structure; existing employee+month runs are skipped and counted (unique index) |
| GET | /payroll/runs | Managers (Admin/Accountant) all; Principal/Teacher/Librarian/Receptionist OWN runs only (filter forced server-side) | Students/parents → 403 |
| POST | /payroll/runs/:id/mark-paid | Admin, Accountant | Draft → paid with paidAt/paidBy; already paid → 409 |
| GET | /payroll/runs/:id/payslip-pdf | Managers any; other staff ONLY their own (403 otherwise) | pdfkit payslip from the run's frozen snapshot |

Frontend (Phase 7): Accountant portal is real — `/accountant/dashboard` (stats API), `/accountant/fees` (structures + scholarships), `/accountant/invoices` (single + bulk generation, adjustments, late fee, cancel, challan PDF), `/accountant/payments` (office recording + verification queue with verify/reject/reverse + receipts), `/accountant/expenses` (expenses + other income), `/accountant/payroll` (structures, monthly generation, mark paid, payslip PDF), `/accountant/reports` (income vs expense summary). Admin gets the same panels under `/admin/finance` (tabbed). Parent `/parent/fees` is now real per-child invoices + challan PDF + manual submission + history + verified-only receipt PDFs (+ an online-pay button that honestly surfaces the gateway-not-configured response); Student `/student/fees` is a read-only own-invoice/receipt view. Principal dashboard gains a read-only Fee Collection Overview tab.


## Implemented in Phase 8 (Additional Operations)
Same conventions: route order authenticate → authorize → validate → requireDb (the accountant fee-clearance scope check on POST /certificates also runs before requireDb, so it is probeable without a DB). Money (library fines, transport maintenance costs) is integer MINOR units.

| Method | Route | Access | Notes |
|---|---|---|---|
| GET/POST/PATCH | /library/categories, /library/books, /library/copies | Writes: Librarian + Admin. Reads: + Principal | Book {title, author, isbn?, category, publisher?, year}; each physical copy is its own BookCopy {book, copyCode unique, status available/issued/lost/archived} |
| GET | /library/catalogue | Admin, Librarian, Principal, Teacher, Student, Parent | Availability counts ONLY per book — borrower identities are never exposed here (§14) |
| POST | /library/issues | Librarian, Admin | `{copyId, studentId, issueDate?, dueDate?}` — copy not available → 409 `COPY_NOT_AVAILABLE`; open issue per copy blocked by service check + unique partial index `one_open_issue_per_copy`. Default loan = 14 days |
| POST | /library/issues/:id/return | Librarian, Admin | Fine computed server-side: whole overdue days × 500 minor units (5.00/day); stored with fineStatus unpaid/paid/waived — never dropped. Return before issue → 422 |
| GET | /library/issues · /library/overdue | Managers full; Student own; Parent verified-linked only (service-scoped) | Overdue = open issues past dueDate |
| GET | /library/reports/summary | Admin, Librarian, Principal | Real aggregates: books/copies/available/issued/overdue + fine totals by status |
| POST/GET/PATCH | /transport/buses, /transport/routes | Writes: Admin. Reads: Admin, Principal, Accountant (+ routes also Student/Parent) | Bus registrationNumber unique; Route stops are an ordered array |
| POST/GET | /transport/allocations | Create: Admin. Reads: + Student (own) / Parent (verified-linked) | Unique active allocation per student per session; stop must be on the route (422); allocations per bus+session ≥ bus capacity → 409 `BUS_CAPACITY_FULL` |
| POST | /transport/allocations/:id/cancel | Admin | Cancel keeps history |
| POST/GET | /transport/maintenance | Admin write; overview read | Cost in integer minor units |
| GET | /transport/expiring?days=30 | Admin, Principal, Accountant | Vehicles with insurance/registration/fitness expiring within N days — computed from stored dates (no cron, no fake notifications). NO GPS tracking (future extension) |
| GET/POST/PATCH | /inventory/categories, /inventory/suppliers, /inventory/items | Writes: Admin. Reads: Admin, Accountant, Principal | Item.quantityOnHand is DERIVED from transactions — there is no endpoint to set it directly |
| POST | /inventory/transactions | Admin | `{itemId, type: purchase/received/issued/adjustment/return, quantity}` signed semantics (issued negates; adjustment may be negative, others must be positive → 422); result balance < 0 → 409 `INSUFFICIENT_STOCK`; balanceAfter stored per transaction |
| GET | /inventory/transactions · /inventory/low-stock | Read roles as above | Low stock = quantityOnHand ≤ lowStockThreshold, computed |
| POST/GET | /staff-attendance, /staff-attendance/bulk; PATCH /staff-attendance/:id | Mark/correct: Admin, Principal. Reads: staff roles own-only (service-forced); Student/Parent → 403 | Unique (user, date) → duplicate 409 `STAFF_ATTENDANCE_DUPLICATE`. Status present/absent/late/on-leave. Complements Phase 5 student attendance; staff leave stays in Phase 5 Leave (not duplicated) |
| POST/GET | /visitors, /visitors/:id/checkout, GET /visitors/dashboard | Receptionist + Admin ONLY | Checkout before check-in → 422 `CHECKOUT_BEFORE_CHECKIN`; double checkout → 409. Receptionist scope stays narrow — no finance/payroll/confidential routes for this role anywhere |
| POST/GET | /complaints, /complaints/:id, POST /complaints/:id/responses, PATCH /complaints/:id/status | Create: all 8 roles. List/get scoped: managers all, Receptionist all (routing), others own-or-assigned only | Parent complaints must name a verified-linked child (403 otherwise); Student complaints are forced to their own record. Status transitions: Admin/Principal/assignee; Receptionist may ONLY assign (403 on status change, service-enforced); resolving requires a resolution note (422) |
| POST/GET/PATCH | /complaints/discipline | **Admin + Principal ONLY** | Permissions-matrix decision: the Discipline row is ○ for Parent/Student/Teacher/etc., so NO parent summary view exists — everyone else gets 403 at route level |
| POST/GET | /certificates, /certificates/:id, /certificates/:id/pdf | Issue: Admin, Principal, Accountant (fee-clearance ONLY — 403 otherwise, checked before the DB gate). Reads/PDF: + Student (own), Parent (verified-linked) | Reference `CERT-<year>-<6-digit seq>` (unique index + retry). Type fee-clearance checks the student's real Phase 7 invoice balances: outstanding > 0 → 422 `OUTSTANDING_BALANCE` with `outstandingBalanceMinor` in details. PDF is a real pdfkit document from the stored record |
| POST | /certificates/:id/revoke | Admin | `{reason}` required; reason + revoker + time recorded; already revoked → 409 |
| GET | /certificates/verify/:reference | **PUBLIC** (no auth) | Malformed reference → 422 before any DB access; unknown reference (with DB) → 404. Returns ONLY {referenceNumber, studentName, type, issueDate, status, valid} — a revoked certificate verifies with status `revoked`, valid=false |

Frontend (Phase 8): Librarian portal is real (`/librarian/dashboard|books|circulation|overdue|reports`); Receptionist portal is real (`/receptionist/dashboard|visitors|enquiries|complaints` — enquiries/admissions reuse the Phase 2 APIs); Admin gains `/admin/transport|inventory|certificates|complaints|discipline|staff-attendance`; Principal dashboard gains Complaints + Discipline tabs (shared panels); Parent gains `/parent/complaints` (submit for the selected verified child + track/reply) and `/parent/transport` (child allocation, read-only); Student gains `/student/library` (catalogue search + own borrowing), `/student/complaints`, and `/student/certificates` now wired to the real list + PDF (the Phase 6 pending panel is retired).

## Implemented in Phase 9 (Communication & Reporting)
Same conventions: route order authenticate → authorize → validate → requireDb — except the report role gates, which run BEFORE requireDb so RBAC/404/422 on reports are probeable without a DB. Money in reports stays integer MINOR units. All DB-backed flows are Implemented, not Tested (no MongoDB in this environment; probes: 401/403/422/404 pre-DB, 503 authorized, socket handshake probe-verified — see the Phase 9 verification log in docs/feature-tracker.md).

### Notifications (§24) + Socket.IO (§35)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /notifications?unread=true&page&limit | Any authenticated role (own only) | Returns `{ notifications, unread }` + pagination meta. A user can only ever see their own records |
| GET | /notifications/unread-count | Any authenticated role | `{ unread }` — powers the header bell badge |
| PATCH | /notifications/:id/read | Owner only | Missing → 404; someone else's → 403 `FORBIDDEN`. Sets isRead + readAt |
| PATCH | /notifications/read-all | Any authenticated role | Marks all own unread as read; returns `{ updated }` |

Central service `notify({ userIds?, roles?, type, title, body, related?, createdBy? })` (modules/notifications/notification.service.ts): persists records, emits the `notification` event via Socket.IO to each recipient's room, and dispatches external channels. It NEVER throws — a notification failure cannot fail the parent operation. Type enum: student-absence, assignment-created, assignment-graded, result-published, payment-verified, payment-rejected, leave-decided, announcement, message, admission-status, admission-enrolled, complaint-updated, certificate-issued, appointment, fee-invoice-generated, exam-scheduled, assignment-deadline, system. Hooks wired into existing flows: assignment created (class/section students + verified parents), assignment graded, results published (exam classes), payment verified/rejected (submitting parent), leave decided (applicant), admission status changed + admission enrolled (guardian's parent account — closes the Phase 4 TODO), invoice generated, certificate issued, complaint status changed (submitter), student absence on bulk marking (verified parents), new message (other participants), announcement events (audience), appointment scheduled (staff member).

**Socket.IO:** attached to the HTTP server in `server.ts`. Handshake auth: the client passes the JWT access token in the handshake `auth` payload; middleware verifies the signature against the JWT access secret ONLY (no DB lookup — sockets therefore connect in no-DB environments too) and rejects unauthenticated sockets with `UNAUTHENTICATED`. Each socket joins only its server-assigned room `user:<id>` and receives a `connected` event `{ userId, role }`. CORS mirrors the app config. Probe result (2026-11-10): no token → `connect_error: UNAUTHENTICATED: missing token`; dev-minted JWT → connected + `connected` event received.

**Email/SMS/WhatsApp:** interface + unconfigured no-op implementations (modules/notifications/channels.ts), env placeholders `SMTP_HOST/USER/PASSWORD`, `SMS_PROVIDER/API_KEY`, `WHATSAPP_PROVIDER/API_KEY` in backend/.env.example — the same structure-only pattern as the payment provider. A send is never faked; nothing is marked sent while unconfigured.

### Messaging (§24)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /messages/contacts | All roles except student | Only people the caller may message: parent → teachers of verified-linked children (with `viaStudent`) + office (Admin/Receptionist); teacher → staff + parents of students in assigned classes; other staff → staff |
| POST | /messages/conversations | All roles except student | `{ otherUserId, studentId? }` — find-or-create for the pair + student context. Pair rules enforced in the service → 403 `CONVERSATION_NOT_ALLOWED`: Parent↔Teacher only when the teacher is assigned (TeacherAssignment) to a class/section/session where a verified-linked child of the parent is actively enrolled; Parent↔Admin/Receptionist; staff↔staff. Self-conversation → 422 |
| GET | /messages/conversations | Participants only | Own conversations with per-conversation `unreadCount`, lastMessagePreview/At |
| GET | /messages/conversations/:id/messages | Participants only | Missing → 404; non-participant → 403 — no third party can read a conversation by id. Chronological, paginated |
| POST | /messages/conversations/:id/messages | Participants only | `{ body }` 1–5000 chars; updates the conversation preview and notifies the other participants |
| PATCH | /messages/conversations/:id/read | Participants only | Adds the caller to readBy of all messages; returns `{ updated }` |

### Internal Events Calendar (§23) + Appointments (§15)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /events?from&to&type | All roles, audience-sliced | Admin/Principal see all; others only events whose audience contains `all` or their role. Range filters suit a month view |
| GET | /events/:id | Audience-sliced | Out-of-audience → 404 (existence is not leaked) |
| POST/PATCH | /events, /events/:id | Admin, Principal | `{ title, description?, type: holiday\|exam\|parent-meeting\|event\|announcement, startAt, endAt (>= startAt else 422), audience: [roles…\|all] }`. Creating an `announcement` event notifies its audience |
| DELETE | /events/:id | Admin | |
| GET | /appointments?status&staffToMeet&from&to | Admin, Receptionist (all); Principal + other staff (own-assigned only, service-scoped) | Student/Parent → 403 |
| POST/PATCH/DELETE | /appointments, /appointments/:id | Receptionist, Admin | Overlap for the same staff member over `scheduled` appointments → 409 `STAFF_DOUBLE_BOOKED`; staffToMeet must be a staff-role user (422 otherwise); final-status appointments cannot be edited (409 `APPOINTMENT_FINAL`); deleting a still-scheduled appointment → 409 `USE_CANCEL` (cancel it instead). Creating one notifies the staff member |

### Reports, Exports & Activity Logs (§27, §33)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | /reports/catalogue | Any authenticated role | Lists ONLY the report keys the caller's role may access (payroll-summary never appears for Principal/Teacher/Librarian/etc.) |
| GET | /reports/:key?sessionId&classId&sectionId&examId&from&to&month&year | Per-key roles (pre-DB gate) | Unknown key → 404 `REPORT_NOT_FOUND`; wrong role → 403. Keys: `enrollment` (Admin, Principal), `student-attendance` (Admin, Principal, Teacher — teacher restricted to assigned class/section/session combos), `staff-attendance` (Admin, Principal), `admissions` (Admin, Principal, Receptionist), `academic-performance` (Admin, Principal, Teacher; needs `examId`, averages + grade distribution from the Phase 5 grading scale), `fee-collection` (Admin, Principal, Accountant; verified payments by method), `defaulters` (Admin, Principal, Accountant; non-cancelled invoices past due with balance > 0), `expenses` (Admin, Principal, Accountant; income = verified payments + other income ONLY), `payroll-summary` (Admin, Accountant ONLY), `library-usage` (Admin, Principal, Librarian), `transport` (Admin, Principal, Accountant), `inventory-status` (Admin, Principal, Accountant; counts only — items have no cost field, no value is invented). Response: `{ report: { key, title, filters, summary, columns, rows, note?, generatedAt } }` |
| GET | /reports/:key/export?format=csv\|xlsx\|pdf | Same per-key roles (pre-DB gate) | Bad format → 422; unknown key → 404; wrong role → 403. CSV native, XLSX via exceljs, PDF via pdfkit (A4 landscape table). Same RBAC + scope as the JSON endpoint; filename `<key>-report.<ext>` |
| GET | /reports/activity-logs?action&entityKind&actorRole&actorId&entityId&from&to | **Admin only** (matrix: audit logs Admin ●, Principal ○ → Principal gets 403) | ActivityLog { actor, actorRole, action, entityKind, entityId, summary, metadata, ip, createdAt }. `logActivity()` is fail-safe and strips metadata keys matching password/token/secret/authorization/cookie/card/cvv — secrets are never logged. Wired call sites: user role change + activate/deactivate, fee-structure create, invoice generate/cancel, payment verify/reject/reverse, marks bulk-enter/correct, results publish, attendance correction, enrollment create/transfer/withdraw/promote, certificate issue/revoke, admission status + enroll |

Frontend (Phase 9): the placeholder header bell is now a real notification centre (unread badge via 30 s REST poll + Socket.IO push, dropdown, mark-read/mark-all, deep links by related entity) with `/<role>/notifications` pages for all roles; shared Messages pages at `/<role>/messages` (parent/teacher/admin/principal/accountant/librarian/receptionist); Events & Calendar at `/<role>/calendar` (month + list, Admin/Principal manage with audience picker); Appointments at `/receptionist/appointments` + `/admin/appointments`, read-only `/teacher/appointments`; Reports at `/admin/reports` and read-only `/principal/reports` (catalogue-driven picker, filters, CSV/XLSX/PDF export buttons with authenticated download); Accountant `/accountant/reports` extended with the same catalogue reports + exports; Admin Activity Logs viewer at `/admin/activity-logs`.

## Stub-routed (501 Not Implemented, later phases)
Remaining `/api/v1/*` groups exist as routers returning `501 { code: NOT_IMPLEMENTED }` referencing `docs/feature-tracker.md`:
roles, permissions.
(Library, transport, inventory, visitors, complaints (+discipline), certificates and staff-attendance graduated in Phase 8; events (internal ERP calendar), notifications, messages and appointments graduated in Phase 9 — see above. Website, settings and admissions graduated in Phase 2; users, students, parents, teachers, staff, academics, enrollments and reports graduated in Phase 4; attendance, timetable, exams, marks, results, assignments, study-materials and leave graduated in Phase 5; portal aggregates + announcements and auth profile self-service graduated in Phase 6; fees, invoices, payments, finance, expenses and payroll graduated in Phase 7 — see above. Public news/events continue to be served by the website items API, separate from the internal ERP calendar.)
These stubs are honest placeholders — no fake data, no fake success.
