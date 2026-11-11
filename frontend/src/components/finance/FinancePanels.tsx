import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import { refName, studentLabel, type Row } from '../../services/academic';
import {
  addInvoiceAdjustment, applyLateFee, bulkGenerateInvoices, cancelInvoice, createFeeStructure, createScholarship,
  deleteFeeStructure, downloadPdf, fmtMoney, generateInvoice, getAccountantDashboard, getFinanceReferenceData,
  getInvoice, getPrincipalFees, listFeeStructures, listInvoices, listScholarships, lookupStudents, toMajor, toMinor,
  updateFeeStructure, updateScholarship,
} from '../../services/finance';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';

/* Phase 7 finance panels — shared by the Accountant portal pages and the
 * Admin Finance page (same APIs, same rules; the server enforces RBAC and
 * scope, these panels only render real responses). All amounts are entered
 * in major units and converted to the API's integer minor units. */

export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (<div className="bg-white rounded-xl shadow-sm p-4">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-xl font-bold mt-1">{value}</p>
    {note ? <p className="text-xs text-slate-500 mt-1">{note}</p> : null}
  </div>);
}

/** Accountant dashboard stats (§12) / Principal fee overview (§8) — real aggregates from /finance/dashboard/*. */
export function FinanceStatsPanel({ variant }: { variant: 'accountant' | 'principal' }) {
  const [stats, setStats] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try { setStats(variant === 'accountant' ? await getAccountantDashboard() : await getPrincipalFees()); }
      catch (e) { setError(`Could not load finance statistics: ${apiErrorMessage(e)} If this is a 503, the database is not connected yet (configure MONGODB_URI).`); }
    })();
  }, [variant]);
  if (error) return <Banner banner={{ kind: 'err', text: error }} />;
  if (!stats) return <p className="text-sm text-slate-500">Loading finance statistics…</p>;
  const collections = (stats.collections as Row) ?? {};
  const fees = (stats.fees as Row) ?? {};
  const expenses = (stats.expenses as Row) ?? {};
  const payroll = (stats.payroll as Row) ?? {};
  const paidRuns = (payroll.paidRuns as Row) ?? {};
  const draftRuns = (payroll.draftRuns as Row) ?? {};
  return (<div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total fee collection (verified)" value={fmtMoney(collections.total)} note="Verified payments only — pending/rejected never count" />
      <StatCard label="Collection this month" value={fmtMoney(collections.thisMonth)} />
      <StatCard label="Pending fees (outstanding)" value={fmtMoney(fees.pendingTotal)} note={`${String(fees.openInvoices ?? 0)} open invoices`} />
      <StatCard label="Overdue invoices" value={String(fees.overdueCount ?? 0)} note={`${fmtMoney(fees.overdueTotal)} overdue`} />
      {variant === 'accountant' && (<>
        <StatCard label="Manual payments awaiting verification" value={String(stats.manualPaymentsAwaitingVerification ?? 0)} />
        <StatCard label="Expenses (total)" value={fmtMoney(expenses.total)} note={`${fmtMoney(expenses.thisMonth)} this month`} />
        <StatCard label="Payroll paid out (net)" value={fmtMoney(paidRuns.totalNet)} note={`${String(paidRuns.count ?? 0)} paid runs`} />
        <StatCard label="Payroll drafts (net)" value={fmtMoney(draftRuns.totalNet)} note={`${String(draftRuns.count ?? 0)} unpaid runs`} />
      </>)}
    </div>
    <p className="text-xs text-slate-500">All figures are live aggregates over real invoice/payment/expense records (amounts in the school currency; the API stores integer minor units). Generated {stats.generatedAt ? new Date(String(stats.generatedAt)).toLocaleString() : ''}.</p>
  </div>);
}

/* ---------------- Fee structures + scholarships ---------------- */

interface RefData { sessions: Row[]; classes: Row[]; sections: Row[] }
export function useRefData() {
  const [ref, setRef] = useState<RefData>({ sessions: [], classes: [], sections: [] });
  useEffect(() => { void getFinanceReferenceData().then(setRef).catch(() => undefined); }, []);
  return ref;
}

export function FeeStructuresPanel() {
  const ref = useRefData();
  const [structures, setStructures] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', sessionId: '', classId: '', sectionId: '', periodLabel: '', lateType: 'flat', lateValue: '0', graceDays: '0', partial: false });
  const [items, setItems] = useState<Array<{ label: string; amount: string }>>([{ label: 'Tuition fee', amount: '' }]);
  const [scholarships, setScholarships] = useState<Row[]>([]);
  const [schForm, setSchForm] = useState({ search: '', studentId: '', type: 'percent', value: '', reason: '' });
  const [found, setFound] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try { setStructures(await listFeeStructures()); } catch (e) { setBanner({ kind: 'err', text: `Could not load fee structures: ${apiErrorMessage(e)}` }); }
    try { setScholarships(await listScholarships()); } catch { /* banner already set above if the API is down */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const classes = ref.classes.filter((c) => !form.sessionId || String(c.session) === form.sessionId || String((c.session as Row)?._id ?? c.session) === form.sessionId);
  const sections = ref.sections.filter((s) => !form.classId || String((s.schoolClass as Row)?._id ?? s.schoolClass) === form.classId);

  const create = async () => {
    setBanner(null);
    try {
      const lineItems = items.filter((i) => i.label.trim() && i.amount !== '').map((i) => ({ label: i.label.trim(), amount: toMinor(i.amount) }));
      if (lineItems.length === 0) throw new Error('Add at least one line item with an amount.');
      await createFeeStructure({
        name: form.name, sessionId: form.sessionId, classId: form.classId,
        ...(form.sectionId ? { sectionId: form.sectionId } : {}),
        lineItems, periodLabel: form.periodLabel || undefined,
        lateFeePolicy: { type: form.lateType, value: form.lateType === 'percent' ? Number(form.lateValue) : toMinor(form.lateValue), graceDays: Number(form.graceDays) },
        partialPaymentsAllowed: form.partial,
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Fee structure created. Its total was computed by the server from the line items.' });
      setForm({ name: '', sessionId: '', classId: '', sectionId: '', periodLabel: '', lateType: 'flat', lateValue: '0', graceDays: '0', partial: false });
      setItems([{ label: 'Tuition fee', amount: '' }]);
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Create failed: ${e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)}` }); }
  };

  const searchStudents = async () => {
    try { setFound(await lookupStudents(schForm.search)); } catch (e) { setBanner({ kind: 'err', text: `Student lookup failed: ${apiErrorMessage(e)}` }); }
  };
  const createSch = async () => {
    setBanner(null);
    try {
      if (!schForm.studentId) throw new Error('Pick a student from the lookup results first.');
      await createScholarship({
        studentId: schForm.studentId, type: schForm.type,
        value: schForm.type === 'percent' ? Number(schForm.value) : toMinor(schForm.value),
        reason: schForm.reason,
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Scholarship recorded. It is applied automatically when an invoice is generated for this student (and can also be applied to an existing invoice as an adjustment).' });
      setSchForm({ search: '', studentId: '', type: 'percent', value: '', reason: '' }); setFound([]);
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Scholarship failed: ${e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <Banner banner={banner} />
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">New fee structure</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Fee — Class 5" /></div>
        <div><label className={labelCls}>Session</label><select className={inputCls} value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value, classId: '', sectionId: '' })}><option value="">Select session…</option>{ref.sessions.map((s) => <option key={s._id} value={s._id}>{String(s.name)}{s.isCurrent ? ' (current)' : ''}</option>)}</select></div>
        <div><label className={labelCls}>Class</label><select className={inputCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: '' })}><option value="">Select class…</option>{classes.map((c) => <option key={c._id} value={c._id}>{String(c.name)}</option>)}</select></div>
        <div><label className={labelCls}>Section (optional)</label><select className={inputCls} value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}><option value="">Whole class</option>{sections.map((s) => <option key={s._id} value={s._id}>{String(s.name)}</option>)}</select></div>
        <div><label className={labelCls}>Period label (e.g. 2026-09)</label><input className={inputCls} value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} placeholder="2026-09" /></div>
        <div><label className={labelCls}>Late fee</label><div className="flex gap-2"><select className={inputCls} value={form.lateType} onChange={(e) => setForm({ ...form, lateType: e.target.value })}><option value="flat">Flat amount</option><option value="percent">Percent of balance</option></select><input className={inputCls} value={form.lateValue} onChange={(e) => setForm({ ...form, lateValue: e.target.value })} placeholder={form.lateType === 'percent' ? '% (0–100)' : 'Amount'} /></div></div>
        <div><label className={labelCls}>Grace days</label><input type="number" min={0} className={inputCls} value={form.graceDays} onChange={(e) => setForm({ ...form, graceDays: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" checked={form.partial} onChange={(e) => setForm({ ...form, partial: e.target.checked })} /> Allow partial payments</label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Line items (amounts in major units)</p>
        {items.map((it, i) => (<div key={i} className="flex gap-2">
          <input className={inputCls} placeholder="Label — e.g. Tuition fee" value={it.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className={`${inputCls} max-w-[180px]`} placeholder="Amount" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
          <button className={ghostBtnCls} onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}>Remove</button>
        </div>))}
        <button className={ghostBtnCls} onClick={() => setItems([...items, { label: '', amount: '' }])}>+ Add line item</button>
      </div>
      <button className={btnCls} onClick={() => void create()} disabled={!form.name || !form.sessionId || !form.classId}>Create fee structure</button>
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold mb-3">Fee structures</h3>
      {structures.length === 0 ? <p className="text-sm text-slate-500">No fee structures yet (or the database is unavailable).</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Name</th><th className="pr-3">Session</th><th className="pr-3">Class / Section</th><th className="pr-3">Period</th><th className="pr-3">Total</th><th className="pr-3">Partial?</th><th className="pr-3">Active</th><th>Actions</th></tr></thead>
          <tbody>{structures.map((s) => (<tr key={s._id} className="border-b last:border-0">
            <td className="py-2 pr-3 font-medium">{String(s.name)}</td>
            <td className="pr-3">{refName(s.session)}</td>
            <td className="pr-3">{refName(s.schoolClass)}{s.section ? ` / ${refName(s.section)}` : ''}</td>
            <td className="pr-3">{String(s.periodLabel ?? '—')}</td>
            <td className="pr-3">{fmtMoney(s.totalAmount)}</td>
            <td className="pr-3">{s.partialPaymentsAllowed ? 'Yes' : 'No'}</td>
            <td className="pr-3">{s.isActive ? 'Active' : 'Inactive'}</td>
            <td className="whitespace-nowrap">
              <button className="text-brand font-medium mr-3" onClick={async () => { try { await updateFeeStructure(s._id, { isActive: !s.isActive } as unknown as Row); await load(); } catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); } }}>{s.isActive ? 'Deactivate' : 'Activate'}</button>
              <button className="text-red-600 font-medium" onClick={async () => { if (window.confirm('Delete this fee structure? Structures already used by invoices cannot be deleted (deactivate instead).')) { try { await deleteFeeStructure(s._id); await load(); } catch (e) { setBanner({ kind: 'err', text: `Delete failed: ${apiErrorMessage(e)}` }); } } }}>Delete</button>
            </td></tr>))}</tbody></table></div>)}
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">Scholarships &amp; discounts (§12)</h3>
      <p className="text-sm text-slate-600">A scholarship is applied automatically at invoice generation. It can also be applied to an existing invoice from the Invoices page (Adjustments).</p>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Search student by name or admission number…" value={schForm.search} onChange={(e) => setSchForm({ ...schForm, search: e.target.value })} />
        <button className={ghostBtnCls} onClick={() => void searchStudents()}>Search</button>
      </div>
      {found.length > 0 && (<div className="flex flex-wrap gap-2">{found.map((f) => (
        <button key={f._id} className={`px-3 py-1.5 rounded text-sm ${schForm.studentId === f._id ? 'bg-brand text-white' : 'bg-slate-100'}`} onClick={() => setSchForm({ ...schForm, studentId: f._id })}>{studentLabel(f)}</button>))}</div>)}
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={labelCls}>Type</label><select className={inputCls} value={schForm.type} onChange={(e) => setSchForm({ ...schForm, type: e.target.value })}><option value="percent">Percent off</option><option value="flat">Flat amount off</option></select></div>
        <div><label className={labelCls}>{schForm.type === 'percent' ? 'Percent (0–100)' : 'Amount (major units)'}</label><input className={inputCls} value={schForm.value} onChange={(e) => setSchForm({ ...schForm, value: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={labelCls}>Reason</label><input className={inputCls} value={schForm.reason} onChange={(e) => setSchForm({ ...schForm, reason: e.target.value })} placeholder="e.g. Merit scholarship 2026" /></div>
      </div>
      <button className={btnCls} onClick={() => void createSch()} disabled={!schForm.studentId || !schForm.value || schForm.reason.trim().length < 3}>Award scholarship</button>
      {scholarships.length > 0 && (<div className="overflow-x-auto pt-2"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="pr-3">Type</th><th className="pr-3">Value</th><th className="pr-3">Reason</th><th className="pr-3">Active</th><th>Action</th></tr></thead>
        <tbody>{scholarships.map((s) => (<tr key={s._id} className="border-b last:border-0">
          <td className="py-2 pr-3">{studentLabel(s.student)}</td>
          <td className="pr-3 capitalize">{String(s.type)}</td>
          <td className="pr-3">{s.type === 'percent' ? `${String(s.value)}%` : fmtMoney(s.value)}</td>
          <td className="pr-3">{String(s.reason)}</td>
          <td className="pr-3">{s.isActive ? 'Active' : 'Inactive'}</td>
          <td><button className="text-brand font-medium" onClick={async () => { try { await updateScholarship(s._id, { isActive: !s.isActive } as unknown as Row); await load(); } catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); } }}>{s.isActive ? 'Deactivate' : 'Activate'}</button></td>
        </tr>))}</tbody></table></div>)}
    </div>
  </div>);
}

/* ---------------- Invoices ---------------- */

const STATUS_BADGE: Record<string, string> = {
  unpaid: 'bg-slate-100 text-slate-700', 'partially-paid': 'bg-amber-100 text-amber-800', paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-700', cancelled: 'bg-slate-200 text-slate-500',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status] ?? 'bg-slate-100'}`}>{status}</span>;
}

export function InvoicesPanel() {
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [structures, setStructures] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [gen, setGen] = useState({ search: '', studentId: '', feeStructureId: '', dueDate: '', periodLabel: '' });
  const [found, setFound] = useState<Row[]>([]);
  const [bulk, setBulk] = useState({ feeStructureId: '', dueDate: '', periodLabel: '' });
  const [selected, setSelected] = useState<Row | null>(null);
  const [adj, setAdj] = useState({ label: '', amount: '', type: 'discount' });
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      setInvoices(await listInvoices(params));
    } catch (e) { setBanner({ kind: 'err', text: `Could not load invoices: ${apiErrorMessage(e)}` }); }
  }, [statusFilter, search]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void listFeeStructures().then(setStructures).catch(() => undefined); }, []);

  const openInvoice = async (id: string) => {
    try { setSelected(await getInvoice(id)); } catch (e) { setBanner({ kind: 'err', text: `Could not open invoice: ${apiErrorMessage(e)}` }); }
  };
  const generateSingle = async () => {
    setBanner(null);
    try {
      if (!gen.studentId) throw new Error('Pick a student from the lookup results first.');
      const inv = await generateInvoice({ studentId: gen.studentId, feeStructureId: gen.feeStructureId, dueDate: gen.dueDate, ...(gen.periodLabel ? { periodLabel: gen.periodLabel } : {}) } as unknown as Row);
      setBanner({ kind: 'ok', text: `Invoice ${String(inv.invoiceNumber)} generated — total due ${fmtMoney(inv.totalDue)} (computed by the server, scholarships applied automatically).` });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Generation failed: ${e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)}` }); }
  };
  const generateBulk = async () => {
    setBanner(null);
    try {
      const out = await bulkGenerateInvoices({ feeStructureId: bulk.feeStructureId, dueDate: bulk.dueDate, ...(bulk.periodLabel ? { periodLabel: bulk.periodLabel } : {}) } as unknown as Row);
      setBanner({ kind: 'ok', text: `Bulk generation finished: ${String(out.created)} created, ${String(out.skipped)} skipped (already invoiced for this structure + period), ${((out.errors as Row[]) ?? []).length} errors, out of ${String(out.totalEnrolled)} enrolled students.` });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Bulk generation failed: ${apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <Banner banner={banner} />
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h3 className="font-semibold">Generate single invoice</h3>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Search student by name / admission no…" value={gen.search} onChange={(e) => setGen({ ...gen, search: e.target.value })} />
          <button className={ghostBtnCls} onClick={async () => { try { setFound(await lookupStudents(gen.search)); } catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); } }}>Search</button>
        </div>
        {found.length > 0 && (<div className="flex flex-wrap gap-2">{found.map((f) => (
          <button key={f._id} className={`px-3 py-1.5 rounded text-sm ${gen.studentId === f._id ? 'bg-brand text-white' : 'bg-slate-100'}`} onClick={() => setGen({ ...gen, studentId: f._id })}>{studentLabel(f)}</button>))}</div>)}
        <div><label className={labelCls}>Fee structure</label><select className={inputCls} value={gen.feeStructureId} onChange={(e) => setGen({ ...gen, feeStructureId: e.target.value })}><option value="">Select structure…</option>{structures.map((s) => <option key={s._id} value={s._id}>{String(s.name)} — {fmtMoney(s.totalAmount)}{s.isActive ? '' : ' (inactive)'}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Due date</label><input type="date" className={inputCls} value={gen.dueDate} onChange={(e) => setGen({ ...gen, dueDate: e.target.value })} /></div>
          <div><label className={labelCls}>Period label (optional)</label><input className={inputCls} value={gen.periodLabel} onChange={(e) => setGen({ ...gen, periodLabel: e.target.value })} placeholder="Defaults to the structure's" /></div>
        </div>
        <button className={btnCls} onClick={() => void generateSingle()} disabled={!gen.studentId || !gen.feeStructureId || !gen.dueDate}>Generate invoice</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h3 className="font-semibold">Bulk generate for a class</h3>
        <p className="text-sm text-slate-600">Creates an invoice for every actively-enrolled student in the structure's class/section. Students who already have an invoice for the same structure + period are skipped — never duplicated.</p>
        <div><label className={labelCls}>Fee structure</label><select className={inputCls} value={bulk.feeStructureId} onChange={(e) => setBulk({ ...bulk, feeStructureId: e.target.value })}><option value="">Select structure…</option>{structures.map((s) => <option key={s._id} value={s._id}>{String(s.name)} — {refName(s.schoolClass)}{s.section ? ` / ${refName(s.section)}` : ''}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Due date</label><input type="date" className={inputCls} value={bulk.dueDate} onChange={(e) => setBulk({ ...bulk, dueDate: e.target.value })} /></div>
          <div><label className={labelCls}>Period label (optional)</label><input className={inputCls} value={bulk.periodLabel} onChange={(e) => setBulk({ ...bulk, periodLabel: e.target.value })} /></div>
        </div>
        <button className={btnCls} onClick={() => void generateBulk()} disabled={!bulk.feeStructureId || !bulk.dueDate}>Bulk generate</button>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="font-semibold">Invoices</h3>
        <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option><option value="unpaid">Unpaid</option><option value="partially-paid">Partially paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
        </select>
        <input className="border rounded px-3 py-1.5 text-sm" placeholder="Search invoice number…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices match (or the database is unavailable).</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Student</th><th className="pr-3">Due</th><th className="pr-3">Total due</th><th className="pr-3">Paid (verified)</th><th className="pr-3">Balance</th><th className="pr-3">Status</th><th>Actions</th></tr></thead>
          <tbody>{invoices.map((inv) => (<tr key={inv._id} className="border-b last:border-0">
            <td className="py-2 pr-3 font-medium">{String(inv.invoiceNumber)}</td>
            <td className="pr-3">{studentLabel(inv.student)}</td>
            <td className="pr-3 whitespace-nowrap">{inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString() : '—'}</td>
            <td className="pr-3">{fmtMoney(inv.totalDue)}</td>
            <td className="pr-3">{fmtMoney(inv.amountPaid)}</td>
            <td className="pr-3">{fmtMoney(inv.balance)}</td>
            <td className="pr-3"><StatusBadge status={String(inv.status)} /></td>
            <td className="whitespace-nowrap">
              <button className="text-brand font-medium mr-3" onClick={() => void openInvoice(inv._id)}>Details</button>
              <button className="text-brand font-medium" onClick={() => void downloadPdf(`/invoices/${inv._id}/challan-pdf`, `challan-${String(inv.invoiceNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Challan PDF download failed.' }))}>Challan PDF</button>
            </td></tr>))}</tbody></table></div>)}
    </div>

    {selected && (<div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Invoice {String(selected.invoiceNumber)} — {studentLabel(selected.student)}</h3>
        <button className={ghostBtnCls} onClick={() => setSelected(null)}>Close</button>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>Subtotal: <strong>{fmtMoney(selected.subtotal)}</strong> · Total due: <strong>{fmtMoney(selected.totalDue)}</strong></p>
        <p>Paid (verified only): <strong>{fmtMoney(selected.amountPaid)}</strong> · Balance: <strong>{fmtMoney(selected.balance)}</strong> · Status: <StatusBadge status={String(selected.status)} /></p>
      </div>
      <ul className="text-sm space-y-1">
        {((selected.lineItems as Row[]) ?? []).map((li, i) => <li key={i} className="flex justify-between border-b py-1"><span>{String(li.label)}</span><span>{fmtMoney(li.amount)}</span></li>)}
        {((selected.adjustments as Row[]) ?? []).map((a, i) => <li key={`a${i}`} className="flex justify-between border-b py-1 text-slate-600"><span>{String(a.label)} ({String(a.type)})</span><span>{a.type === 'discount' || a.type === 'scholarship' ? '−' : '+'}{fmtMoney(a.amount)}</span></li>)}
      </ul>
      {String(selected.status) !== 'cancelled' && (<>
        <div className="grid gap-3 md:grid-cols-4 items-end">
          <div><label className={labelCls}>Adjustment label</label><input className={inputCls} value={adj.label} onChange={(e) => setAdj({ ...adj, label: e.target.value })} placeholder="e.g. Sibling discount" /></div>
          <div><label className={labelCls}>Type</label><select className={inputCls} value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value })}><option value="discount">Discount (−)</option><option value="scholarship">Scholarship (−)</option><option value="late-fee">Late fee (+)</option><option value="charge">Charge (+)</option></select></div>
          <div><label className={labelCls}>Amount (major units)</label><input className={inputCls} value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} /></div>
          <button className={btnCls} disabled={adj.label.trim().length < 2 || !adj.amount} onClick={async () => {
            try {
              const updated = await addInvoiceAdjustment(selected._id, { label: adj.label, amount: toMinor(adj.amount), type: adj.type } as unknown as Row);
              setSelected(updated); setAdj({ label: '', amount: '', type: 'discount' });
              setBanner({ kind: 'ok', text: 'Adjustment applied — totals recomputed by the server and recorded in the invoice history.' });
              await load();
            } catch (e) { setBanner({ kind: 'err', text: `Adjustment failed: ${apiErrorMessage(e)}` }); }
          }}>Add adjustment</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={ghostBtnCls} onClick={async () => { try { setSelected(await applyLateFee(selected._id)); setBanner({ kind: 'ok', text: 'Late fee applied per the fee structure policy.' }); await load(); } catch (e) { setBanner({ kind: 'err', text: `Late fee failed: ${apiErrorMessage(e)}` }); } }}>Apply late fee (policy)</button>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label className={labelCls}>Cancel reason (only possible with no verified payments)</label><input className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></div>
          <button className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white disabled:opacity-50" disabled={cancelReason.trim().length < 3} onClick={async () => {
            try { setSelected(await cancelInvoice(selected._id, cancelReason.trim())); setBanner({ kind: 'ok', text: 'Invoice cancelled.' }); await load(); }
            catch (e) { setBanner({ kind: 'err', text: `Cancel failed: ${apiErrorMessage(e)}` }); }
          }}>Cancel invoice</button>
        </div>
      </>)}
      {((selected.history as Row[]) ?? []).length > 0 && (<details className="text-sm"><summary className="font-medium cursor-pointer">Audit history</summary>
        <ul className="mt-2 space-y-1 text-slate-600">{((selected.history as Row[]) ?? []).map((h, i) => <li key={i}>{h.at ? new Date(String(h.at)).toLocaleString() : ''} — <strong>{String(h.action)}</strong>{h.detail ? `: ${String(h.detail)}` : ''}</li>)}</ul></details>)}
      <p className="text-xs text-slate-500">Amounts shown in major units ({toMajor(selected.totalDue)} = {String(selected.totalDue)} minor units stored). Paid figures count verified payments only.</p>
    </div>)}
  </div>);
}
