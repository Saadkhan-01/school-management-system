import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, assignmentLabel, useMyAssignments } from './shared';
import { Link } from 'react-router-dom';

export default function TeacherDashboard() {
  const { assignments, profile, error, loading } = useMyAssignments();
  return (<DashboardLayout role="teacher" title="Teacher Dashboard" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold">Teacher Portal (§9)</h2>
        <p className="text-sm text-slate-600 mt-1">Your assigned classes and subjects come from Admin-managed Teacher Assignments. Attendance, assignments, marks entry, study materials and leave all operate only inside that assigned scope — the backend enforces it on every request.</p>
        {profile && <p className="text-sm text-slate-600 mt-2">Employee ID: <strong>{String(profile.employeeId ?? '—')}</strong> · {assignments.length} assignment(s)</p>}
      </div>
      <Banner banner={error ? { kind: 'err', text: error } : null} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">My Assigned Classes & Subjects</h3>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : assignments.length === 0
          ? <p className="text-sm text-slate-500">No assignments yet. An Admin assigns you to classes/subjects under Academics → Teacher Assignments.</p>
          : (<ul className="divide-y">{assignments.map((a) => (<li key={a._id} className="py-2 text-sm flex items-center justify-between"><span>{assignmentLabel(a)}</span><Link className="text-brand hover:underline" to="/teacher/attendance">Mark attendance</Link></li>))}</ul>)}
      </div>
    </div>
  </DashboardLayout>);
}
