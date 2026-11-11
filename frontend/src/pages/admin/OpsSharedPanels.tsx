
import { useState } from 'react';
import { Banner, Section, btnCls, fmtDate, ghostBtnCls, inputCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { listComplaints, listDiscipline, respondComplaint, transitionComplaint } from '../../services/operations';

export function ComplaintsPanel() {
  const complaints = useLoader(() => listComplaints());
  const [reply, setReply] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); complaints.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<div><Banner banner={msg ?? complaints.banner} />
    <Section title="Complaints">
      <ul className="divide-y text-sm">{(complaints.data ?? []).map((c) => <li key={c._id} className="py-3">
        <p><strong>{String(c.category)}</strong> · {String(c.status)} · by {String(c.submittedByRole)}{c.student ? ` · ${refName(c.student)}` : ''} · {fmtDate(c.createdAt)}</p>
        <p className="text-slate-600">{String(c.description)}</p>
        {(c.responses as Array<Record<string, unknown>> ?? []).map((r, i) => <p key={i} className="text-slate-500 text-xs mt-1">— {String(r.authorRole)}: {String(r.message)}</p>)}
        {c.resolutionNote ? <p className="text-xs mt-1">Resolution: {String(c.resolutionNote)}</p> : null}
        <div className="flex flex-wrap gap-2 mt-2">
          <input className={inputCls} placeholder="Reply…" value={reply[c._id] ?? ''} onChange={(e) => setReply({ ...reply, [c._id]: e.target.value })} />
          <button className={ghostBtnCls} onClick={() => void act(() => respondComplaint(c._id, reply[c._id] ?? ''), 'Response added.')}>Respond</button>
          <button className={ghostBtnCls} onClick={() => void act(() => transitionComplaint(c._id, { status: 'in-progress' }), 'Marked in progress.')}>In progress</button>
          <button className={ghostBtnCls} onClick={() => void act(() => transitionComplaint(c._id, { status: 'resolved', resolutionNote: reply[c._id] || 'Resolved' }), 'Resolved.')}>Resolve</button>
          <button className={ghostBtnCls} onClick={() => void act(() => transitionComplaint(c._id, { status: 'closed' }), 'Closed.')}>Close</button>
        </div>
      </li>)}</ul>
    </Section></div>);
}
export function DisciplinePanel() {
  const records = useLoader(() => listDiscipline());
  return (<div><Banner banner={records.banner} />
    <Section title="Discipline records (Admin/Principal only — permissions matrix)">
      {(records.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No discipline records.</p> : <ul className="divide-y text-sm">{(records.data ?? []).map((d) => <li key={d._id} className="py-2"><strong>{refName(d.student)}</strong> · {String(d.category)} · {fmtDate(d.incidentDate)}<br /><span className="text-slate-600">{String(d.description)}</span><br /><span className="text-xs">Action: {String(d.actionTaken)}</span></li>)}</ul>}
    </Section></div>);
}
