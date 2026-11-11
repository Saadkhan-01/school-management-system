import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import { type Row } from '../../services/academic';
import { downloadPdf, fmtMoney, listInvoices, listPayments, listReceipts } from '../../services/finance';
import { Banner, ghostBtnCls } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { STUDENT_NAV } from './nav';

/**
 * Student Fees (§10, Phase 7) — read-only view of the student's OWN invoices
 * and receipts. Payments are submitted by parents / recorded by the accounts
 * office (permissions matrix), so there is deliberately no payment form here.
 */
export default function StudentFees() {
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [inv, pay, rec] = await Promise.all([listInvoices(), listPayments(), listReceipts()]);
      setInvoices(inv); setPayments(pay); setReceipts(rec);
    } catch (e) { setBanner({ kind: 'err', text: `Could not load your fees: ${apiErrorMessage(e)}` }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const receiptFor = (paymentId: string) => receipts.find((r) => String((r.payment as Row)?._id ?? r.payment) === paymentId);

  return (<DashboardLayout role="student" title="Fees" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <Section title="My fee status">
        {loading ? <LoadingNote text="Loading your invoices…" /> : invoices.length === 0
          ? <p className="text-sm text-slate-500">No invoices have been issued for you yet.</p>
          : (<div className="space-y-4">{invoices.map((inv) => (<div key={inv._id} className="border rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-sm">{String(inv.invoiceNumber)} — {String(((inv.feeStructure as Row)?.name as string) ?? 'Fees')}{inv.periodLabel ? ` (${String(inv.periodLabel)})` : ''}</p>
              <span className="text-xs rounded bg-slate-100 px-2 py-0.5 font-medium capitalize">{String(inv.status)}</span>
            </div>
            <ul className="text-sm space-y-1">
              {((inv.lineItems as Row[]) ?? []).map((li, i) => <li key={i} className="flex justify-between border-b py-1"><span>{String(li.label)}</span><span>{fmtMoney(li.amount)}</span></li>)}
              {((inv.adjustments as Row[]) ?? []).map((a, i) => <li key={`a${i}`} className="flex justify-between border-b py-1 text-slate-600"><span>{String(a.label)}</span><span>{a.type === 'discount' || a.type === 'scholarship' ? '−' : '+'}{fmtMoney(a.amount)}</span></li>)}
            </ul>
            <p className="text-sm">Total due: <strong>{fmtMoney(inv.totalDue)}</strong> · Paid (verified): <strong>{fmtMoney(inv.amountPaid)}</strong> · Balance: <strong>{fmtMoney(inv.balance)}</strong> · Due: {inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString() : '—'}</p>
            <button className={ghostBtnCls} onClick={() => void downloadPdf(`/invoices/${inv._id}/challan-pdf`, `challan-${String(inv.invoiceNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Challan PDF download failed.' }))}>Download challan PDF</button>
          </div>))}</div>)}
      </Section>
      <Section title="Payments & receipts">
        {payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded yet. Payments are submitted by your parent or recorded by the accounts office.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Amount</th><th className="pr-3">Method</th><th className="pr-3">Status</th><th>Receipt</th></tr></thead>
            <tbody>{payments.map((p) => {
              const receipt = String(p.status) === 'verified' ? receiptFor(p._id) : undefined;
              return (<tr key={p._id} className="border-b last:border-0">
                <td className="py-2 pr-3">{String(((p.invoice as Row)?.invoiceNumber as string) ?? '')}</td>
                <td className="pr-3">{fmtMoney(p.amount)}</td>
                <td className="pr-3 capitalize">{String(p.method)}</td>
                <td className="pr-3 capitalize">{String(p.status)}</td>
                <td>{receipt ? <button className="text-brand font-medium" onClick={() => void downloadPdf(`/payments/receipts/${receipt._id}/pdf`, `receipt-${String(receipt.receiptNumber)}.pdf`).catch(() => setBanner({ kind: 'err', text: 'Receipt download failed.' }))}>{String(receipt.receiptNumber)} (PDF)</button> : <span className="text-slate-400 text-xs">After verification</span>}</td>
              </tr>);
            })}</tbody></table></div>)}
      </Section>
    </div>
  </DashboardLayout>);
}
