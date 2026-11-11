# Database Design — MongoDB / Mongoose

Conventions: ObjectId refs, timestamps on all collections, soft-deactivation preferred over delete for records with history, indexes on search fields, MongoDB transactions for multi-write operations (enrollment, payment verification, book issue).

## Identity and access
| Collection | Key fields / rules |
|---|---|
| users | email unique (lowercase, sparse for non-email logins), role enum (8 roles), passwordHash, refreshTokenHash, isActive, loginHistory[] {at, ip, userAgent, success} |
| roles | name unique, permissions[] |
| permissions | key unique (e.g. `students.read`), description |
| activityLogs | actor ref users, action, entity, entityId, metadata, ip; indexed by createdAt, actor |

## Student and staff records
| Collection | Rules |
|---|---|
| students | admissionNumber **unique**, user ref, dob, gender, status |
| parents | user ref unique |
| parentStudents | parent+student **unique compound**, verified boolean — only verified links grant access |
| teachers | user ref unique, employeeId unique |
| staff | user ref, employeeId unique, department, designation, joiningDate, status |
| admissions | status enum Submitted/Under Review/Approved/Rejected/Enrolled, statusHistory[], desiredClass |
| visitors | checkIn/checkOut, host, purpose |

## Academics
| Collection | Rules |
|---|---|
| academicSessions | name unique, start/end, isCurrent |
| classes | name+session unique |
| sections | class+name unique |
| subjects | code unique per session |
| classrooms | name unique, capacity |
| enrollments | student+session **unique active** (partial index on status=active); preserves history on promotion |
| teacherAssignments | teacher+class+section+subject+session unique |
| timetables | class+section+session+weekday+period **unique**; teacher+weekday+period unique (conflict prevention); classroom+weekday+period unique |
| attendance | student+enrollment(class)+date **unique**; status Present/Absent/Late/Excused; markedBy ref; editHistory[] |
| staffAttendance | staff+date unique |
| exams | session, type, dates |
| examSchedules | exam+subject+class unique, date, maxMarks |
| marks | examSchedule+student **unique**; marksObtained <= maxMarks (validator) |
| gradingScales | session, ranges[] {min,max,grade,points} |
| reportCards | exam+student unique, published boolean, pdfRef |
| assignments | teacher, class/section/subject, deadline, attachments[] |
| submissions | assignment+student **unique**, submittedAt, late flag, marks, feedback |
| studyMaterials | subject/class, fileRef, uploadedBy |

## Finance
| Collection | Rules |
|---|---|
| feeStructures | class+session, components[] |
| invoices | student, session, dueDate, total, paidAmount, status; outstanding = total - paid |
| payments | invoice ref required (must be valid), method online/manual, status pending/verified/rejected/failed, gatewayRef, verifiedBy |
| receipts | payment ref **unique**, only for verified payments |
| scholarships | student, type, amount/percent |
| expenses | category, amount, date, recordedBy; verified txns never hard-deleted (reversal records) |
| payroll | staff+month **unique**, allowances[], deductions[], net, payslipRef |
| paymentWebhookEvents | provider+eventId **unique** (idempotency), payload hash, processedAt |

## Library and operations
| Collection | Rules |
|---|---|
| books | title, author, ISBN indexed, category |
| bookCopies | book ref, copyCode unique, status available/issued/lost |
| bookIssues | copy ref, borrower, issuedBy, issueDate, dueDate, returnDate, fine; issue blocked when no copy available |
| buses | registrationNumber unique, capacity, driver |
| routes | name, stops[] |
| transportAllocations | student+session unique, route, stop |
| inventory | item, category, quantity, lowStockThreshold |
| inventoryTransactions | item ref, type in/out/adjust, qty, balanceAfter, actor |
| suppliers | name, contact |

## Communication and administration
| Collection | Rules |
|---|---|
| events | title, dates, audience |
| announcements | audience roles[], publishAt, attachments[] |
| notifications | recipient ref indexed, type, read boolean, payload; persisted (offline-safe) |
| messages | conversation ref, sender, body, readBy[] |
| conversations | participants[] — access restricted to participants |
| complaints | submitter, category, status, assignee, responses[] |
| disciplineRecords | student, incident, action; restricted roles only |
| certificates | student, type, referenceNumber **unique**, issuedBy, issueDate, verificationStatus |
| schoolSettings | singleton key-value |
| websiteContent | section key unique, payload, published boolean |

## Global rules enforced in schemas/services
Unique admission numbers · unique normalized emails · one active enrollment/student/session · no duplicate attendance · marks ≤ max · payments reference valid invoices · receipts reference verified payments · verified parent-child links only · no timetable teacher/classroom conflicts · no book issue beyond available copies · historical academic/financial records preserved.
