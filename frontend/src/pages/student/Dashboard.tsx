import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { refName, type Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section, enrollmentLine, useStudentPortal } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentDashboard() {
  const { data, loading, error } = useStudentPortal();
  const student = data ? (data.student as Row) : null;
  const enrollment = data ? (data.enrollment as Row | null) : null;
  const attendance = data ? (data.attendance as Row) : null;
  const summary = attendance ? (attendance.summary as Row) : null;
  const assignments = data ? (data.assignments as Row) : null;
  const upcoming = assignments ? ((assignments.upcoming as Row[]) ?? []) : [];
  const subjects = data ? ((data.subjects as Row[]) ?? []) : [];
  const publishedExams = data ? ((data.publishedExams as Row[]) ?? []) : [];

  return (<DashboardLayout role="student" title="Student Dashboard" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : null} />
      {loading ? <LoadingNote text="Loading your dashboard…" /> : data && student ? (<>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap gap-5 items-start">
          <div>
            <h2 className="text-lg font-semibold">{String(student.fullName)}</h2>
            <p className="text-sm text-slate-600">Admission No: <strong>{String(student.admissionNumber)}</strong> · {enrollmentLine(enrollment)}</p>
            <p className="text-sm text-slate-600">Status: <span className="capitalize">{String(student.status)}</span>{student.bloodGroup ? <> · Blood group: {String(student.bloodGroup)}</> : ''}</p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-3 text-center">
            <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{summary && summary.attendancePercentage !== null && summary.attendancePercentage !== undefined ? `${String(summary.attendancePercentage)}%` : '—'}</p><p className="text-xs text-slate-500">Attendance</p></div>
            <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{String(assignments?.pendingCount ?? 0)}</p><p className="text-xs text-slate-500">Assignments due</p></div>
            <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{publishedExams.length}</p><p className="text-xs text-slate-500">Published results</p></div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="My Subjects & Teachers">
            {subjects.length === 0
              ? <p className="text-sm text-slate-500">{enrollment ? 'No teacher assignments have been recorded for your class yet.' : 'You have no active enrollment yet, so subjects cannot be listed.'}</p>
              : (<ul className="divide-y text-sm">{subjects.map((s, i) => (<li key={i} className="py-2 flex justify-between gap-3"><span><strong>{refName(s.subject)}</strong></span><span className="text-slate-600">{((s.teachers as Row[]) ?? []).map((t) => String(t.name ?? '—')).join(', ')}</span></li>))}</ul>)}
          </Section>
          <Section title="Upcoming Assignments">
            {upcoming.length === 0
              ? <p className="text-sm text-slate-500">No upcoming assignment deadlines.</p>
              : (<ul className="divide-y text-sm">{upcoming.slice(0, 5).map((a) => (<li key={a._id} className="py-2 flex justify-between gap-3"><span><strong>{String(a.title)}</strong> · {refName(a.subject)}</span><span className="text-slate-600">due {new Date(String(a.deadline)).toLocaleDateString()}</span></li>))}</ul>)}
            <p className="mt-3"><Link className="text-brand hover:underline text-sm" to="/student/assignments">Open assignments →</Link></p>
          </Section>
        </div>

        <Section title="Quick links">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/timetable">My Timetable</Link>
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/attendance">Attendance</Link>
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/results">Exams & Results</Link>
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/materials">Study Materials</Link>
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/announcements">Announcements</Link>
            <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/student/settings">Account Settings</Link>
          </div>
        </Section>
      </>) : !error ? <p className="text-sm text-slate-500">No portal data was returned.</p> : null}
    </div>
  </DashboardLayout>);
}
