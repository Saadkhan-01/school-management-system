import { Fragment, useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import { adminListApplications, adminUpdateApplicationStatus, type AdmissionApplication, type AdmissionStatus } from '../../services/website';
import {
  enrollApplication, listClasses, listSections, listSessions, type AnyRow, type EnrollResult,
} from '../../services/admin';

const inputCls = 'w-full border rounded px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium mb-1';
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' }, { value: 'Submitted', label: 'Submitted' }, { value: 'Under Review', label: 'Under Review' },
  { value: 'Approved', label: 'Approved' }, { value: 'Rejected', label: 'Rejected' }, { value: 'Enrolled', label: 'Enrolled' },
];

function EnrollPanel({ application, onDone }: { application: AdmissionApplication; onDone: (text: string) => void }) {
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [sections, setSections] = useState<AnyRow[]>([]);
  const [form, setForm] = useState({ sessionId: '', classId: '', sectionId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollResult | null>(null);

  useEffect(() => {
    listSessions({ limit: 100 }).then((o) => setSessions(o.items)).catch(() => undefined);
    listClasses({ limit: 100 }).then((o) => setClasses(o.items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!form.classId) { setSections([]); return; }
    listSections({ limit: 100, filters: { classId: form.classId } }).then((o) => setSections(o.items)).catch(() => setSections([]));
  }, [form.classId]);

  const visibleClasses = classes.filter((c) => !form.sessionId || String((c.session as AnyRow)?._id ?? c.session) === form.sessionId);

  const enroll = async () => {
    if (!form.sessionId || !form.classId || !form.sectionId) { setError('Select the session, class and section for this enrollment.'); return; }
    setBusy(true); setError(null);
    try {
      const out = await enrollApplication(application._id, form);
      setResult(out);
      onDone(`Enrolled ${out.student.firstName} ${out.student.lastName} — admission number ${out.student.admissionNumber}.`);
    } catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); }
  };

  if (result) return (<div className="rounded border border-green-200 bg-green-50 p-4 text-sm space-y-1">
    <p className="font-semibold text-green-900">Enrollment complete (§16)</p>
    <p>Student: {result.student.firstName} {result.student.lastName} · Admission number: <strong>{result.student.admissionNumber}</strong></p>
    <p>Parent account: {result.parent.created ? 'created for the guardian email' : 'existing parent account linked'} with a verified parent–student link.</p>
    {result.parent.devTemporaryPassword && <p>Temporary parent password (development only — share securely and ask the parent to change it): <code className="bg-white px-1 rounded">{result.parent.devTemporaryPassword}</code></p>}
    <p className="text-slate-600">{result.feeStructureNote}</p>
    <p className="text-slate-600">{result.notificationNote}</p>
  </div>);

  return (<div className="space-y-3">
    <p className="text-sm text-slate-600">Converting creates the student record with a generated admission number (ADM-&lt;year&gt;-&lt;sequence&gt;), creates or links the guardian's parent account with a <strong>verified</strong> link, and creates the active enrollment — together, not as separate steps.</p>
    <div className="grid gap-3 md:grid-cols-3">
      <div><label className={labelCls}>Academic session</label><select className={inputCls} value={form.sessionId} onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value, classId: '', sectionId: '' }))}><option value="">— Select —</option>{sessions.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}{s.isCurrent ? ' (current)' : ''}</option>)}</select></div>
      <div><label className={labelCls}>Class</label><select className={inputCls} value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, sectionId: '' }))}><option value="">— Select —</option>{visibleClasses.map((c) => <option key={String(c._id)} value={String(c._id)}>{String(c.name)}</option>)}</select></div>
      <div><label className={labelCls}>Section</label><select className={inputCls} value={form.sectionId} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}><option value="">— Select —</option>{sections.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}</option>)}</select></div>
    </div>
    {sessions.length === 0 && <p className="text-sm text-amber-700">No academic sessions found — create a session, class and section first (Academics page). If the database is unavailable, the lists stay empty.</p>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button disabled={busy} onClick={() => void enroll()} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{busy ? 'Enrolling…' : `Enroll ${application.studentName}`}</button>
  </div>);
}

export default function AdmissionsPage() {
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (status) params.status = status;
      if (search) params.search = search;
      setApplications(await adminListApplications(params));
    } catch (e) { setBanner({ kind: 'err', text: `Could not load applications: ${apiErrorMessage(e)}` }); }
    finally { setLoading(false); }
  }, [status, search]);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, next: AdmissionStatus) => {
    setBanner(null);
    try { await adminUpdateApplicationStatus(id, next); setBanner({ kind: 'ok', text: `Application moved to “${next}”.` }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: `Status change failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="admin" title="Admissions" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold">Admission Applications (§16)</h2>
        <p className="text-sm text-slate-600 mt-1">Submitted → Under Review → Approved / Rejected → <strong>Enrolled</strong>. Only Approved applications can be enrolled, and only by Admin. Fee-structure application is Phase 7; parent notification is Phase 9 — the enroll result states this honestly.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <input className="border rounded px-3 py-2 text-sm flex-1 min-w-48" placeholder="Search student, guardian, email, class…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border rounded px-2 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {banner && <p className={`mt-4 rounded p-3 text-sm ${banner.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{banner.text}</p>}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : applications.length === 0 ? <p className="text-sm text-slate-500">No applications match (or the database is unavailable — see banner).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="pr-3">Guardian</th><th className="pr-3">Desired class</th><th className="pr-3">Submitted</th><th className="pr-3">Status</th><th>Actions</th></tr></thead>
            <tbody>{applications.map((a) => (<Fragment key={a._id}>
              <tr className="border-b align-top">
                <td className="py-2 pr-3 font-medium">{a.studentName}</td>
                <td className="pr-3">{a.guardianName}<br /><span className="text-slate-500">{a.guardianEmail}</span></td>
                <td className="pr-3">{a.desiredClass}</td>
                <td className="pr-3 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="pr-3"><span className="bg-slate-100 rounded px-2 py-0.5 text-xs font-medium">{a.status}</span></td>
                <td className="whitespace-nowrap">
                  {a.status === 'Submitted' && <button className="text-brand font-medium" onClick={() => void act(a._id, 'Under Review')}>Mark Under Review</button>}
                  {a.status === 'Under Review' && (<><button className="text-green-700 font-medium mr-3" onClick={() => void act(a._id, 'Approved')}>Approve</button><button className="text-red-600 font-medium" onClick={() => void act(a._id, 'Rejected')}>Reject</button></>)}
                  {a.status === 'Approved' && <button className="text-green-700 font-semibold" onClick={() => setEnrollingId(enrollingId === a._id ? null : a._id)}>{enrollingId === a._id ? 'Close enroll form' : 'Enroll student…'}</button>}
                  {a.status === 'Enrolled' && <span className="text-green-700 text-xs font-medium">Enrolled ✓</span>}
                  {a.status === 'Rejected' && <span className="text-slate-400 text-xs">Decided</span>}
                </td>
              </tr>
              {enrollingId === a._id && a.status === 'Approved' && (
                <tr className="border-b bg-slate-50"><td colSpan={6} className="py-4 px-3">
                  <EnrollPanel application={a} onDone={(text) => { setBanner({ kind: 'ok', text }); void load(); }} />
                </td></tr>
              )}
            </Fragment>))}</tbody></table></div>
        )}
      </div>
    </div>
  </DashboardLayout>);
}
