import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DashboardStats from '../../components/admin/DashboardStats';
import { ExamManager } from '../admin/Exams';
import { PRINCIPAL_NAV } from './nav';
import { Banner, btnCls, errText, ghostBtnCls } from '../teacher/shared';
import { decideLeave, listLeave, refName, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';
import { FinanceStatsPanel } from '../../components/finance/FinancePanels';
import { ComplaintsPanel, DisciplinePanel } from '../admin/OpsSharedPanels';

export default function PrincipalDashboard() {
  const [tab, setTab] = useState<'overview' | 'exams' | 'leave' | 'fees' | 'complaints' | 'discipline'>('overview');
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadLeaves = useCallback(async () => {
    try { setLeaves(await listLeave({ status: 'pending', limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load pending leave applications') }); setLeaves([]); }
  }, []);
  useEffect(() => { if (tab === 'leave') void loadLeaves(); }, [loadLeaves, tab]);

  const decide = async (leave: Row, status: 'approved' | 'rejected') => {
    try {
      await decideLeave(leave._id, { status, decisionNote: notes[leave._id] || undefined });
      setBanner({ kind: 'ok', text: `Leave ${status}.` });
      await loadLeaves();
    } catch (e) { setBanner({ kind: 'err', text: `Decision failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="principal" title="Principal Dashboard" nav={PRINCIPAL_NAV}>
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([['overview', 'Overview'], ['exams', 'Exam Results — Approve / Publish'], ['leave', 'Leave Approvals'], ['fees', 'Fee Collection Overview'], ['complaints', 'Complaints'], ['discipline', 'Discipline Overview']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>
      <Banner banner={banner} />
      {tab === 'overview' && (<>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold">School Overview (§8)</h2>
          <p className="text-sm text-slate-600 mt-1">Live counts from the school database. Use the tabs above for Phase 5 approval work: examination results (approve → publish) and staff/student leave decisions.</p>
        </div>
        <DashboardStats variant="principal" />
      </>)}
      {tab === 'exams' && <ExamManager role="principal" />}
      {tab === 'complaints' && <ComplaintsPanel />}
      {tab === 'discipline' && <DisciplinePanel />}
      {tab === 'fees' && (<div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold">Fee Collection Overview (§8)</h3>
          <p className="text-sm text-slate-600 mt-1">Read-only oversight of fee collection — live aggregates over real invoices and verified payments. Individual salary/payroll detail is restricted to Admin and the Accountant (permissions matrix); payment verification is an Accountant/Admin action, not a Principal one.</p>
        </div>
        <FinanceStatsPanel variant="principal" />
      </div>)}
      {tab === 'leave' && (<div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">Pending Leave Applications (§8/§13)</h3>
        {leaves.length === 0 ? <p className="text-sm text-slate-500">No pending applications.</p>
          : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Applicant</th><th className="py-2 pr-3">For</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Dates</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Note</th><th className="py-2">Decision</th></tr></thead>
            <tbody>{leaves.map((l) => (<tr key={l._id} className="border-b last:border-0 align-top">
              <td className="py-2 pr-3">{refName(l.applicantUser)} ({String(l.applicantRole)})</td>
              <td className="py-2 pr-3">{l.student ? refName(l.student) || 'Student' : 'Self'}</td>
              <td className="py-2 pr-3 capitalize">{String(l.leaveType)}</td>
              <td className="py-2 pr-3">{new Date(String(l.fromDate)).toLocaleDateString()} → {new Date(String(l.toDate)).toLocaleDateString()}</td>
              <td className="py-2 pr-3 max-w-[220px]">{String(l.reason)}</td>
              <td className="py-2 pr-3"><input className="border rounded px-2 py-1 w-36" value={notes[l._id] ?? ''} onChange={(e) => setNotes({ ...notes, [l._id]: e.target.value })} placeholder="Decision note" /></td>
              <td className="py-2"><div className="flex gap-2"><button className={btnCls} onClick={() => void decide(l, 'approved')}>Approve</button><button className={ghostBtnCls} onClick={() => void decide(l, 'rejected')}>Reject</button></div></td>
            </tr>))}</tbody></table></div>)}
      </div>)}
    </div>
  </DashboardLayout>);
}
