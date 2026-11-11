import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import {
  createEnrollment, fmtDate, listClasses, listEnrollments, listSections, listSessions, listStudents,
  promoteEnrollment, refName, transferEnrollment, withdrawEnrollment, type AnyRow,
} from '../../services/admin';

const inputCls = 'w-full border rounded px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium mb-1';
const STATUS_OPTIONS = ['active', 'transferred', 'withdrawn', 'promoted', 'completed'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

function PlacementForm({ sessions, classes, onDone, submitLabel, onSubmit }: {
  sessions: AnyRow[]; classes: AnyRow[];
  submitLabel: string;
  onSubmit: (body: { sessionId?: string; classId: string; sectionId: string }) => Promise<void>;
  onDone: () => void;
}) {
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [sections, setSections] = useState<AnyRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!classId) { setSections([]); return; }
    listSections({ limit: 100, filters: { classId } }).then((o) => setSections(o.items)).catch(() => setSections([]));
  }, [classId]);
  const visibleClasses = classes.filter((c) => !sessionId || String((c.session as AnyRow)?._id ?? c.session) === sessionId);
  return (<div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-3">
      <div><label className={labelCls}>Session</label><select className={inputCls} value={sessionId} onChange={(e) => { setSessionId(e.target.value); setClassId(''); setSectionId(''); }}><option value="">— Select —</option>{sessions.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}</option>)}</select></div>
      <div><label className={labelCls}>Class</label><select className={inputCls} value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}><option value="">— Select —</option>{visibleClasses.map((c) => <option key={String(c._id)} value={String(c._id)}>{String(c.name)}</option>)}</select></div>
      <div><label className={labelCls}>Section</label><select className={inputCls} value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">— Select —</option>{sections.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}</option>)}</select></div>
    </div>
    {msg && <p className="text-sm text-red-600">{msg}</p>}
    <button className="bg-brand text-white px-4 py-2 rounded text-sm font-medium" onClick={async () => {
      if (!classId || !sectionId) { setMsg('Select a class and a section.'); return; }
      try { await onSubmit({ sessionId: sessionId || undefined, classId, sectionId }); onDone(); }
      catch (e) { setMsg(apiErrorMessage(e)); }
    }}>{submitLabel}</button>
  </div>);
}

function EnrollmentDetail({ row, helpers }: { row: AnyRow; helpers: { reload: () => void; notify: (k: 'ok' | 'err', t: string) => void } }) {
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [mode, setMode] = useState<'none' | 'transfer' | 'promote'>('none');
  useEffect(() => {
    listSessions({ limit: 100 }).then((o) => setSessions(o.items)).catch(() => undefined);
    listClasses({ limit: 100 }).then((o) => setClasses(o.items)).catch(() => undefined);
  }, []);
  const stu = (row.student ?? {}) as AnyRow;
  const isActive = row.status === 'active';
  return (<div className="space-y-4 text-sm">
    <div className="grid gap-2 md:grid-cols-2">
      <p><span className="text-slate-500">Student:</span> {String(stu.firstName ?? '')} {String(stu.lastName ?? '')} ({String(stu.admissionNumber ?? '—')})</p>
      <p><span className="text-slate-500">Placement:</span> {refName(row.session)} · {refName(row.schoolClass)} · Section {refName(row.section)}</p>
      <p><span className="text-slate-500">Status:</span> <span className="capitalize font-medium">{String(row.status)}</span></p>
      <p><span className="text-slate-500">Enrolled:</span> {fmtDate(row.enrollmentDate)}{row.closedAt ? ` · Closed: ${fmtDate(row.closedAt)}` : ''}</p>
      {row.statusNote ? <p className="md:col-span-2"><span className="text-slate-500">Note:</span> {String(row.statusNote)}</p> : null}
    </div>
    <p className="text-slate-600">History is preserved: transfer and promotion close this record and create a new one — nothing is overwritten.</p>
    {isActive ? (<div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button className={`px-3 py-1.5 rounded text-sm font-medium ${mode === 'transfer' ? 'bg-brand text-white' : 'bg-slate-100'}`} onClick={() => setMode(mode === 'transfer' ? 'none' : 'transfer')}>Transfer (same session)</button>
        <button className={`px-3 py-1.5 rounded text-sm font-medium ${mode === 'promote' ? 'bg-brand text-white' : 'bg-slate-100'}`} onClick={() => setMode(mode === 'promote' ? 'none' : 'promote')}>Promote (next session)</button>
        <button className="px-3 py-1.5 rounded text-sm font-medium bg-red-50 text-red-700" onClick={async () => {
          if (!window.confirm('Withdraw this enrollment? The record is kept with status “withdrawn”.')) return;
          try { await withdrawEnrollment(String(row._id)); helpers.notify('ok', 'Enrollment withdrawn.'); helpers.reload(); }
          catch (e) { helpers.notify('err', `Withdraw failed: ${apiErrorMessage(e)}`); }
        }}>Withdraw</button>
      </div>
      {mode === 'transfer' && <PlacementForm sessions={sessions} classes={classes.filter((c) => String((c.session as AnyRow)?._id ?? c.session) === String((row.session as AnyRow)?._id ?? row.session))} submitLabel="Transfer student"
        onSubmit={async (b) => { await transferEnrollment(String(row._id), { classId: b.classId, sectionId: b.sectionId } as never); helpers.notify('ok', 'Student transferred — a new active enrollment was created and the old one closed.'); }}
        onDone={() => { setMode('none'); helpers.reload(); }} />}
      {mode === 'promote' && <PlacementForm sessions={sessions} classes={classes} submitLabel="Promote student"
        onSubmit={async (b) => { if (!b.sessionId) throw new Error('Select the target session.'); await promoteEnrollment(String(row._id), { toSessionId: b.sessionId, toClassId: b.classId, toSectionId: b.sectionId } as never); helpers.notify('ok', 'Student promoted — the new-session enrollment is active and prior history is preserved.'); }}
        onDone={() => { setMode('none'); helpers.reload(); }} />}
    </div>) : <p className="text-slate-500">This enrollment is closed ({String(row.status)}). Only active enrollments can be transferred, withdrawn or promoted.</p>}
  </div>);
}

export default function EnrollmentsPage() {
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [sections, setSections] = useState<AnyRow[]>([]);
  const [students, setStudents] = useState<AnyRow[]>([]);
  useEffect(() => {
    listSessions({ limit: 100 }).then((o) => setSessions(o.items)).catch(() => undefined);
    listClasses({ limit: 100 }).then((o) => setClasses(o.items)).catch(() => undefined);
    listSections({ limit: 100 }).then((o) => setSections(o.items)).catch(() => undefined);
    listStudents({ limit: 100, filters: { status: 'active' } }).then((o) => setStudents(o.items)).catch(() => undefined);
  }, []);
  const opts = (rows: AnyRow[], label: (r: AnyRow) => string) => rows.map((r) => ({ value: String(r._id), label: label(r) }));
  return (<DashboardLayout role="admin" title="Enrollments" nav={ADMIN_NAV}>
    <ResourceManager
      title="Enrollments"
      description="Student placements (§17). A student can have only ONE active enrollment per session — the API rejects duplicates with 409. Open a row to transfer, withdraw or promote while preserving history."
      load={(p) => listEnrollments(p)}
      filters={[
        { name: 'status', label: 'Status', options: STATUS_OPTIONS },
        { name: 'sessionId', label: 'Session', options: opts(sessions, (s) => String(s.name)) },
        { name: 'classId', label: 'Class', options: opts(classes, (c) => String(c.name)) },
      ]}
      columns={[
        { key: 'student', label: 'Student', render: (r) => { const s = (r.student ?? {}) as AnyRow; return `${String(s.firstName ?? '')} ${String(s.lastName ?? '')} (${String(s.admissionNumber ?? '—')})`; } },
        { key: 'session', label: 'Session', render: (r) => refName(r.session) },
        { key: 'schoolClass', label: 'Class', render: (r) => refName(r.schoolClass) },
        { key: 'section', label: 'Section', render: (r) => refName(r.section) },
        { key: 'enrollmentDate', label: 'Enrolled', render: (r) => fmtDate(r.enrollmentDate) },
        { key: 'status', label: 'Status', render: (r) => <span className="capitalize font-medium">{String(r.status)}</span> },
      ]}
      fields={[
        { name: 'studentId', label: 'Student', type: 'select', options: opts(students, (s) => `${String(s.admissionNumber)} — ${String(s.firstName)} ${String(s.lastName)}`), required: true },
        { name: 'sessionId', label: 'Session', type: 'select', options: opts(sessions, (s) => String(s.name)), required: true },
        { name: 'classId', label: 'Class', type: 'select', options: opts(classes, (c) => `${String(c.name)} (${refName(c.session)})`), required: true },
        { name: 'sectionId', label: 'Section', type: 'select', options: opts(sections, (s) => `${refName(s.schoolClass)} · ${String(s.name)}`), required: true },
        { name: 'enrollmentDate', label: 'Enrollment date', type: 'date' },
        { name: 'notes', label: 'Notes' },
      ]}
      onCreate={async (v) => { await createEnrollment(v as never); }}
      detailLabel="Manage"
      detailPanel={(row, helpers) => <EnrollmentDetail row={row} helpers={helpers} />}
    />
  </DashboardLayout>);
}
