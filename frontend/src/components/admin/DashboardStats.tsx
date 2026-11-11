import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage } from '../../services/api';
import { getDashboardStats, type DashboardStats as Stats } from '../../services/admin';

function Card({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (<div className="bg-white rounded-xl shadow-sm p-5">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>);
}

/**
 * Real dashboard statistics (§7/§8) from GET /reports/dashboard/<variant>.
 * Every figure is a live database count rendered from the API response.
 * On failure an honest error state is shown — there is NO fallback to
 * invented numbers. Attendance/fees are null until Phases 5/7 and the API
 * says so; the note is rendered verbatim.
 */
export default function DashboardStats({ variant }: { variant: 'admin' | 'principal' }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getDashboardStats(variant)
      .then((s) => { if (alive) setStats(s); })
      .catch((e) => { if (alive) setError(apiErrorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [variant]);

  if (loading) return <div className="bg-white rounded-xl shadow-sm p-6 text-sm text-slate-500">Loading live school statistics…</div>;
  if (error || !stats) return (<div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
    <p className="font-medium">Statistics unavailable</p>
    <p className="mt-1">The dashboard could not load real figures from the API: {error ?? 'unknown error'}. If this is a 503, the database is not connected yet (configure MONGODB_URI). No substitute or estimated numbers are shown.</p>
  </div>);

  const t = stats.totals;
  return (<div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Students" value={t.students} hint={`${t.activeStudents} active · ${t.activeEnrollments} active enrollments`} />
      <Card label="Teachers" value={t.teachers} hint="Teacher profiles" />
      <Card label="Staff" value={t.staff} hint="HR staff profiles" />
      <Card label="Parents" value={t.parents} hint="Parent profiles" />
      <Card label="Classes" value={t.classes} hint={`${t.sections} sections · ${t.subjects} subjects`} />
      <Card label="User accounts" value={t.users} hint={Object.entries(stats.usersByRole).map(([r, n]) => `${r}: ${n}`).join(' · ')} />
      <Card label="Pending admissions" value={stats.admissions.pending} hint={`${stats.admissions.submitted} submitted · ${stats.admissions.underReview} under review`} />
      <Card label="Approved — awaiting enrollment" value={stats.admissions.approvedAwaitingEnrollment} hint={variant === 'admin' ? 'Convert them from the Admissions page' : 'Admin converts approved applications'} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Current academic session</p>
        <p className="font-semibold mt-1">{stats.currentSession ? stats.currentSession.name : 'No session is marked current'}</p>
        <p className="text-xs text-slate-500 mt-1">Figures generated {new Date(stats.generatedAt).toLocaleString()} directly from the database.</p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-600 space-y-1">
        <p><strong>Attendance:</strong> {stats.attendanceNote}</p>
        <p><strong>Fees:</strong> {stats.feesNote}</p>
      </div>
    </div>
    {variant === 'admin' && (<div className="bg-white rounded-xl shadow-sm p-5">
      <p className="font-medium mb-2">Quick actions</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="bg-brand text-white px-3 py-1.5 rounded" to="/admin/users">Manage users</Link>
        <Link className="bg-slate-100 px-3 py-1.5 rounded" to="/admin/students">Students</Link>
        <Link className="bg-slate-100 px-3 py-1.5 rounded" to="/admin/admissions">Admissions</Link>
        <Link className="bg-slate-100 px-3 py-1.5 rounded" to="/admin/academics">Academic setup</Link>
        <Link className="bg-slate-100 px-3 py-1.5 rounded" to="/admin/enrollments">Enrollments</Link>
      </div>
    </div>)}
  </div>);
}
