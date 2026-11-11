
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, Section, btnCls, fmtDate, ghostBtnCls, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { issueCertificate, listCertificates, revokeCertificate } from '../../services/operations';
import { downloadPdf } from '../../services/finance';
import { lookupStudents } from '../../services/finance';
import type { Row } from '../../services/academic';
const TYPES = ['character', 'bonafide', 'leaving', 'transfer', 'enrollment', 'fee-clearance', 'other'];
export default function AdminCertificates() {
  const certs = useLoader(() => listCertificates());
  const [form, setForm] = useState({ studentId: '', type: 'bonafide' });
  const [search, setSearch] = useState(''); const [found, setFound] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); certs.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="admin" title="Certificates" nav={ADMIN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? certs.banner} />
    <Section title="Issue a certificate (fee-clearance checks real invoice balances)">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Student search</label><input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (search) void lookupStudents(search).then(setFound).catch(() => setFound([])); }} /></div>
        <div><label className={labelCls}>Student</label><select className={inputCls} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Select…</option>{found.map((s) => <option key={s._id} value={s._id}>{String(s.firstName ?? '')} {String(s.lastName ?? '')}</option>)}</select></div>
        <div><label className={labelCls}>Type</label><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => issueCertificate(form), 'Certificate issued.')}>Issue</button>
    </Section>
    <Section title="Issued certificates">
      <ul className="divide-y text-sm">{(certs.data ?? []).map((c) => <li key={c._id} className="py-2 flex justify-between gap-2"><span><strong>{String(c.referenceNumber)}</strong> · {String(c.type)} · {refName(c.student)} · {fmtDate(c.issueDate)} · {String(c.status)}</span><span className="flex gap-2"><button className={ghostBtnCls} onClick={() => void downloadPdf(`/certificates/${c._id}/pdf`, `certificate-${String(c.referenceNumber)}.pdf`).catch(() => setMsg({ kind: 'err', text: 'PDF download failed.' }))}>PDF</button>{c.status === 'issued' && <button className={ghostBtnCls} onClick={() => void act(() => revokeCertificate(c._id, 'Revoked by admin'), 'Certificate revoked.')}>Revoke</button>}</span></li>)}</ul>
      <p className="text-xs text-slate-500 mt-2">Anyone can verify a reference at GET /api/v1/certificates/verify/CERT-YYYY-NNNNNN (name, type, date, status only).</p>
    </Section>
  </div></DashboardLayout>);
}
