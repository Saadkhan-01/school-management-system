
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LIBRARIAN_NAV } from './nav';
import { Banner, Section, btnCls, fmtDate, fmtMinor, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { issueBook, listCopies, listIssues, returnBook } from '../../services/operations';
import { lookupStudents } from '../../services/finance';
import type { Row } from '../../services/academic';
export default function LibrarianCirculation() {
  const copies = useLoader(() => listCopies({ status: 'available' }));
  const issues = useLoader(() => listIssues());
  const [form, setForm] = useState({ copyId: '', studentId: '' });
  const [search, setSearch] = useState(''); const [found, setFound] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const doIssue = async () => { try { await issueBook({ copyId: form.copyId, studentId: form.studentId }); setMsg({ kind: 'ok', text: 'Book issued (14-day loan).' }); issues.reload(); copies.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  const doReturn = async (id: string) => { try { const r = await returnBook(id) as Row; setMsg({ kind: 'ok', text: `Returned. Fine: ${fmtMinor(r.fineAmount)} (${String(r.fineStatus)})` }); issues.reload(); copies.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="librarian" title="Issue / Return" nav={LIBRARIAN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? issues.banner} />
    <Section title="Issue a copy">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Available copy</label><select className={inputCls} value={form.copyId} onChange={(e) => setForm({ ...form, copyId: e.target.value })}><option value="">Select…</option>{(copies.data ?? []).map((c) => <option key={c._id} value={c._id}>{String(c.copyCode)} — {refName(c.book)}</option>)}</select></div>
        <div><label className={labelCls}>Student search</label><input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (search) void lookupStudents(search).then(setFound).catch(() => setFound([])); }} placeholder="Name or admission no." /></div>
        <div><label className={labelCls}>Student</label><select className={inputCls} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Select…</option>{found.map((s) => <option key={s._id} value={s._id}>{String(s.firstName ?? '')} {String(s.lastName ?? '')} ({String(s.admissionNumber ?? '')})</option>)}</select></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void doIssue()}>Issue book</button>
    </Section>
    <Section title="Open & past issues">
      <ul className="divide-y text-sm">{(issues.data ?? []).map((i) => <li key={i._id} className="py-2 flex justify-between gap-2"><span>{refName(i.copy)} · {refName(i.book)} → {refName(i.borrowerStudent)} · due {fmtDate(i.dueDate)}{i.returnDate ? ` · returned ${fmtDate(i.returnDate)} · fine ${fmtMinor(i.fineAmount)}` : ''}</span>{!i.returnDate && <button className={btnCls} onClick={() => void doReturn(i._id)}>Return</button>}</li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
