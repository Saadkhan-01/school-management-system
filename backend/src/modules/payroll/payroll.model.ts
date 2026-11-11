import mongoose, { Schema, type Document } from "mongoose";

/**
 * HR & Payroll (§13, §29 payroll) — Phase 7.
 * Money convention: integer minor units (see fee.model.ts).
 *
 * A SalaryStructure belongs to exactly ONE employee profile — a
 * TeacherProfile XOR a StaffProfile — and its unique sparse indexes make a
 * second structure for the same person impossible. Net salary is computed
 * server-side: base + Σ allowances − Σ deductions (never submitted).
 * A PayrollRun is one employee's payslip for one month: unique
 * (employeeUser, month, year) so monthly generation can be re-run safely —
 * existing runs are skipped, never duplicated or overwritten. Runs move
 * draft → paid (paidAt/paidBy recorded); paid runs are never deleted.
 * Salary data is restricted (see payroll.routes.ts): Admin/Accountant
 * manage it; an employee can read ONLY their own runs/payslips.
 */

export interface SalaryComponent { label: string; amount: number }

export interface ISalaryStructure extends Document {
  teacherProfile?: mongoose.Types.ObjectId;
  staffProfile?: mongoose.Types.ObjectId;
  employeeUser: mongoose.Types.ObjectId;
  employeeName: string;
  baseSalary: number;
  allowances: SalaryComponent[];
  deductions: SalaryComponent[];
  allowancesTotal: number;
  deductionsTotal: number;
  netSalary: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const componentSchema = new Schema<SalaryComponent>({
  label: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
}, { _id: false });

const salaryStructureSchema = new Schema<ISalaryStructure>({
  teacherProfile: { type: Schema.Types.ObjectId, ref: "TeacherProfile", index: true },
  staffProfile: { type: Schema.Types.ObjectId, ref: "StaffProfile", index: true },
  employeeUser: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  employeeName: { type: String, required: true, trim: true, maxlength: 160 },
  baseSalary: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
  allowances: { type: [componentSchema], default: [] },
  deductions: { type: [componentSchema], default: [] },
  allowancesTotal: { type: Number, required: true, default: 0 },
  deductionsTotal: { type: Number, required: true, default: 0 },
  netSalary: { type: Number, required: true, default: 0 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });
salaryStructureSchema.index({ teacherProfile: 1 }, { unique: true, sparse: true, name: "one_structure_per_teacher" });
salaryStructureSchema.index({ staffProfile: 1 }, { unique: true, sparse: true, name: "one_structure_per_staff" });
export const SalaryStructure = (mongoose.models.SalaryStructure as mongoose.Model<ISalaryStructure>) || mongoose.model<ISalaryStructure>("SalaryStructure", salaryStructureSchema);

export const PAYROLL_STATUSES = ["draft", "paid"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export interface IPayrollRun extends Document {
  salaryStructure: mongoose.Types.ObjectId;
  employeeUser: mongoose.Types.ObjectId;
  employeeName: string;
  employeeIdLabel?: string;
  month: number; // 1–12
  year: number;
  baseSalary: number;
  allowances: SalaryComponent[];
  deductions: SalaryComponent[];
  allowancesTotal: number;
  deductionsTotal: number;
  gross: number;
  net: number;
  status: PayrollStatus;
  generatedBy: mongoose.Types.ObjectId;
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
const payrollRunSchema = new Schema<IPayrollRun>({
  salaryStructure: { type: Schema.Types.ObjectId, ref: "SalaryStructure", required: true, index: true },
  employeeUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  employeeName: { type: String, required: true, trim: true, maxlength: 160 },
  employeeIdLabel: { type: String, trim: true, maxlength: 60 },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  year: { type: Number, required: true, min: 2000, max: 2100, index: true },
  baseSalary: { type: Number, required: true, min: 0 },
  allowances: { type: [componentSchema], default: [] },
  deductions: { type: [componentSchema], default: [] },
  allowancesTotal: { type: Number, required: true, default: 0 },
  deductionsTotal: { type: Number, required: true, default: 0 },
  gross: { type: Number, required: true, default: 0 },
  net: { type: Number, required: true, default: 0 },
  status: { type: String, enum: PAYROLL_STATUSES, default: "draft", index: true },
  generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  paidAt: { type: Date },
  paidBy: { type: Schema.Types.ObjectId, ref: "User" },
  note: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });
payrollRunSchema.index({ employeeUser: 1, month: 1, year: 1 }, { unique: true, name: "one_run_per_employee_month" });
export const PayrollRun = (mongoose.models.PayrollRun as mongoose.Model<IPayrollRun>) || mongoose.model<IPayrollRun>("PayrollRun", payrollRunSchema);

/** Pure net computation — the ONLY place salary/run totals are derived. */
export function computeSalary(baseSalary: number, allowances: SalaryComponent[], deductions: SalaryComponent[]) {
  const allowancesTotal = allowances.reduce((s, c) => s + c.amount, 0);
  const deductionsTotal = deductions.reduce((s, c) => s + c.amount, 0);
  const gross = baseSalary + allowancesTotal;
  const net = gross - deductionsTotal;
  return { allowancesTotal, deductionsTotal, gross, net };
}
