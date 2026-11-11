import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import { refName, studentLabel, type Row } from '../../services/academic';
import {
  createExpense, createIncome, downloadPdf, fmtMoney, generatePayroll, getFinanceSummary, getPayrollEmployees,
  listExpenses, listIncome, listInvoices, listPayrollRuns, listPayments, listReceipts, listSalaryStructures,
  markPayrollPaid, rejectPayment, reversePayment, submitPayment, toMinor, updateSalaryStructure, verifyPayment,
  createSalaryStructure,
} from '../../services/finance';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { StatusBadge } from './FinancePanels';

/* Phase 7 panels part 2: payments verification, expenses/income, payroll,
 * reports summary. Same rule as part 1 — real API data only. */

const PAYMENT_BADGE: Record<string, string> = {
  'pending-verification': 'bg-amber-100 text-amber-800', verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700', reversed: 'bg-slate-200 text-slate-600', refunded: 'bg-slate-200 text-slate-600',
};
export function PaymentBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGE[status] ?? 'bg-slate-100'}`}>{status}</span>;
}

/* ---------------- Payments: verification queue, office recording, receipts ---------------- */

export function PaymentsPanel() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending-verification');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [record, setRecord] = useState({ invoiceId: '', amount: '', method: 'cash', reference: '' });
  const [openInvoices, setOpenInvoices] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      setPayments(await listPayments(params));
    } catch (e) { setBanner({ kind: 'err', text: `Could not load payments: ${apiErrorMessage(e)}` }); }
    try { setReceipts(await listReceipts()); } catch { /* surfaced via payments load when API is down */ }
    try {
      const invs = await listInvoices();
      setOpenInvoices(invs.filter((i) => Number(i.balance ?? 0) > 0 && String(i.status) !== 'cancelled'));
    } catch { /* invoice picker is optional */ }
  }, [statusFilter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    setBanner(null);
    try { await fn(); setBanner({ kind: 'ok', text: okText }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: `Action failed: ${apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <Banner banner={banner} />
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">Record an office payment</h3>
      <p className="text-sm text-slate-600">Payments recorded here (cash / bank transfer at the office) still enter as <strong>pending verification</strong> — a receipt is generated only when the payment is verified below. Nothing is ever marked paid at submission time.</p>
      <div className="grid gap-3 md:grid-cols-4 items-end">
        <div className="md:col-span-2"><label className={labelCls}>Open invoice</label><select className={inputCls} value={record.invoiceId} onChange={(e) => setRecord({ ...record, invoiceId: e.target.value })}><option value="">Select invoice…</option>{openInvoices.map((i) => <option key={i._id} value={i._id}>{String(i.invoiceNumber)} — {studentLabel(i.student)} — balance {fmtMoney(i.balance)}</option>)}</select></div>
        <div><label className={labelCls}>Amount (major units)</label><input className={inputCls} value={record.amount} onChange={(e) => setRecord({ ...record, amount: e.target.value })} /></div>
        <div><label className={labelCls}>Method</label><select className={inputCls} value={record.method} onChange={(e) => setRecord({ ...record, method: e.target.value })}><option value="cash">Cash</option><option value="bank-transfer">Bank transfer</option><option value="manual">Manual</option></select></div>
        <div className="md:col-span-3"><label className={labelCls}>Reference (optional)</label><input className={inputCls} value={record.reference} onChange={(e) => setRecord({ ...record, reference: e.target.value })} placeholder="Bank reference / receipt book no." /></div>
        <button className={btnCls} disabled={!record.invoiceId || !record.amount} onClick={() => void act(async () => {
          await submitPayment({ invoiceId: record.invoiceId, amount: toMinor(record.amount), method: record.method, ...(record.reference ? { reference: record.reference } : {}) } as unknown as Row);
          setRecord({ invoiceId: '', amount: '', method: 'cash', reference: '' });
        }, 'Payment recorded as pending verification.')}>Record payment</button>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-semibold">Payments</h3>
        <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending-verification">Awaiting verification</option><option value="">All</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="reversed">Reversed</option>
        </select>
      </div>
      {payments.length === 0 ? <p className="text-sm text-slate-500">No payments in this view (or the database is unavailable).</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Student</th><th className="pr-3">Amount</th><th className="pr-3">Method</th><th className="pr-3">Reference</th><th className="pr-3">Status</th><th className="pr-3">Reason (reject / reverse)</th><th>Actions</th></tr></thead>
          <tbody>{payments.map((p) => (<tr key={p._id} className="border-b last:border-0 align-top">
            <td className="py-2 pr-3 font-medium">{refName(p.invoice) !== '—' ? String(((p.invoice as Row)?.invoiceNumber as string) ?? '') : ''}</td>
            <td className="pr-3">{studentLabel(p.student)}</td>
            <td className="pr-3">{fmtMoney(p.amount)}</td>
            <td className="pr-3 capitalize">{String(p.method)}</td>
            <td className="pr-3">{String(p.reference ?? '—')}</td>
            <td className="pr-3"><PaymentBadge status={String(p.status)} />{p.rejectionReason ? <span className="block text-xs text-red-600 mt-1">{String(p.rejectionReason)}</span> : null}{p.reversalReason ? <span className="block text-xs text-slate-500 mt-1">Reversed: {String(p.reversalReason)}</span> : null}</td>
            <td className="pr-3"><input className="border rounded px-2 py-1 w-40" value={reasons[p._id] ?? ''} onChange={(e) => setReasons({ ...reasons, [p._id]: e.target.value })} placeholder="Required for reject/reverse" /></td>
            <td className="whitespace-nowrap">
              {String(p.status) === 'pending-verification' && (<>
                <button className={btnCls} onClick={() => void act(() => verifyPayment(p._id), 'Payment verified. A receipt was generated and the invoice balance was recomputed from verified payments.')}>Verify</button>{' '}
                <button className={ghostBtnCls} disabled={(reasons[p._id] ?? '').trim().length < 3} onClick={() => void act(() => rejectPayment(p._id, (reasons[p._id] ?? '').trim()), 'Payment rejected. The invoice was not changed.')}>Reject</button>
              </>)}
              {String(p.status) === 'verified' && (
                <button className={ghostBtnCls} disabled={(reasons[p._id] ?? '').trim().length < 3} onClick={() => void act(() => reversePayment(p._id, (reasons[p._id] ?? '').trim()), 'Payment reversed. The original record and a reversal record are kept; the receipt is void and the invoice balance has reopened.')}>Reverse</button>
              )}
            </td></tr>))}</tbody></table></div>)}
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold mb-3">Receipts (issued only for verified payments)</h3>
      {receipts.length === 0 ? <p className="text-sm text-slate-500">No receipts yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Receipt</th><th className="pr-3">Invoice</th><th className="pr-3">Student</th><th className="pr-3">Amount</th><th className="pr-3">Status</th><th>PDF</th></tr></thead>
          <tbody>{receipts.map((rc) => (<tr key={rc._id} className="border-b last:border-0">
            <td className="py-2 pr-3 font-medium">{String(rc.receiptNumber)}</td>
            <td className="pr-3">{String(((rc.invoice as Row)?.invoiceNumber as string) ?? '')}</td>
            <td className="pr-3">{studentLabel(rc.student)}</td>
            <td className="pr-3">{fmtMoney(rc.amount)}</td>
            <td className="pr-3">{rc.status === 'void' ? <span className="text-red-600 font-medium">VOID (reversed)</span> : <span className="text-green-700 font-medium">Active</span>}</td>
            <td><button className="text-brand font-medium" onClick={() => void downloadPdf(`/payments/receipts/${rc._id}/pdf`, `receipt-${String(rc.receiptNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Receipt PDF download failed.' }))}>Download</button></td>
          </tr>))}</tbody></table></div>)}
    </div>
  </div>);
}

/* ---------------- Expenses & other income ---------------- */

const EXPENSE_CATEGORIES = ['salaries', 'utilities', 'maintenance', 'supplies', 'transport', 'food', 'events', 'technology', 'rent', 'other'];
const INCOME_CATEGORIES = ['donation', 'rental', 'sale', 'grant', 'other'];

export function ExpensesPanel() {
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses');
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [income, setIncome] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ category: 'supplies', amount: '', date: '', party: '', method: 'cash', note: '' });

  const load = useCallback(async () => {
    try { setExpenses(await listExpenses()); } catch (e) { setBanner({ kind: 'err', text: `Could not load expenses: ${apiErrorMessage(e)}` }); }
    try { setIncome(await listIncome()); } catch { /* shown via expenses error when the API is down */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBanner(null);
    try {
      if (tab === 'expenses') {
        await createExpense({ category: form.category, amount: toMinor(form.amount), date: form.date, payee: form.party, method: form.method, ...(form.note ? { note: form.note } : {}) } as unknown as Row);
      } else {
        await createIncome({ category: form.category, amount: toMinor(form.amount), date: form.date, source: form.party, method: form.method, ...(form.note ? { note: form.note } : {}) } as unknown as Row);
      }
      setBanner({ kind: 'ok', text: `${tab === 'expenses' ? 'Expense' : 'Income'} recorded. Finance records are never hard-deleted — correct them by editing so the audit trail stays intact.` });
      setForm({ category: tab === 'expenses' ? 'supplies' : 'donation', amount: '', date: '', party: '', method: 'cash', note: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Save failed: ${apiErrorMessage(e)}` }); }
  };

  const rows = tab === 'expenses' ? expenses : income;
  return (<div className="space-y-4">
    <Banner banner={banner} />
    <div className="flex gap-2">
      {([['expenses', 'Expenses'], ['income', 'Other Income']] as const).map(([t, label]) => (
        <button key={t} onClick={() => { setTab(t); setForm((f) => ({ ...f, category: t === 'expenses' ? 'supplies' : 'donation' })); }} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{label}</button>
      ))}
    </div>
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">Record {tab === 'expenses' ? 'an expense' : 'other income'}</h3>
      <p className="text-sm text-slate-600">{tab === 'income' ? 'Fee income is not recorded here — it comes from verified fee payments automatically. Use this for donations, rentals and other non-fee income.' : 'Day-to-day school expenses. Salaries paid through Payroll are tracked in the Payroll module, not duplicated here.'}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div><label className={labelCls}>Category</label><select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{(tab === 'expenses' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className={labelCls}>Amount (major units)</label><input className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div><label className={labelCls}>{tab === 'expenses' ? 'Payee' : 'Source'}</label><input className={inputCls} value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></div>
        <div><label className={labelCls}>Method</label><select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="cash">Cash</option><option value="bank-transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="online">Online</option><option value="other">Other</option></select></div>
        <div><label className={labelCls}>Note (optional)</label><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      </div>
      <button className={btnCls} disabled={!form.amount || !form.date || form.party.trim().length < 2} onClick={() => void create()}>Save record</button>
    </div>
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold mb-3">{tab === 'expenses' ? 'Expenses' : 'Other income'} — latest 100</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No records yet (or the database is unavailable).</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Date</th><th className="pr-3">Category</th><th className="pr-3">{tab === 'expenses' ? 'Payee' : 'Source'}</th><th className="pr-3">Method</th><th className="pr-3">Amount</th><th>Note</th></tr></thead>
          <tbody>{rows.map((x) => (<tr key={x._id} className="border-b last:border-0">
            <td className="py-2 pr-3 whitespace-nowrap">{x.date ? new Date(String(x.date)).toLocaleDateString() : '—'}</td>
            <td className="pr-3 capitalize">{String(x.category)}</td>
            <td className="pr-3">{String(x.payee ?? x.source ?? '')}</td>
            <td className="pr-3">{String(x.method)}</td>
            <td className="pr-3">{fmtMoney(x.amount)}</td>
            <td>{String(x.note ?? '')}</td>
          </tr>))}</tbody></table></div>)}
    </div>
  </div>);
}

/* ---------------- Payroll ---------------- */

export function PayrollPanel() {
  const [structures, setStructures] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<{ teachers: Row[]; staff: Row[] }>({ teachers: [], staff: [] });
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ employee: '', base: '', allowances: '[]', deductions: '[]' });
  const [gen, setGen] = useState({ month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
  const [filter, setFilter] = useState({ month: '', year: '', status: '' });

  const load = useCallback(async () => {
    try { setStructures(await listSalaryStructures()); } catch (e) { setBanner({ kind: 'err', text: `Could not load salary structures: ${apiErrorMessage(e)}` }); }
    try {
      const params: Record<string, string> = {};
      if (filter.month) params.month = filter.month;
      if (filter.year) params.year = filter.year;
      if (filter.status) params.status = filter.status;
      setRuns(await listPayrollRuns(params));
    } catch { /* surfaced above when the API is down */ }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void getPayrollEmployees().then(setEmployees).catch(() => undefined); }, []);

  const parseComponents = (text: string): Row[] => {
    const v = JSON.parse(text) as Array<{ label: string; amount: number }>;
    if (!Array.isArray(v)) throw new Error('Components must be a JSON array');
    return v.map((c) => ({ label: String(c.label), amount: toMinor(c.amount) })) as unknown as Row[];
  };

  const createStructure = async () => {
    setBanner(null);
    try {
      const [kind, id] = form.employee.split(':');
      if (!id) throw new Error('Select an employee first.');
      await createSalaryStructure({
        ...(kind === 'teacher' ? { teacherId: id } : { staffId: id }),
        baseSalary: toMinor(form.base),
        allowances: parseComponents(form.allowances), deductions: parseComponents(form.deductions),
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Salary structure saved. Net salary was computed by the server (base + allowances − deductions).' });
      setForm({ employee: '', base: '', allowances: '[]', deductions: '[]' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Structure failed: ${e instanceof Error ? e.message : apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <Banner banner={banner} />
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">New salary structure</h3>
      <p className="text-sm text-slate-600">One structure per employee. Allowances/deductions are JSON arrays of {`{"label": "…", "amount": <major units>}`} — amounts are converted to minor units on save. Salary data is visible only to Admin and Accountant; employees see only their own payslips.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className={labelCls}>Employee</label><select className={inputCls} value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
          <option value="">Select employee…</option>
          <optgroup label="Teachers">{employees.teachers.map((t) => <option key={String(t.id)} value={`teacher:${String(t.id)}`}>{String(t.name)} ({String(t.employeeId)})</option>)}</optgroup>
          <optgroup label="Staff">{employees.staff.map((s) => <option key={String(s.id)} value={`staff:${String(s.id)}`}>{String(s.name)} ({String(s.employeeId)}) — {String(s.designation ?? '')}</option>)}</optgroup>
        </select></div>
        <div><label className={labelCls}>Base salary (major units)</label><input className={inputCls} value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} /></div>
        <div><label className={labelCls}>Allowances — JSON</label><textarea rows={3} className={`${inputCls} font-mono text-xs`} value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} spellCheck={false} /></div>
        <div><label className={labelCls}>Deductions — JSON</label><textarea rows={3} className={`${inputCls} font-mono text-xs`} value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} spellCheck={false} /></div>
      </div>
      <button className={btnCls} disabled={!form.employee || !form.base} onClick={() => void createStructure()}>Save salary structure</button>
      {structures.length > 0 && (<div className="overflow-x-auto pt-2"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Employee</th><th className="pr-3">Base</th><th className="pr-3">Allowances</th><th className="pr-3">Deductions</th><th className="pr-3">Net</th><th className="pr-3">Active</th><th>Action</th></tr></thead>
        <tbody>{structures.map((s) => (<tr key={s._id} className="border-b last:border-0">
          <td className="py-2 pr-3 font-medium">{refName(s.employeeUser) !== '—' ? refName(s.employeeUser) : String(s.employeeName ?? '')}</td>
          <td className="pr-3">{fmtMoney(s.baseSalary)}</td><td className="pr-3">{fmtMoney(s.allowancesTotal)}</td><td className="pr-3">{fmtMoney(s.deductionsTotal)}</td><td className="pr-3 font-medium">{fmtMoney(s.netSalary)}</td>
          <td className="pr-3">{s.isActive ? 'Active' : 'Inactive'}</td>
          <td><button className="text-brand font-medium" onClick={async () => { try { await updateSalaryStructure(s._id, { isActive: !s.isActive } as unknown as Row); await load(); } catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); } }}>{s.isActive ? 'Deactivate' : 'Activate'}</button></td>
        </tr>))}</tbody></table></div>)}
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">Monthly payroll</h3>
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className={labelCls}>Month (1–12)</label><input type="number" min={1} max={12} className={inputCls} value={gen.month} onChange={(e) => setGen({ ...gen, month: e.target.value })} /></div>
        <div><label className={labelCls}>Year</label><input type="number" className={inputCls} value={gen.year} onChange={(e) => setGen({ ...gen, year: e.target.value })} /></div>
        <button className={btnCls} onClick={async () => {
          setBanner(null);
          try {
            const out = await generatePayroll({ month: Number(gen.month), year: Number(gen.year) } as unknown as Row);
            setBanner({ kind: 'ok', text: `Payroll for ${gen.month}/${gen.year}: ${String(out.created)} runs created, ${String(out.skipped)} skipped (already generated — re-running never duplicates a payslip).` });
            await load();
          } catch (e) { setBanner({ kind: 'err', text: `Generation failed: ${apiErrorMessage(e)}` }); }
        }}>Generate payroll</button>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className={labelCls}>Filter month</label><input className={inputCls} value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} placeholder="e.g. 11" /></div>
        <div><label className={labelCls}>Filter year</label><input className={inputCls} value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })} placeholder="e.g. 2026" /></div>
        <div><label className={labelCls}>Status</label><select className={inputCls} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">All</option><option value="draft">Draft</option><option value="paid">Paid</option></select></div>
      </div>
      {runs.length === 0 ? <p className="text-sm text-slate-500">No payroll runs match.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Employee</th><th className="pr-3">Period</th><th className="pr-3">Gross</th><th className="pr-3">Deductions</th><th className="pr-3">Net</th><th className="pr-3">Status</th><th>Actions</th></tr></thead>
          <tbody>{runs.map((run) => (<tr key={run._id} className="border-b last:border-0">
            <td className="py-2 pr-3 font-medium">{String(run.employeeName)}{run.employeeIdLabel ? ` (${String(run.employeeIdLabel)})` : ''}</td>
            <td className="pr-3">{String(run.month)}/{String(run.year)}</td>
            <td className="pr-3">{fmtMoney(run.gross)}</td><td className="pr-3">{fmtMoney(run.deductionsTotal)}</td><td className="pr-3 font-medium">{fmtMoney(run.net)}</td>
            <td className="pr-3"><StatusBadge status={String(run.status) === 'paid' ? 'paid' : 'unpaid'} /> <span className="capitalize">{String(run.status)}</span>{run.paidAt ? <span className="block text-xs text-slate-500">{new Date(String(run.paidAt)).toLocaleDateString()}</span> : null}</td>
            <td className="whitespace-nowrap">
              {String(run.status) === 'draft' && <button className={`${btnCls} mr-2`} onClick={async () => { try { await markPayrollPaid(run._id); await load(); } catch (e) { setBanner({ kind: 'err', text: `Mark paid failed: ${apiErrorMessage(e)}` }); } }}>Mark paid</button>}
              <button className="text-brand font-medium" onClick={() => void downloadPdf(`/payroll/runs/${run._id}/payslip-pdf`, `payslip-${String(run.year)}-${String(run.month)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Payslip download failed.' }))}>Payslip PDF</button>
            </td></tr>))}</tbody></table></div>)}
    </div>
  </div>);
}

/* ---------------- Reports summary ---------------- */

export function ReportsSummaryPanel() {
  const [summary, setSummary] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getFinanceSummary().then(setSummary).catch((e) => setError(`Could not load the finance summary: ${apiErrorMessage(e)}`)); }, []);
  if (error) return <Banner banner={{ kind: 'err', text: error }} />;
  if (!summary) return <p className="text-sm text-slate-500">Loading summary…</p>;
  const windows = [['daily', 'Today'], ['monthly', 'This month'], ['yearly', 'This year']] as const;
  return (<div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
    <h3 className="font-semibold">Income vs expenses (§27 finance reports)</h3>
    <p className="text-sm text-slate-600">{String(summary.incomeRule ?? '')}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Window</th><th className="pr-3">Fee income (verified)</th><th className="pr-3">Other income</th><th className="pr-3">Total income</th><th className="pr-3">Expenses</th><th>Net</th></tr></thead>
      <tbody>{windows.map(([key, label]) => {
        const w = (summary[key] as Row) ?? {};
        return (<tr key={key} className="border-b last:border-0"><td className="py-2 pr-3 font-medium">{label}</td><td className="pr-3">{fmtMoney(w.feeIncome)}</td><td className="pr-3">{fmtMoney(w.otherIncome)}</td><td className="pr-3">{fmtMoney(w.totalIncome)}</td><td className="pr-3">{fmtMoney(w.expenses)}</td><td className="font-medium">{fmtMoney(w.net)}</td></tr>);
      })}</tbody></table></div>
    <p className="text-xs text-slate-500">Full export suite (PDF/Excel/CSV report files) is Phase 9; these figures are the same live aggregates the dashboards use.</p>
  </div>);
}
