import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, useMyAssignments } from './shared';
import { refName, refObj } from '../../services/academic';

export default function TeacherMyClasses() {
  const { assignments, error, loading } = useMyAssignments();
  return (<DashboardLayout role="teacher" title="My Classes" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: error } : null} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-1">Assigned Classes & Subjects (§9)</h2>
        <p className="text-sm text-slate-600 mb-4">Read-only — assignments are managed by Admin. Every Phase 5 action (attendance, assignments, marks, materials) is limited to exactly these combinations.</p>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : assignments.length === 0
          ? <p className="text-sm text-slate-500">No assignments found for your account.</p>
          : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Section</th><th className="py-2 pr-3">Subject</th><th className="py-2">Session</th></tr></thead>
            <tbody>{assignments.map((a) => (<tr key={a._id} className="border-b last:border-0"><td className="py-2 pr-3">{refName(a.schoolClass)}</td><td className="py-2 pr-3">{refName(a.section)}</td><td className="py-2 pr-3">{refName(a.subject)}{refObj(a.subject).code ? ` (${String(refObj(a.subject).code)})` : ''}</td><td className="py-2">{refName(a.session)}</td></tr>))}</tbody></table></div>)}
      </div>
    </div>
  </DashboardLayout>);
}
