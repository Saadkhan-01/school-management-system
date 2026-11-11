import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { type Actor } from "../academic-scope";
import { TeacherProfile } from "../teachers/teacher.model";
import { StaffProfile } from "../staff/staff.model";
import { User } from "../users/user.model";
import { SalaryStructure, PayrollRun, computeSalary, type IPayrollRun, type SalaryComponent } from "./payroll.model";

/**
 * Payroll service (§13). Access rules (docs/permissions.md, "Expenses/
 * payroll" row): Admin ●, Accountant ●, Principal ◐ summaries only (the
 * finance dashboard — NOT salary structures or individual runs), Teacher ◐
 * own payslip only. The route layer gates the management endpoints to
 * Admin/Accountant; the read functions below additionally scope every
 * non-manager caller to their OWN employeeUser.
 */

const STRUCTURE_POPULATE = [
  { path: "employeeUser", select: "name email role" },
  { path: "teacherProfile", select: "employeeId" },
  { path: "staffProfile", select: "employeeId department designation" },
];
const RUN_POPULATE = [
  { path: "employeeUser", select: "name email role" },
  { path: "paidBy", select: "name email role" },
  { path: "generatedBy", select: "name email role" },
];

/**
 * Minimal employee directory for the payroll forms (Admin/Accountant only at
 * the route layer). The general /teachers and /staff reads are Admin +
 * Principal-read per the matrix, which would lock Accountant out of §13
 * work; this exposes only id + employeeId + name for structure creation.
 */
export async function payrollEmployees() {
  const [teachers, staff] = await Promise.all([
    TeacherProfile.find({ isActive: true }).populate({ path: "user", select: "name email" }).select("employeeId user").lean(),
    StaffProfile.find({ employmentStatus: "active" }).populate({ path: "user", select: "name email" }).select("employeeId department designation user").lean(),
  ]);
  return {
    teachers: teachers.map((t) => ({ id: String(t._id), employeeId: t.employeeId, name: (t.user as { name?: string } | null)?.name ?? "", kind: "teacher" as const })),
    staff: staff.map((s) => ({ id: String(s._id), employeeId: s.employeeId, name: (s.user as { name?: string } | null)?.name ?? "", department: s.department, designation: s.designation, kind: "staff" as const })),
  };
}

/* ---------------- Salary structures (Admin/Accountant only) ---------------- */

export async function createSalaryStructure(actor: Actor, input: { teacherId?: string; staffId?: string; baseSalary: number; allowances?: SalaryComponent[]; deductions?: SalaryComponent[]; isActive?: boolean }) {
  void actor;
  let employeeUser: string;
  let employeeName: string;
  let teacherProfile: string | undefined;
  let staffProfile: string | undefined;
  if (input.teacherId) {
    const profile = await TeacherProfile.findById(input.teacherId).populate({ path: "user", select: "name" }).lean();
    if (!profile) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher profile not found");
    teacherProfile = String(profile._id);
    employeeUser = String((profile as { user: { _id?: unknown } | string }).user instanceof Object && (profile as { user: { _id?: unknown } }).user?._id ? (profile as { user: { _id: unknown } }).user._id : profile.user);
    employeeName = ((profile as { user?: { name?: string } }).user?.name) ?? "";
    const clash = await SalaryStructure.findOne({ teacherProfile }).select("_id").lean();
    if (clash) throw new AppError(409, "STRUCTURE_EXISTS", "This teacher already has a salary structure — update it instead");
  } else {
    const profile = await StaffProfile.findById(input.staffId).populate({ path: "user", select: "name" }).lean();
    if (!profile) throw new AppError(404, "STAFF_NOT_FOUND", "Staff profile not found");
    staffProfile = String(profile._id);
    employeeUser = String((profile as { user: { _id?: unknown } | string }).user instanceof Object && (profile as { user: { _id?: unknown } }).user?._id ? (profile as { user: { _id: unknown } }).user._id : profile.user);
    employeeName = ((profile as { user?: { name?: string } }).user?.name) ?? "";
  }
  if (!employeeName) {
    const user = await User.findById(employeeUser).select("name").lean();
    employeeName = user?.name ?? "Employee";
  }
  const allowances = input.allowances ?? [];
  const deductions = input.deductions ?? [];
  const calc = computeSalary(input.baseSalary, allowances, deductions);
  if (calc.net < 0) throw new AppError(422, "NEGATIVE_NET_SALARY", "Deductions exceed base salary + allowances; net salary cannot be negative");
  try {
    const doc = await SalaryStructure.create({
      teacherProfile, staffProfile, employeeUser, employeeName,
      baseSalary: input.baseSalary, allowances, deductions,
      allowancesTotal: calc.allowancesTotal, deductionsTotal: calc.deductionsTotal, netSalary: calc.net,
      isActive: input.isActive ?? true,
    });
    return SalaryStructure.findById(doc._id).populate(STRUCTURE_POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "STRUCTURE_EXISTS", "This employee already has a salary structure — update it instead");
    throw err;
  }
}

export async function listSalaryStructures(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (query.isActive === "true" || query.isActive === "false") filter.isActive = query.isActive === "true";
  const [items, total] = await Promise.all([
    SalaryStructure.find(filter).populate(STRUCTURE_POPULATE).sort({ employeeName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    SalaryStructure.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateSalaryStructure(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Salary structure");
  const existing = await SalaryStructure.findById(id);
  if (!existing) throw new AppError(404, "STRUCTURE_NOT_FOUND", "Salary structure not found");
  const patch = definedOnly(input as Record<string, unknown>);
  const baseSalary = (patch.baseSalary as number | undefined) ?? existing.baseSalary;
  const allowances = (patch.allowances as SalaryComponent[] | undefined) ?? existing.allowances;
  const deductions = (patch.deductions as SalaryComponent[] | undefined) ?? existing.deductions;
  const calc = computeSalary(baseSalary, allowances, deductions);
  if (calc.net < 0) throw new AppError(422, "NEGATIVE_NET_SALARY", "Deductions exceed base salary + allowances; net salary cannot be negative");
  const doc = await SalaryStructure.findByIdAndUpdate(id, {
    $set: { ...patch, allowancesTotal: calc.allowancesTotal, deductionsTotal: calc.deductionsTotal, netSalary: calc.net },
  }, { new: true, runValidators: true });
  return SalaryStructure.findById(doc!._id).populate(STRUCTURE_POPULATE).lean();
}

/* ---------------- Payroll runs ---------------- */

/**
 * Generate one month's payroll from all ACTIVE salary structures.
 * Idempotent per employee+month: existing runs are skipped and counted
 * (unique index backs this), so re-running a month never duplicates or
 * overwrites a payslip — a structure edited later does not rewrite history.
 */
export async function generatePayroll(actor: Actor, input: { month: number; year: number; note?: string }) {
  const structures = await SalaryStructure.find({ isActive: true }).lean();
  let created = 0;
  let skipped = 0;
  const runs: string[] = [];
  for (const s of structures) {
    const existing = await PayrollRun.findOne({ employeeUser: s.employeeUser, month: input.month, year: input.year }).select("_id").lean();
    if (existing) { skipped++; continue; }
    const calc = computeSalary(s.baseSalary, s.allowances, s.deductions);
    let employeeIdLabel: string | undefined;
    if (s.teacherProfile) employeeIdLabel = (await TeacherProfile.findById(s.teacherProfile).select("employeeId").lean())?.employeeId;
    if (s.staffProfile) employeeIdLabel = (await StaffProfile.findById(s.staffProfile).select("employeeId").lean())?.employeeId;
    try {
      const run = await PayrollRun.create({
        salaryStructure: s._id,
        employeeUser: s.employeeUser,
        employeeName: s.employeeName,
        employeeIdLabel,
        month: input.month,
        year: input.year,
        baseSalary: s.baseSalary,
        allowances: s.allowances,
        deductions: s.deductions,
        allowancesTotal: calc.allowancesTotal,
        deductionsTotal: calc.deductionsTotal,
        gross: calc.gross,
        net: calc.net,
        status: "draft",
        generatedBy: actor.id,
        note: input.note,
      });
      created++;
      runs.push(String(run._id));
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) { skipped++; continue; }
      throw err;
    }
  }
  return { created, skipped, totalStructures: structures.length, month: input.month, year: input.year, runIds: runs };
}

export async function listPayrollRuns(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  // Non-managers only ever see their own runs — the filter is forced, a
  // client-supplied employee filter can never widen it.
  if (actor.role !== "admin" && actor.role !== "accountant") filter.employeeUser = actor.id;
  else if (typeof query.employeeUserId === "string" && query.employeeUserId) filter.employeeUser = query.employeeUserId;
  if (typeof query.month === "string" && query.month) filter.month = Number(query.month);
  if (typeof query.year === "string" && query.year) filter.year = Number(query.year);
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    PayrollRun.find(filter).populate(RUN_POPULATE).sort({ year: -1, month: -1, employeeName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    PayrollRun.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function mustRun(id: string): Promise<IPayrollRun> {
  requireObjectId(id, "Payroll run");
  const run = await PayrollRun.findById(id);
  if (!run) throw new AppError(404, "PAYROLL_RUN_NOT_FOUND", "Payroll run not found");
  return run;
}

/** Payslip data — managers any run; everyone else ONLY their own (403 otherwise). */
export async function getPayslipData(actor: Actor, runId: string) {
  const run = await mustRun(runId);
  if (actor.role !== "admin" && actor.role !== "accountant" && String(run.employeeUser) !== actor.id) {
    throw new AppError(403, "FORBIDDEN", "You can only access your own payslip");
  }
  const populated = await PayrollRun.findById(run._id).populate(RUN_POPULATE).lean();
  return populated as unknown as Record<string, unknown> & { month: number; year: number; employeeName: string };
}

export async function markRunPaid(actor: Actor, runId: string, note?: string) {
  const run = await mustRun(runId);
  if (run.status === "paid") throw new AppError(409, "ALREADY_PAID", "This payroll run has already been marked paid");
  run.status = "paid";
  run.paidAt = new Date();
  run.paidBy = actor.id as never;
  if (note) run.note = run.note ? `${run.note} · ${note}` : note;
  await run.save();
  return PayrollRun.findById(run._id).populate(RUN_POPULATE).lean();
}
