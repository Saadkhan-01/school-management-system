
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { STUDENT_NAV } from './nav';
import { Banner, Section, btnCls, fmtDate, inputCls, labelCls, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { createComplaint, listComplaints, respondComplaint } from '../../services/operations';
import { ghostBtnCls } from '../opsShared';
export default function StudentComplaints() {
  const complaints = useLoader(() => listComplaints());
  const [form, setForm] = useState({ category: '', description: '' });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); complaints.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="student" title="Complaints" nav={STUDENT_NAV}><div className="space-y-4">
    <Banner banner={msg ?? complaints.banner} />
    <Section title="Submit a complaint">
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className={labelCls}>Category</label><input className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><label className={labelCls}>Description</label><input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createComplaint(form), 'Complaint submitted.')}>Submit</button>
    </Section>
    <Section title="My complaints">
      <ul className="divide-y text-sm">{(complaints.data ?? []).map((c) => <li key={c._id} className="py-2">
        <p><strong>{String(c.category)}</strong> · {String(c.status)} · {fmtDate(c.createdAt)}</p><p className="text-slate-600">{String(c.description)}</p>
        {(c.responses as Array<Record<string, unknown>> ?? []).map((r, i) => <p key={i} className="text-xs text-slate-500">— {String(r.authorRole)}: {String(r.message)}</p>)}
        <div className="flex gap-2 mt-1"><input className={inputCls} placeholder="Add a reply…" value={reply[c._id] ?? ''} onChange={(e) => setReply({ ...reply, [c._id]: e.target.value })} /><button className={ghostBtnCls} onClick={() => void act(() => respondComplaint(c._id, reply[c._id] ?? ''), 'Reply added.')}>Reply</button></div>
      </li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
