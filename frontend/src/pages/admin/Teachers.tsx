import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import {
  createTeacher, createTeacherAssignment, deleteTeacherAssignment, fmtDate, listClasses, listSections,
  listSessions, listSubjects, listTeacherAssignments, listTeachers, refName, updateTeacher, userEmail, userName, type AnyRow,
} from '../../services/admin';

const inputCls = 'w-full border rounded px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium mb-1';

function TeacherAssignmentsPanel({ teacher }: { teacher: AnyRow }) {
  const teacherId = String(teacher._id);
  const [rows, setRows] = useState<AnyRow[] | null>(null);
  const [lookups, setLookups] = useState<{ sessions: AnyRow[]; classes: AnyRow[]; sections: AnyRow[]; subjects: AnyRow[] }>({ sessions: [], classes: [], sections: [], subjects: [] });
  const [form, setForm] = useState({ sessionId: '', classId: '', sectionId: '', subjectId: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try { const out = await listTeacherAssignments({ page: 1, limit: 100, filters: { teacherId } }); setRows(out.items); }
    catch (e) { setMsg({ kind: 'err', text: `Could not load assignments: ${apiErrorMessage(e)}` }); }
  }, [teacherId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    Promise.all([listSessions({ limit: 100 }), listClasses({ limit: 100 }), listSubjects({ limit: 100 })])
      .then(([s, c, sub]) => setLookups((l) => ({ ...l, sessions: s.items, classes: c.items, subjects: sub.items })))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!form.classId) { setLookups((l) => ({ ...l, sections: [] })); return; }
    listSections({ limit: 100, filters: { classId: form.classId } }).then((out) => setLookups((l) => ({ ...l, sections: out.items }))).catch(() => undefined);
  }, [form.classId]);

  const add = async () => {
    if (!form.sessionId || !form.classId || !form.sectionId || !form.subjectId) { setMsg({ kind: 'err', text: 'Select session, class, section and subject.' }); return; }
    try {
      await createTeacherAssignment({ teacherId, ...form } as never);
      setMsg({ kind: 'ok', text: 'Assignment created. The teacher can now see and manage this class/subject scope.' });
      await load();
    } catch (e) { setMsg({ kind: 'err', text: `Assignment failed: ${apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <p className="text-sm text-slate-600">Teacher assignments define the teacher's permitted scope for attendance, marks and student lists (§9). The same teacher + class + section + subject + session combination cannot be assigned twice.</p>
    {msg && <p className={`rounded p-3 text-sm ${msg.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{msg.text}</p>}
    {!rows ? <p className="text-sm text-slate-500">Loading assignments…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No assignments yet for this teacher.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-2 pr-3">Session</th><th className="pr-3">Class</th><th className="pr-3">Section</th><th className="pr-3">Subject</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((a) => (<tr key={String(a._id)} className="border-b last:border-0">
          <td className="py-2 pr-3">{refName(a.session)}</td><td className="pr-3">{refName(a.schoolClass)}</td><td className="pr-3">{refName(a.section)}</td><td className="pr-3">{refName(a.subject)}</td>
          <td><button className="text-red-600 font-medium" onClick={async () => { if (window.confirm('Remove this assignment?')) { try { await deleteTeacherAssignment(String(a._id)); await load(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } } }}>Remove</button></td>
        </tr>))}</tbody></table></div>
    )}
    <div className="grid gap-3 md:grid-cols-4 items-end">
      <div><label className={labelCls}>Session</label><select className={inputCls} value={form.sessionId} onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}><option value="">— Select —</option>{lookups.sessions.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}</option>)}</select></div>
      <div><label className={labelCls}>Class</label><select className={inputCls} value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, sectionId: '' }))}><option value="">— Select —</option>{lookups.classes.filter((c) => !form.sessionId || String((c.session as AnyRow)?._id ?? c.session) === form.sessionId).map((c) => <option key={String(c._id)} value={String(c._id)}>{String(c.name)}</option>)}</select></div>
      <div><label className={labelCls}>Section</label><select className={inputCls} value={form.sectionId} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}><option value="">— Select —</option>{lookups.sections.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.name)}</option>)}</select></div>
      <div><label className={labelCls}>Subject</label><select className={inputCls} value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}><option value="">— Select —</option>{lookups.subjects.filter((s) => !form.sessionId || String((s.session as AnyRow)?._id ?? s.session) === form.sessionId).map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.code)} — {String(s.name)}</option>)}</select></div>
    </div>
    <button onClick={() => void add()} className="bg-brand text-white px-4 py-2 rounded text-sm font-medium">Add assignment</button>
  </div>);
}

export default function TeachersPage() {
  return (<DashboardLayout role="admin" title="Teacher Management" nav={ADMIN_NAV}>
    <ResourceManager
      title="Teachers"
      description="Teacher profiles (§7/§9). Creating a teacher also creates their login account. Use “Assignments” on a row to assign classes, sections and subjects — that assignment is what scopes the teacher portal."
      load={(p) => listTeachers(p)}
      columns={[
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'name', label: 'Teacher', render: (r) => userName(r) },
        { key: 'email', label: 'Email', render: (r) => userEmail(r) },
        { key: 'specialization', label: 'Specialization', render: (r) => String(r.specialization ?? '—') },
        { key: 'qualification', label: 'Qualification', render: (r) => String(r.qualification ?? '—') },
        { key: 'joiningDate', label: 'Joined', render: (r) => fmtDate(r.joiningDate) },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email (login)', type: 'email', required: true, hideOnEdit: true },
        { name: 'password', label: 'Password (min 8 characters)', type: 'password', required: true, hideOnEdit: true },
        { name: 'employeeId', label: 'Employee ID (unique)', required: true },
        { name: 'qualification', label: 'Qualification' },
        { name: 'specialization', label: 'Specialization' },
        { name: 'subjectsNote', label: 'Subjects note' },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address' },
        { name: 'joiningDate', label: 'Joining date', type: 'date' },
        { name: 'isActive', label: 'Active', type: 'checkbox', onlyOnEdit: true },
      ]}
      toForm={(r) => ({ name: userName(r), employeeId: String(r.employeeId ?? ''), qualification: String(r.qualification ?? ''), specialization: String(r.specialization ?? ''), subjectsNote: String(r.subjectsNote ?? ''), phone: String(r.phone ?? ''), address: String(r.address ?? ''), joiningDate: r.joiningDate ? String(r.joiningDate).slice(0, 10) : '', isActive: Boolean(r.isActive) })}
      onCreate={async (v) => { await createTeacher(v as never); }}
      onUpdate={async (id, v) => { await updateTeacher(id, v as never); }}
      detailLabel="Assignments"
      detailPanel={(row) => <TeacherAssignmentsPanel teacher={row} />}
    />
  </DashboardLayout>);
}
