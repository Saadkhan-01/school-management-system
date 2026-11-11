import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import { type Row } from '../../services/academic';
import {
  createOnlineCheckout, downloadPdf, fmtMoney, listInvoices, listPayments, listReceipts, submitPayment, toMinor,
} from '../../services/finance';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

/**
 * Parent Fees (§11, Phase 7) — per-child invoices with status/balance,
 * challan PDF, manual payment submission (pending verification until the
 * accounts office approves it), payment history, and receipt PDFs for
 * VERIFIED payments only. Online checkout is offered honestly: the gateway
 * is not configured in this deployment, so the button surfaces the server's
 * "gateway not configured" response instead of faking a payment page.
 */
export default function ParentFees() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<Record<string, { amount: string; method: string; reference: string; proofFileName: string }>>({});

  const load = useCallback(async () => {
    if (!childId) { setInvoices([]); setPayments([]); setReceipts([]); return; }
    try {
      const [inv, pay, rec] = await Promise.all([
        listInvoices({ studentId: childId }), listPayments({ studentId: childId }), listReceipts({ studentId: childId }),
      ]);
      setInvoices(inv); setPayments(pay); setReceipts(rec);
    } catch (e) { setBanner({ kind: 'err', text: `Could not load fees: ${apiErrorMessage(e)}` }); }
  }, [childId]);
  useEffect(() => { void load(); }, [load]);

  const receiptFor = (paymentId: string) => receipts.find((r) => String((r.payment as Row)?._id ?? r.payment) === paymentId);
  const formFor = (id: string) => forms[id] ?? { amount: '', method: 'bank-transfer', reference: '', proofFileName: '' };
  const setForm = (id: string, patch: Partial<{ amount: string; method: string; reference: string; proofFileName: string }>) =>
    setForms((f) => ({ ...f, [id]: { ...formFor(id), ...patch } }));

  const submit = async (inv: Row) => {
    const f = formFor(inv._id);
    setBanner(null); setBusy(true);
    try {
      await submitPayment({
        invoiceId: inv._id, amount: toMinor(f.amount), method: f.method,
        ...(f.reference.trim() ? { reference: f.reference.trim() } : {}),
        ...(f.proofFileName.trim() ? { proofFileName: f.proofFileName.trim() } : {}),
      } as unknown as Row);
      setBanner({ kind: 'ok', text: `Payment submitted for invoice ${String(inv.invoiceNumber)}. It is now PENDING VERIFICATION — the fee will count as paid, and your receipt will be issued, only after the accounts office verifies it.` });
      setForm(inv._id, { amount: '', reference: '', proofFileName: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Payment submission failed: ${apiErrorMessage(e)}` }); }
    finally { setBusy(false); }
  };

  const online = async (inv: Row) => {
    setBanner(null);
    try {
      const out = await createOnlineCheckout(inv._id);
      if (out && typeof out === 'object' && 'checkoutUrl' in out) window.location.href = String((out as Row).checkoutUrl);
    } catch (e) {
      setBanner({ kind: 'err', text: `Online payment is unavailable: ${apiErrorMessage(e)} Please pay at the school office or submit a manual payment below instead — no amount has been charged or recorded.` });
    }
  };

  return (<DashboardLayout role="parent" title="Fees & Payments" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: error } : banner} />
      {loading ? <LoadingNote text="Loading your children…" /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        <Section title="Invoices / challans">
          {invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices have been issued for this child yet.</p> : (
            <div className="space-y-4">
              {invoices.map((inv) => {
                const f = formFor(inv._id);
                const payable = Number(inv.balance ?? 0) > 0 && String(inv.status) !== 'cancelled';
                return (<div key={inv._id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-sm">{String(inv.invoiceNumber)} — {String(((inv.feeStructure as Row)?.name as string) ?? 'Fees')}{inv.periodLabel ? ` (${String(inv.periodLabel)})` : ''}</p>
                    <span className="text-xs rounded bg-slate-100 px-2 py-0.5 font-medium capitalize">{String(inv.status)}</span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {((inv.lineItems as Row[]) ?? []).map((li, i) => <li key={i} className="flex justify-between border-b py-1"><span>{String(li.label)}</span><span>{fmtMoney(li.amount)}</span></li>)}
                    {((inv.adjustments as Row[]) ?? []).map((a, i) => <li key={`a${i}`} className="flex justify-between border-b py-1 text-slate-600"><span>{String(a.label)}</span><span>{a.type === 'discount' || a.type === 'scholarship' ? '−' : '+'}{fmtMoney(a.amount)}</span></li>)}
                  </ul>
                  <p className="text-sm">Total due: <strong>{fmtMoney(inv.totalDue)}</strong> · Paid (verified): <strong>{fmtMoney(inv.amountPaid)}</strong> · Balance: <strong>{fmtMoney(inv.balance)}</strong> · Due: {inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString() : '—'}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={ghostBtnCls} onClick={() => void downloadPdf(`/invoices/${inv._id}/challan-pdf`, `challan-${String(inv.invoiceNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Challan PDF download failed.' }))}>Download challan PDF</button>
                    {payable && <button className={ghostBtnCls} onClick={() => void online(inv)}>Pay online</button>}
                  </div>
                  {payable && (<div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">Submit a manual payment</p>
                    <p className="text-xs text-slate-500">Pay at the bank / school office first, then submit the details here. {inv.partialPaymentsAllowed ? 'Partial payments are allowed for this invoice.' : 'This fee does not allow partial payments — please submit the full balance.'} Proof upload is not available yet (file storage is not configured); record the reference and the proof file name — the office may ask to see the original.</p>
                    <div className="grid gap-2 md:grid-cols-4">
                      <div><label className={labelCls}>Amount</label><input className={inputCls} value={f.amount} onChange={(e) => setForm(inv._id, { amount: e.target.value })} placeholder={`Balance: ${fmtMoney(inv.balance)}`} /></div>
                      <div><label className={labelCls}>Method</label><select className={inputCls} value={f.method} onChange={(e) => setForm(inv._id, { method: e.target.value })}><option value="bank-transfer">Bank transfer</option><option value="cash">Cash at office</option><option value="manual">Manual</option></select></div>
                      <div><label className={labelCls}>Reference</label><input className={inputCls} value={f.reference} onChange={(e) => setForm(inv._id, { reference: e.target.value })} placeholder="Bank txn / receipt no." /></div>
                      <div><label className={labelCls}>Proof file name (optional)</label><input className={inputCls} value={f.proofFileName} onChange={(e) => setForm(inv._id, { proofFileName: e.target.value })} placeholder="e.g. bank-slip.jpg" /></div>
                    </div>
                    <button className={btnCls} disabled={busy || !f.amount} onClick={() => void submit(inv)}>Submit for verification</button>
                  </div>)}
                </div>);
              })}
            </div>)}
        </Section>
        <Section title="Payment history">
          {payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded for this child yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Amount</th><th className="pr-3">Method</th><th className="pr-3">Reference</th><th className="pr-3">Status</th><th>Receipt</th></tr></thead>
              <tbody>{payments.map((p) => {
                const receipt = String(p.status) === 'verified' ? receiptFor(p._id) : undefined;
                return (<tr key={p._id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{String(((p.invoice as Row)?.invoiceNumber as string) ?? '')}</td>
                  <td className="pr-3">{fmtMoney(p.amount)}</td>
                  <td className="pr-3 capitalize">{String(p.method)}</td>
                  <td className="pr-3">{String(p.reference ?? '—')}</td>
                  <td className="pr-3"><span className="capitalize">{String(p.status)}</span>{p.rejectionReason ? <span className="block text-xs text-red-600">Rejected: {String(p.rejectionReason)}</span> : null}</td>
                  <td>{receipt ? <button className="text-brand font-medium" onClick={() => void downloadPdf(`/payments/receipts/${receipt._id}/pdf`, `receipt-${String(receipt.receiptNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Receipt download failed.' }))}>{String(receipt.receiptNumber)} (PDF)</button> : <span className="text-slate-400 text-xs">{String(p.status) === 'verified' ? 'Issuing…' : 'After verification'}</span>}</td>
                </tr>);
              })}</tbody></table></div>)}
          <p className="text-xs text-slate-500 mt-2">A receipt is issued only after the accounts office verifies a payment. Rejected payments show the office's reason; reversed payments keep their history here.</p>
        </Section>
      </>)}
    </div>
  </DashboardLayout>);
}
