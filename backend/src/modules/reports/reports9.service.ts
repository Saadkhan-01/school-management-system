import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import type { UserRole } from "../users/user.model";
import type { Actor } from "../academic-scope";
import { teacherAssignments } from "../academic-scope";
import { Enrollment } from "../enrollments/enrollment.model";
import { AcademicSession, SchoolClass, Section } from "../academics/academic.models";
import { Attendance } from "../attendance/attendance.model";
import { StaffAttendance } from "../hr/staffAttendance.model";
import { AdmissionApplication } from "../admissions/admission.model";
import { Exam, ExamSchedule } from "../examinations/exam.model";
import { Mark } from "../examinations/marks.model";
import { Invoice } from "../fees/fee.model";
import { Payment } from "../payments/payment.model";
import { Expense, OtherIncome } from "../finance/finance.model";
import { PayrollRun } from "../payroll/payroll.model";
import { Book, BookCopy, BookIssue } from "../library/library.model";
import { Bus, TransportRoute, TransportAllocation } from "../transport/transport.model";
import { InventoryItem } from "../inventory/inventory.model";
import { Student } from "../students/student.model";
import { User } from "../users/user.model";
import { gradeFor } from "../examinations/exam.service";
import { GradingScale } from "../academics/academic.models";

/**
 * Phase 9 report suite (§27) — every figure is computed from real collections
 * at request time; nothing is cached or hardcoded. Each report declares its
 * own role list (mirroring docs/permissions.md) and the SAME list gates both
 * the JSON endpoint and the export endpoint (report.routes.ts checks the
 * registry before the DB gate, so 403/404 are probeable without a DB).
 *
 * Filters (query): sessionId, classId, sectionId, from, to, examId, month, year.
 * Rows are flat records so the shared exporter (reportExport.ts) can render
 * CSV/XLSX/PDF from `columns` + `rows` without knowing the report.
 */
export interface ReportColumn { key: string; label: string }
export interface ReportResult { key: string; title: string; generatedAt: string; filters: Record<string, unknown>; columns: ReportColumn[]; rows: Array<Record<string, unknown>>; summary: Record<string, unknown>; note?: string }
export interface ReportDef { key: string; title: string; roles: UserRole[]; build: (actor: Actor, f: ReportFilters) => Promise<Omit<ReportResult, "key" | "title" | "generatedAt" | "filters">> }
export interface ReportFilters { sessionId?: string; classId?: string; sectionId?: string; from?: Date; to?: Date; examId?: string; month?: number; year?: number }

const STAFF_REPORT: UserRole[] = ["admin", "principal"];
const FINANCE_REPORT: UserRole[] = ["admin", "principal", "accountant"];

export function parseFilters(query: Record<string, unknown>): ReportFilters {
  const oid = (v: unknown) => (typeof v === "string" && mongoose.isValidObjectId(v) ? v : undefined);
  const date = (v: unknown) => { if (typeof v !== "string") return undefined; const d = new Date(v); return Number.isNaN(d.getTime()) ? undefined : d; };
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && v !== undefined && v !== "" ? n : undefined; };
  return { sessionId: oid(query.sessionId), classId: oid(query.classId), sectionId: oid(query.sectionId), examId: oid(query.examId), from: date(query.from), to: date(query.to), month: num(query.month), year: num(query.year) };
}
function dateRange(f: ReportFilters, field = "createdAt"): Record<string, unknown> {
  if (!f.from && !f.to) return {};
  const range: Record<string, Date> = {};
  if (f.from) range.$gte = f.from;
  if (f.to) range.$lte = f.to;
  return { [field]: range };
}
const studentName = (s: { firstName?: string; lastName?: string; admissionNumber?: string } | null | undefined) =>
  s ? `${`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim()} (${s.admissionNumber ?? ""})` : "";

/* ---------------- Enrollment + class distribution ---------------- */
async function enrollmentReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { status: "active" };
  if (f.sessionId) filter.session = f.sessionId;
  if (f.classId) filter.schoolClass = f.classId;
  if (f.sectionId) filter.section = f.sectionId;
  const grouped = await Enrollment.aggregate<{ _id: { c: mongoose.Types.ObjectId; s: mongoose.Types.ObjectId }; count: number }>([
    { $match: filter }, { $group: { _id: { c: "$schoolClass", s: "$section" }, count: { $sum: 1 } } }, { $sort: { count: -1 } },
  ]);
  const [classes, sections, session] = await Promise.all([
    SchoolClass.find({}).select("name").lean(), Section.find({}).select("name").lean(),
    f.sessionId ? AcademicSession.findById(f.sessionId).select("name").lean() : AcademicSession.findOne({ isCurrent: true }).select("name").lean(),
  ]);
  const cName = new Map(classes.map((c) => [String(c._id), c.name]));
  const sName = new Map(sections.map((s) => [String(s._id), s.name]));
  const rows = grouped.map((g) => ({ class: cName.get(String(g._id.c)) ?? String(g._id.c), section: sName.get(String(g._id.s)) ?? String(g._id.s), activeEnrollments: g.count }));
  const totalStudents = await Student.countDocuments({ status: "active" });
  return {
    columns: [{ key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "activeEnrollments", label: "Active enrollments" }],
    rows,
    summary: { session: session?.name ?? null, totalActiveEnrollments: rows.reduce((a, r) => a + (r.activeEnrollments as number), 0), totalActiveStudents: totalStudents, classesRepresented: new Set(rows.map((r) => r.class)).size },
  };
}

/* ---------------- Student attendance summary ---------------- */
async function studentAttendanceReport(actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { ...dateRange(f, "date") };
  if (f.sessionId) filter.session = f.sessionId;
  if (f.classId) filter.schoolClass = f.classId;
  if (f.sectionId) filter.section = f.sectionId;
  if (actor.role === "teacher") {
    // Teacher scope (§27: own classes only) — restrict to assigned combos.
    const { assignments } = await teacherAssignments(actor.id);
    if (!assignments.length) return { columns: [], rows: [], summary: { note: "No assigned classes" }, note: "You have no assigned classes, so this report is empty." };
    filter.$or = assignments.map((a) => ({ schoolClass: a.schoolClass, section: a.section, session: a.session }));
    if (f.sessionId) filter.session = f.sessionId;
  }
  const grouped = await Attendance.aggregate<{ _id: mongoose.Types.ObjectId; total: number; present: number; absent: number; late: number; excused: number }>([
    { $match: filter },
    { $group: { _id: "$student", total: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
      late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
      excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } } } },
    { $sort: { total: -1 } }, { $limit: 1000 },
  ]);
  const students = await Student.find({ _id: { $in: grouped.map((g) => g._id) } }).select("firstName lastName admissionNumber").lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const rows = grouped.map((g) => {
    const attended = g.present + g.late + g.excused;
    return { student: studentName(byId.get(String(g._id))), totalDays: g.total, present: g.present, absent: g.absent, late: g.late, excused: g.excused, attendancePercent: g.total ? Math.round((attended / g.total) * 10000) / 100 : 0 };
  });
  const totals = rows.reduce((a, r) => ({ days: a.days + (r.totalDays as number), attended: a.attended + (r.present as number) + (r.late as number) + (r.excused as number) }), { days: 0, attended: 0 });
  return {
    columns: [{ key: "student", label: "Student" }, { key: "totalDays", label: "Days marked" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "excused", label: "Excused" }, { key: "attendancePercent", label: "Attendance %" }],
    rows,
    summary: { students: rows.length, overallPercent: totals.days ? Math.round((totals.attended / totals.days) * 10000) / 100 : 0 },
  };
}

/* ---------------- Staff attendance summary ---------------- */
async function staffAttendanceReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { ...dateRange(f, "date") };
  const grouped = await StaffAttendance.aggregate<{ _id: mongoose.Types.ObjectId; total: number; present: number; absent: number; late: number; onLeave: number }>([
    { $match: filter },
    { $group: { _id: "$user", total: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
      late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
      onLeave: { $sum: { $cond: [{ $eq: ["$status", "on-leave"] }, 1, 0] } } } },
    { $sort: { total: -1 } }, { $limit: 500 },
  ]);
  const users = await User.find({ _id: { $in: grouped.map((g) => g._id) } }).select("name email role").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const rows = grouped.map((g) => { const u = byId.get(String(g._id)); return { staff: u ? `${u.name} (${u.role})` : String(g._id), totalDays: g.total, present: g.present, absent: g.absent, late: g.late, onLeave: g.onLeave, attendancePercent: g.total ? Math.round(((g.present + g.late) / g.total) * 10000) / 100 : 0 }; });
  return {
    columns: [{ key: "staff", label: "Staff member" }, { key: "totalDays", label: "Days marked" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "onLeave", label: "On leave" }, { key: "attendancePercent", label: "Attendance %" }],
    rows, summary: { staffMembers: rows.length },
  };
}

/* ---------------- Admissions statistics ---------------- */
async function admissionsReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { ...dateRange(f) };
  const grouped = await AdmissionApplication.aggregate<{ _id: string; count: number }>([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  const rows = grouped.map((g) => ({ status: g._id, applications: g.count })).sort((a, b) => b.applications - a.applications);
  const total = rows.reduce((a, r) => a + r.applications, 0);
  const enrolled = rows.find((r) => r.status === "Enrolled")?.applications ?? 0;
  return {
    columns: [{ key: "status", label: "Status" }, { key: "applications", label: "Applications" }],
    rows, summary: { totalApplications: total, enrolled, conversionPercent: total ? Math.round((enrolled / total) * 10000) / 100 : 0 },
  };
}

/* ---------------- Academic performance (per exam) ---------------- */
async function academicPerformanceReport(_actor: Actor, f: ReportFilters) {
  if (!f.examId) return { columns: [], rows: [], summary: {}, note: "Pass ?examId=<exam id> to compute per-student performance for one examination." };
  const exam = await Exam.findById(f.examId).lean();
  if (!exam) throw new AppError(404, "EXAM_NOT_FOUND", "Exam not found");
  const [schedules, marks, scale] = await Promise.all([
    ExamSchedule.find({ exam: exam._id }).lean(),
    Mark.find({ exam: exam._id }).lean(),
    exam.gradingScale ? GradingScale.findById(exam.gradingScale).lean() : GradingScale.findOne({ isDefault: true }).lean(),
  ]);
  const totalMax = schedules.reduce((a, s) => a + s.maxMarks, 0);
  const byStudent = new Map<string, number>();
  for (const m of marks) byStudent.set(String(m.student), (byStudent.get(String(m.student)) ?? 0) + m.obtainedMarks);
  const students = await Student.find({ _id: { $in: [...byStudent.keys()] } }).select("firstName lastName admissionNumber").lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const gradeDistribution: Record<string, number> = {};
  const rows = [...byStudent.entries()].map(([sid, obtained]) => {
    const pct = totalMax ? Math.round((obtained / totalMax) * 10000) / 100 : 0;
    const g = gradeFor(pct, scale as never);
    const grade = g?.grade ?? "—";
    gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;
    return { student: studentName(byId.get(sid)), obtained: Math.round(obtained * 100) / 100, totalMax, percentage: pct, grade };
  }).sort((a, b) => b.percentage - a.percentage);
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r.percentage, 0) / rows.length) * 100) / 100 : 0;
  return {
    columns: [{ key: "student", label: "Student" }, { key: "obtained", label: "Marks obtained" }, { key: "totalMax", label: "Total max" }, { key: "percentage", label: "%" }, { key: "grade", label: "Grade" }],
    rows,
    summary: { exam: exam.name, resultStatus: exam.resultStatus, studentsWithMarks: rows.length, averagePercent: avg, highestPercent: rows[0]?.percentage ?? 0, gradeDistribution },
    note: "Staff-only report (§27): figures are computed from entered marks regardless of publication status; students/parents still only see published results through the results endpoints.",
  };
}

/* ---------------- Fee collection + defaulters ---------------- */
async function feeCollectionReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { status: "verified", ...dateRange(f, "verifiedAt") };
  const byMethod = await Payment.aggregate<{ _id: string; count: number; total: number }>([
    { $match: filter }, { $group: { _id: "$method", count: { $sum: 1 }, total: { $sum: "$amount" } } }, { $sort: { total: -1 } },
  ]);
  const rows = byMethod.map((g) => ({ method: g._id, payments: g.count, collectedMinor: g.total }));
  const pending = await Payment.countDocuments({ status: "pending-verification" });
  return {
    columns: [{ key: "method", label: "Method" }, { key: "payments", label: "Verified payments" }, { key: "collectedMinor", label: "Collected (minor units)" }],
    rows, summary: { totalCollectedMinor: rows.reduce((a, r) => a + (r.collectedMinor as number), 0), pendingVerification: pending },
    note: "Income rule (§12): only VERIFIED payments count as fee income; amounts are integer minor units.",
  };
}
async function defaultersReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { status: { $ne: "cancelled" }, dueDate: { $lt: new Date() } };
  if (f.sessionId) filter.session = f.sessionId;
  const invoices = await Invoice.find(filter).sort({ dueDate: 1 }).limit(1000).lean();
  const owing = invoices.map((inv) => ({ inv, balance: inv.totalDue - inv.amountPaid })).filter((x) => x.balance > 0);
  const students = await Student.find({ _id: { $in: owing.map((x) => String(x.inv.student)) } }).select("firstName lastName admissionNumber").lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const rows = owing.map(({ inv, balance }) => ({ student: studentName(byId.get(String(inv.student))), invoiceNumber: inv.invoiceNumber, dueDate: new Date(inv.dueDate).toISOString().slice(0, 10), totalDueMinor: inv.totalDue, paidMinor: inv.amountPaid, balanceMinor: balance }));
  return {
    columns: [{ key: "student", label: "Student" }, { key: "invoiceNumber", label: "Invoice" }, { key: "dueDate", label: "Due date" }, { key: "totalDueMinor", label: "Total due (minor)" }, { key: "paidMinor", label: "Paid (minor)" }, { key: "balanceMinor", label: "Balance (minor)" }],
    rows, summary: { defaulters: rows.length, totalOutstandingMinor: rows.reduce((a, r) => a + (r.balanceMinor as number), 0) },
  };
}

/* ---------------- Expenses + payroll summaries ---------------- */
async function expensesReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { ...dateRange(f, "date") };
  const byCategory = await Expense.aggregate<{ _id: string; count: number; total: number }>([
    { $match: filter }, { $group: { _id: "$category", count: { $sum: 1 }, total: { $sum: "$amount" } } }, { $sort: { total: -1 } },
  ]);
  const incomeFilter: Record<string, unknown> = { ...dateRange(f, "date") };
  const [otherIncomeTotal, feeIncome] = await Promise.all([
    OtherIncome.aggregate<{ total: number }>([{ $match: incomeFilter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Payment.aggregate<{ total: number }>([{ $match: { status: "verified", ...dateRange(f, "verifiedAt") } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  const rows = byCategory.map((g) => ({ category: g._id, entries: g.count, amountMinor: g.total }));
  const totalExpenses = rows.reduce((a, r) => a + (r.amountMinor as number), 0);
  const totalIncome = (otherIncomeTotal[0]?.total ?? 0) + (feeIncome[0]?.total ?? 0);
  return {
    columns: [{ key: "category", label: "Expense category" }, { key: "entries", label: "Entries" }, { key: "amountMinor", label: "Amount (minor units)" }],
    rows, summary: { totalExpensesMinor: totalExpenses, totalIncomeMinor: totalIncome, netMinor: totalIncome - totalExpenses },
    note: "Income = verified fee payments + other income records (§12 income rule). Payroll is reported separately and not double-counted here.",
  };
}
async function payrollSummaryReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = {};
  if (f.month) filter.month = f.month;
  if (f.year) filter.year = f.year;
  const runs = await PayrollRun.find(filter).sort({ year: -1, month: -1 }).limit(1000).lean();
  const rows = runs.map((r) => ({ employee: r.employeeName, month: r.month, year: r.year, grossMinor: r.gross, deductionsMinor: r.deductionsTotal, netMinor: r.net, status: r.status }));
  return {
    columns: [{ key: "employee", label: "Employee" }, { key: "month", label: "Month" }, { key: "year", label: "Year" }, { key: "grossMinor", label: "Gross (minor)" }, { key: "deductionsMinor", label: "Deductions (minor)" }, { key: "netMinor", label: "Net (minor)" }, { key: "status", label: "Status" }],
    rows,
    summary: { runs: rows.length, totalNetMinor: rows.reduce((a, r) => a + (r.netMinor as number), 0), paidRuns: rows.filter((r) => r.status === "paid").length, draftRuns: rows.filter((r) => r.status !== "paid").length },
    note: "Salary data (§13): this report is Admin/Accountant only, per the Phase 7 payroll rules.",
  };
}

/* ---------------- Library / transport / inventory ---------------- */
async function libraryUsageReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { ...dateRange(f, "issueDate") };
  const byBook = await BookIssue.aggregate<{ _id: mongoose.Types.ObjectId; issues: number; fines: number }>([
    { $match: filter }, { $group: { _id: "$book", issues: { $sum: 1 }, fines: { $sum: "$fineAmount" } } }, { $sort: { issues: -1 } }, { $limit: 100 },
  ]);
  const books = await Book.find({ _id: { $in: byBook.map((b) => b._id) } }).select("title author").lean();
  const byId = new Map(books.map((b) => [String(b._id), b]));
  const rows = byBook.map((b) => ({ book: byId.get(String(b._id)) ? `${byId.get(String(b._id))!.title} — ${byId.get(String(b._id))!.author}` : String(b._id), issues: b.issues, finesMinor: b.fines }));
  const now = new Date();
  const [totalCopies, availableCopies, openIssues, overdue] = await Promise.all([
    BookCopy.countDocuments({}), BookCopy.countDocuments({ status: "available" }),
    BookIssue.countDocuments({ returnDate: { $exists: false } }),
    BookIssue.countDocuments({ returnDate: { $exists: false }, dueDate: { $lt: now } }),
  ]);
  const fines = await BookIssue.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$fineAmount" } } }]);
  return {
    columns: [{ key: "book", label: "Book" }, { key: "issues", label: "Times issued" }, { key: "finesMinor", label: "Fines (minor units)" }],
    rows, summary: { totalCopies, availableCopies, openIssues, overdueIssues: overdue, totalFinesMinor: fines[0]?.total ?? 0 },
  };
}
async function transportReport(_actor: Actor, f: ReportFilters) {
  const filter: Record<string, unknown> = { status: "active" };
  if (f.sessionId) filter.session = f.sessionId;
  const grouped = await TransportAllocation.aggregate<{ _id: { r: mongoose.Types.ObjectId; b: mongoose.Types.ObjectId }; count: number }>([
    { $match: filter }, { $group: { _id: { r: "$route", b: "$bus" }, count: { $sum: 1 } } }, { $sort: { count: -1 } },
  ]);
  const [routes, buses] = await Promise.all([TransportRoute.find({}).select("name").lean(), Bus.find({}).select("name capacity").lean()]);
  const rName = new Map(routes.map((r) => [String(r._id), r.name]));
  const bInfo = new Map(buses.map((b) => [String(b._id), b]));
  const rows = grouped.map((g) => { const bus = bInfo.get(String(g._id.b)); return { route: rName.get(String(g._id.r)) ?? String(g._id.r), bus: bus?.name ?? String(g._id.b), capacity: bus?.capacity ?? 0, allocated: g.count, seatsFree: (bus?.capacity ?? 0) - g.count }; });
  return {
    columns: [{ key: "route", label: "Route" }, { key: "bus", label: "Bus" }, { key: "capacity", label: "Capacity" }, { key: "allocated", label: "Students allocated" }, { key: "seatsFree", label: "Seats free" }],
    rows, summary: { totalAllocations: rows.reduce((a, r) => a + (r.allocated as number), 0), busesInUse: rows.length },
  };
}
async function inventoryStatusReport(_actor: Actor, _f: ReportFilters) {
  const items = await InventoryItem.find({}).populate({ path: "category", select: "name" }).sort({ quantityOnHand: 1 }).limit(1000).lean();
  const rows = items.map((i) => ({ item: i.name, category: (i.category as unknown as { name?: string })?.name ?? "", unit: i.unit, quantityOnHand: i.quantityOnHand, lowStockThreshold: i.lowStockThreshold, lowStock: i.quantityOnHand <= i.lowStockThreshold ? "YES" : "no" }));
  return {
    columns: [{ key: "item", label: "Item" }, { key: "category", label: "Category" }, { key: "unit", label: "Unit" }, { key: "quantityOnHand", label: "On hand" }, { key: "lowStockThreshold", label: "Low-stock threshold" }, { key: "lowStock", label: "Low stock?" }],
    rows, summary: { totalItems: rows.length, lowStockCount: rows.filter((r) => r.lowStock === "YES").length, totalUnitsOnHand: rows.reduce((a, r) => a + (r.quantityOnHand as number), 0) },
    note: "Inventory items carry no unit-cost field, so this report is counts-based (§27: value only if cost data exists — it does not).",
  };
}

/* ---------------- Registry ---------------- */
export const REPORTS: ReportDef[] = [
  { key: "enrollment", title: "Enrollment Summary & Class Distribution", roles: STAFF_REPORT, build: enrollmentReport },
  { key: "student-attendance", title: "Student Attendance Summary", roles: ["admin", "principal", "teacher"], build: studentAttendanceReport },
  { key: "staff-attendance", title: "Staff Attendance Summary", roles: STAFF_REPORT, build: staffAttendanceReport },
  { key: "admissions", title: "Admission Statistics", roles: ["admin", "principal", "receptionist"], build: admissionsReport },
  { key: "academic-performance", title: "Academic Performance (per exam)", roles: ["admin", "principal", "teacher"], build: academicPerformanceReport },
  { key: "fee-collection", title: "Fee Collection (verified payments)", roles: FINANCE_REPORT, build: feeCollectionReport },
  { key: "defaulters", title: "Fee Defaulters (overdue balances)", roles: FINANCE_REPORT, build: defaultersReport },
  { key: "expenses", title: "Expenses & Income Summary", roles: FINANCE_REPORT, build: expensesReport },
  { key: "payroll-summary", title: "Payroll Summary", roles: ["admin", "accountant"], build: payrollSummaryReport },
  { key: "library-usage", title: "Library Usage", roles: ["admin", "principal", "librarian"], build: libraryUsageReport },
  { key: "transport", title: "Transport Allocations", roles: ["admin", "principal", "accountant"], build: transportReport },
  { key: "inventory-status", title: "Inventory Status", roles: ["admin", "principal", "accountant"], build: inventoryStatusReport },
];
export const REPORT_KEYS = REPORTS.map((r) => r.key);
export function getReportDef(key: string): ReportDef | undefined { return REPORTS.find((r) => r.key === key); }

export async function runReport(actor: Actor, key: string, query: Record<string, unknown>): Promise<ReportResult> {
  const def = getReportDef(key);
  if (!def) throw new AppError(404, "REPORT_NOT_FOUND", `Unknown report key '${key}'. Available: ${REPORT_KEYS.join(", ")}`);
  if (!def.roles.includes(actor.role)) throw new AppError(403, "FORBIDDEN", `Role '${actor.role}' cannot access the '${key}' report`);
  const filters = parseFilters(query);
  const out = await def.build(actor, filters);
  return { key: def.key, title: def.title, generatedAt: new Date().toISOString(), filters: { ...filters, from: filters.from?.toISOString(), to: filters.to?.toISOString() }, ...out };
}

/** Pre-DB gate used by the routes so 404 (unknown key) and 403 (role) behave identically with or without a database. */
export function assertReportAccess(actor: Actor, key: string): ReportDef {
  const def = getReportDef(key);
  if (!def) throw new AppError(404, "REPORT_NOT_FOUND", `Unknown report key '${key}'. Available: ${REPORT_KEYS.join(", ")}`);
  if (!def.roles.includes(actor.role)) throw new AppError(403, "FORBIDDEN", `Role '${actor.role}' cannot access the '${key}' report`);
  return def;
}
export function reportCatalogue(actor: Actor) {
  return REPORTS.filter((r) => r.roles.includes(actor.role)).map((r) => ({ key: r.key, title: r.title, roles: r.roles }));
}
