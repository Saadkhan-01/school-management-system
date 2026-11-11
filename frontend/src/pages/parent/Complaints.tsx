
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { PARENT_NAV } from './nav';
import { ChildSwitcher } from './shared';
import { Banner, Section, btnCls, fmtDate, ghostBtnCls, inputCls, labelCls, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { createComplaint, listComplaints, respondComplaint } from '../../services/operations';
import { useParentChildren } from './shared';
export default function ParentComplaints() {
  const { children, childId, setChildId, loading } = useParentChildren();
  const complaints = useLoader(() => listComplaints());
  const [form, setForm] = useState({ category: '', description: '' });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); complaints.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  if (loading) return (<DashboardLayout role="parent" title="Complaints" nav={PARENT_NAV}><p className="text-sm text-slate-500">Loading…</p></DashboardLayout>);
  return (<DashboardLayout role="parent" title="Complaints" nav={PARENT_NAV}><div className="space-y-4">
    <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
    <Banner banner={msg ?? complaints.banner} />
    <Section title="Submit a complaint (for the selected child)">
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className={labelCls}>Category</label><input className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><label className={labelCls}>Description</label><input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} disabled={!childId} onClick={() => void act(() => createComplaint({ ...form, studentId: childId }), 'Complaint submitted.')}>Submit</button>
    </Section>
    <Section title="My complaints">
      <ul className="divide-y text-sm">{(complaints.data ?? []).map((c) => <li key={c._id} className="py-2">
        <p><strong>{String(c.category)}</strong> · {String(c.status)} · {fmtDate(c.createdAt)}</p><p className="text-slate-600">{String(c.description)}</p>
        {(c.responses as Array<Record<string, unknown>> ?? []).map((r, i) => <p key={i} className="text-xs text-slate-500">— {String(r.authorRole)}: {String(r.message)}</p>)}
        {c.resolutionNote ? <p className="text-xs">Resolution: {String(c.resolutionNote)}</p> : null}
        <div className="flex gap-2 mt-1"><input className={inputCls} placeholder="Add a reply…" value={reply[c._id] ?? ''} onChange={(e) => setReply({ ...reply, [c._id]: e.target.value })} /><button className={ghostBtnCls} onClick={() => void act(() => respondComplaint(c._id, reply[c._id] ?? ''), 'Reply added.')}>Reply</button></div>
      </li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
