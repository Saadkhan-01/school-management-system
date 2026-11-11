import { api, tokenStore } from './api';
import type { Row } from './academic';

/* Phase 7 Finance API client — mirrors backend /fees, /invoices, /payments,
 * /finance, /expenses, /payroll. MONEY: the API speaks integer MINOR units
 * everywhere (150000 = 1,500.00). Forms collect MAJOR units from the user
 * and convert with toMinor() before sending; display uses fmtMoney(). */
export type { Row };

export const toMinor = (major: string | number): number => Math.round(Number(major) * 100);
export const toMajor = (minor: unknown): string => (Number(minor ?? 0) / 100).toFixed(2);
export function fmtMoney(minor: unknown): string {
  const v = Number(minor ?? 0) / 100;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Authenticated PDF download (same pattern as the report-card PDF). */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api/v1';
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Reference data (finance-scoped) ---------- */
export async function getFinanceReferenceData(): Promise<{ sessions: Row[]; classes: Row[]; sections: Row[] }> {
  const r = await api.get('/fees/reference-data');
  return r.data.data as { sessions: Row[]; classes: Row[]; sections: Row[] };
}
export async function lookupStudents(search: string): Promise<Row[]> {
  const r = await api.get('/fees/student-lookup', { params: { search } });
  return (r.data.data.students as Row[]) ?? [];
}

/* ---------- Fee structures & scholarships ---------- */
export async function listFeeStructures(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/fees/structures', { params: { limit: 100, ...params } });
  return (r.data.data.feeStructures as Row[]) ?? [];
}
export async function createFeeStructure(body: Row): Promise<Row> {
  const r = await api.post('/fees/structures', body);
  return r.data.data.feeStructure as Row;
}
export async function updateFeeStructure(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/fees/structures/${id}`, body);
  return r.data.data.feeStructure as Row;
}
export async function deleteFeeStructure(id: string): Promise<void> { await api.delete(`/fees/structures/${id}`); }
export async function listScholarships(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/fees/scholarships', { params: { limit: 100, ...params } });
  return (r.data.data.scholarships as Row[]) ?? [];
}
export async function createScholarship(body: Row): Promise<Row> {
  const r = await api.post('/fees/scholarships', body);
  return r.data.data.scholarship as Row;
}
export async function updateScholarship(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/fees/scholarships/${id}`, body);
  return r.data.data.scholarship as Row;
}

/* ---------- Invoices ---------- */
export async function listInvoices(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/invoices', { params: { limit: 100, ...params } });
  return (r.data.data.invoices as Row[]) ?? [];
}
export async function getInvoice(id: string): Promise<Row> {
  const r = await api.get(`/invoices/${id}`);
  return r.data.data.invoice as Row;
}
export async function generateInvoice(body: Row): Promise<Row> {
  const r = await api.post('/invoices', body);
  return r.data.data.invoice as Row;
}
export async function bulkGenerateInvoices(body: Row): Promise<Row> {
  const r = await api.post('/invoices/bulk', body);
  return r.data.data as Row;
}
export async function addInvoiceAdjustment(id: string, body: Row): Promise<Row> {
  const r = await api.post(`/invoices/${id}/adjustments`, body);
  return r.data.data.invoice as Row;
}
export async function applyLateFee(id: string): Promise<Row> {
  const r = await api.post(`/invoices/${id}/apply-late-fee`);
  return r.data.data.invoice as Row;
}
export async function cancelInvoice(id: string, reason: string): Promise<Row> {
  const r = await api.post(`/invoices/${id}/cancel`, { reason });
  return r.data.data.invoice as Row;
}

/* ---------- Payments & receipts ---------- */
export async function listPayments(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/payments', { params: { limit: 100, ...params } });
  return (r.data.data.payments as Row[]) ?? [];
}
export async function submitPayment(body: Row): Promise<Row> {
  const r = await api.post('/payments', body);
  return r.data.data.payment as Row;
}
export async function verifyPayment(id: string): Promise<Row> {
  const r = await api.post(`/payments/${id}/verify`);
  return r.data.data as Row;
}
export async function rejectPayment(id: string, reason: string): Promise<Row> {
  const r = await api.post(`/payments/${id}/reject`, { reason });
  return r.data.data.payment as Row;
}
export async function reversePayment(id: string, reason: string): Promise<Row> {
  const r = await api.post(`/payments/${id}/reverse`, { reason });
  return r.data.data as Row;
}
export async function listReceipts(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/payments/receipts', { params: { limit: 100, ...params } });
  return (r.data.data.receipts as Row[]) ?? [];
}
export async function createOnlineCheckout(invoiceId: string): Promise<Row> {
  const r = await api.post('/payments/online/checkout', { invoiceId });
  return r.data.data.checkout as Row;
}

/* ---------- Finance: expenses, income, summary, dashboards ---------- */
export async function listExpenses(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/expenses', { params: { limit: 100, ...params } });
  return (r.data.data.expenses as Row[]) ?? [];
}
export async function createExpense(body: Row): Promise<Row> {
  const r = await api.post('/expenses', body);
  return r.data.data.expense as Row;
}
export async function updateExpense(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/expenses/${id}`, body);
  return r.data.data.expense as Row;
}
export async function listIncome(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/finance/income', { params: { limit: 100, ...params } });
  return (r.data.data.income as Row[]) ?? [];
}
export async function createIncome(body: Row): Promise<Row> {
  const r = await api.post('/finance/income', body);
  return r.data.data.income as Row;
}
export async function updateIncome(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/finance/income/${id}`, body);
  return r.data.data.income as Row;
}
export async function getFinanceSummary(): Promise<Row> {
  const r = await api.get('/finance/summary');
  return r.data.data.summary as Row;
}
export async function getAccountantDashboard(): Promise<Row> {
  const r = await api.get('/finance/dashboard/accountant');
  return r.data.data.stats as Row;
}
export async function getPrincipalFees(): Promise<Row> {
  const r = await api.get('/finance/dashboard/principal');
  return r.data.data.stats as Row;
}

/* ---------- Payroll ---------- */
export async function getPayrollEmployees(): Promise<{ teachers: Row[]; staff: Row[] }> {
  const r = await api.get('/payroll/employees');
  return r.data.data as { teachers: Row[]; staff: Row[] };
}
export async function listSalaryStructures(): Promise<Row[]> {
  const r = await api.get('/payroll/structures', { params: { limit: 100 } });
  return (r.data.data.salaryStructures as Row[]) ?? [];
}
export async function createSalaryStructure(body: Row): Promise<Row> {
  const r = await api.post('/payroll/structures', body);
  return r.data.data.salaryStructure as Row;
}
export async function updateSalaryStructure(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/payroll/structures/${id}`, body);
  return r.data.data.salaryStructure as Row;
}
export async function generatePayroll(body: Row): Promise<Row> {
  const r = await api.post('/payroll/runs/generate', body);
  return r.data.data as Row;
}
export async function listPayrollRuns(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/payroll/runs', { params: { limit: 100, ...params } });
  return (r.data.data.payrollRuns as Row[]) ?? [];
}
export async function markPayrollPaid(id: string): Promise<Row> {
  const r = await api.post(`/payroll/runs/${id}/mark-paid`, {});
  return r.data.data.payrollRun as Row;
}
