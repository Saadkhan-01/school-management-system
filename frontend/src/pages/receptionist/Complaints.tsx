
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RECEPTIONIST_NAV } from './nav';
import { Banner, Section, btnCls, inputCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { listComplaints, transitionComplaint } from '../../services/operations';
export default function ReceptionistComplaints() {
  const complaints = useLoader(() => listComplaints());
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const route = async (id: string, status: string) => { try { await transitionComplaint(id, { status, assignedTo: assign[id] || undefined }); setMsg({ kind: 'ok', text: 'Complaint routed.' }); complaints.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="receptionist" title="Complaints Routing" nav={RECEPTIONIST_NAV}>
    <Banner banner={msg ?? complaints.banner} />
    <Section title="All complaints — assign to route (receptionists cannot change status)">
      <ul className="divide-y text-sm">{(complaints.data ?? []).map((c) => <li key={c._id} className="py-2">
        <p><strong>{String(c.category)}</strong> · {String(c.status)} · by {String(c.submittedByRole)} {c.student ? `· ${refName(c.student)}` : ''}</p>
        <p className="text-slate-600">{String(c.description)}</p>
        <div className="flex gap-2 mt-1"><input className={inputCls} placeholder="Assign to (user id)" value={assign[c._id] ?? ''} onChange={(e) => setAssign({ ...assign, [c._id]: e.target.value })} /><button className={btnCls} onClick={() => void route(c._id, String(c.status))}>Assign</button></div>
      </li>)}</ul>
    </Section>
  </DashboardLayout>);
}
