# Requirements — School Management System (MERN ERP)

Source: Master Development Prompt (42 sections, 2026-11-10). Single school, English only, TypeScript MERN.

## Scope
1. Public School Website (14 pages, CMS-managed) — no login required.
2. School ERP — authenticated, 8 roles, real backend RBAC.

## Roles
Admin, Principal, Teacher, Student, Parent, Accountant, Librarian, Receptionist.

## Functional requirements (summary, full detail in feature-tracker.md)
- Auth: login/logout/forgot/reset/change password, activation, refresh tokens, login history, optional 2FA for privileged accounts.
- Admin: users, students, teachers, staff, parents, admissions, academics, classes/sections, subjects, enrollments, attendance, timetable, exams, assignments, results/report cards, fees, payments, finance/expenses, HR/payroll, library, transport, inventory, events/calendar, notifications, messages, complaints, certificates, reports/analytics, website CMS, activity logs, settings.
- Principal: oversight, approvals (teacher leave), performance, discipline overview, fee overview, announcements.
- Teacher: assigned classes/subjects, attendance (Present/Absent/Late/Excused, no duplicates), assignments+grading, marks entry (validated, assigned scope only), materials, leave.
- Student: own records only — profile, timetable, attendance, results, assignments/submission, materials, report cards (PDF), fees, certificates.
- Parent: verified linked children only, child switcher, attendance/results/report cards, fees/challans, online + manual payment, receipts, leave, messaging, complaints.
- Accountant: fee structures, invoices/challans, online payment verification via server-side gateway confirmation/webhooks (idempotent), manual payment pending-verification workflow, expenses, payroll overview, defaulter reports. Never delete verified transactions — reversals only.
- Librarian: books/copies, issue/return (never exceed available copies), overdue/fines, history, reports.
- Receptionist: enquiries, admissions list, visitors check-in/out, appointments, messages, complaints routing — no unrestricted academic/financial access.
- Admissions workflow: Submitted → Under Review → Approved/Rejected → Enrolled; unique admission number; parent link; class/section/session; fee structure; notification; status history.
- Academics: sessions, classes, sections, subjects, classrooms, teacher assignments, enrollments (one active per student per session), promotion preserving history.
- Timetable: conflict prevention (teacher, classroom, class-period).
- Exams/Results: create → configure → marks entry → validation → approval → publish → report cards. Unpublished results hidden from students/parents.
- Transport: buses, drivers, routes/stops, allocation, capacity, maintenance, expiry reminders. No live GPS without a real service.
- Inventory: categories, stock transactions, low-stock alerts, history.
- Events/Calendar/Announcements with audience selection.
- Notifications: in-app + Socket.IO + email (when configured); persisted in MongoDB. SMS/WhatsApp = future integration point.
- Messaging: parent↔teacher, staff; read/unread; restricted to participants.
- Complaints + Discipline (restricted visibility).
- Certificates: character, bonafide, leaving/transfer, enrollment, fee-clearance; unique reference, PDF, verification.
- Reports: enrollment, attendance, performance, fees, defaulters, expenses, payroll, library, transport, inventory — filters, pagination, PDF/Excel/CSV export, print view, real DB data only.
- Website CMS: school name/logo, hero, about, principal message, programs, faculty, facilities, gallery, news, events, testimonials, contact, footer.

## Non-functional
- Security: hashed passwords (bcrypt; Argon2id acceptable), HttpOnly refresh cookies, Zod validation everywhere, Helmet, CORS allowlist, rate limits, NoSQL-injection protection, upload validation, audit logs, secrets only in env vars, no card data stored.
- Files: Cloudinary/S3-compatible storage; metadata in MongoDB; never store large files in MongoDB.
- Payments: gateway credentials in env only; never mark paid on frontend word alone; webhook idempotency.
- Design: navy #111827, blue #2563EB, bg #F8FAFC, success #16A34A; responsive; accessible.
