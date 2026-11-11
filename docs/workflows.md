# Workflows

## Admission (§16)
Submitted → (Receptionist) Under Review → (Admin/Principal) Approved/Rejected → Enrolled: generate unique admission number → create/link verified parent account → assign class/section/session → apply fee structure → notify parent. Status history kept.

## Attendance (§9)
Teacher selects assigned class/date → marks Present/Absent/Late/Excused → unique (student,class,date) blocks duplicates → markedBy + timestamp + edit history → absence triggers parent notification.

## Assignment (§9/§20)
Teacher creates (class/section/subject, deadline, attachments) → student submits (timestamp, late flag) → teacher grades + feedback → student/parent see published feedback.

## Results (§19)
Admin creates exam + schedule/max marks → teachers enter marks (assigned only, ≤ max) → review/approval → publish → notifications → report cards (PDF) visible to student/parent. Unpublished = hidden.

## Fees & payments (§12)
Accountant creates fee structure → generates invoices/challans → parent pays:
- Online: backend creates gateway order → gateway confirms server-side / signed webhook (idempotent via paymentWebhookEvents) → only then invoice marked paid → receipt.
- Manual: parent submits reference/proof → status pending-verification → Accountant approves (receipt generated) or rejects (reason recorded). Verifier + date + amount always recorded.
Partial payments only if school policy enables them. Verified transactions are never deleted — refunds/reversals are new records.

## Library (§14)
Check copy availability → issue (copy status → issued, due date set) → return (fine per policy if overdue) → history preserved.

## Timetable (§18)
Draft entries validated against teacher/classroom/class-period unique constraints → conflicts shown → authorized approval → published views per class/teacher/student.

## End-to-end acceptance scenario (§36)
Admin creates teacher + parent → registers student → links parent → assigns class/section → assigns teacher → teacher marks attendance → parent views attendance → accountant generates challan → parent pays → verified → receipt → teacher creates assignment → student submits → teacher grades → admin creates exam → teacher enters marks → approve + publish → student/parent view report card.
