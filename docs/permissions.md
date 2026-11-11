# Permissions Matrix — 8 Roles

Legend: ● full · ◐ scoped (own/assigned/linked only) · ○ none. Backend enforces this on every endpoint; frontend hiding is not security.

| Capability | Admin | Principal | Teacher | Student | Parent | Accountant | Librarian | Receptionist |
|---|---|---|---|---|---|---|---|---|
| Manage users/roles | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Students CRUD | ● | ◐ read | ◐ assigned read | ◐ own | ◐ linked | ○ | ◐ borrow read | ◐ limited search |
| Admissions decide | ● | ● approve | ○ | ○ | ○ | ○ | ○ | ◐ review/intake |
| Academics (sessions/classes/subjects) | ● | ◐ read/approve | ◐ read assigned | ◐ read own | ◐ read child | ○ | ○ | ○ |
| Attendance mark | ● | ◐ overview | ● assigned only | ◐ own view | ◐ child view | ○ | ○ | ○ |
| Timetable manage | ● | ◐ approve | ◐ own view | ◐ own view | ◐ child view | ○ | ○ | ○ |
| Marks entry | ● | ◐ approve/publish | ● assigned only | ○ | ○ | ○ | ○ | ○ |
| Results publish | ● | ● | ○ | ◐ own published | ◐ child published | ○ | ○ | ○ |
| Assignments | ● | ◐ overview | ● own classes | ◐ own submit | ◐ child view | ○ | ○ | ○ |
| Fees/invoices | ● | ◐ overview | ○ | ◐ own view | ◐ child view/pay | ● | ○ | ○ |
| Payments verify (manual) | ● | ○ | ○ | ○ | ◐ submit own | ● | ○ | ○ |
| Expenses/payroll | ● | ◐ summaries | ◐ own payslip | ○ | ○ | ● | ○ | ○ |
| Library | ● | ◐ reports | ◐ borrow view | ◐ borrow view | ◐ child view | ○ | ● | ○ |
| Transport/inventory | ● | ◐ overview | ○ | ◐ own allocation | ◐ child allocation | ◐ fees view | ○ | ○ |
| HR/leave approve | ● | ● teacher leave | ◐ apply own | ○ | ◐ child leave apply | ○ | ◐ apply own | ◐ apply own |
| Complaints | ● | ● | ◐ relevant | ◐ own | ◐ own | ◐ relevant | ◐ relevant | ◐ route |
| Discipline | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| Certificates issue | ● | ● | ○ | ◐ own download | ◐ child download | ◐ fee-clearance | ○ | ○ |
| Website CMS | ● | ◐ announcements | ○ | ○ | ○ | ○ | ○ | ○ |
| Reports/analytics | ● | ● | ◐ own classes | ○ | ○ | ● finance | ● library | ◐ admissions |
| Settings/audit logs | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |

Ownership rules: students → self; parents → verified parentStudents links only; teachers → teacherAssignments scope only. Changing an ID in a URL never grants access (checked in service layer).
