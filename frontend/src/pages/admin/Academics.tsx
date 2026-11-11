import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import {
  createClass, createClassroom, createGradingScale, createSection, createSession, createSubject, createTeacherAssignment,
  deleteClass, deleteClassroom, deleteGradingScale, deleteSection, deleteSession, deleteSubject, deleteTeacherAssignment,
  fmtDate, listClasses, listClassrooms, listGradingScales, listSections, listSessions, listSubjects, listTeacherAssignments, listTeachers,
  refName, updateClass, updateClassroom, updateGradingScale, updateSection, updateSession, updateSubject, userName, type AnyRow,
} from '../../services/admin';

type Tab = 'sessions' | 'classes' | 'sections' | 'subjects' | 'classrooms' | 'grading' | 'assignments';
const TABS: Array<[Tab, string]> = [
  ['sessions', 'Academic Sessions'], ['classes', 'Classes'], ['sections', 'Sections'], ['subjects', 'Subjects'],
  ['classrooms', 'Classrooms'], ['grading', 'Grading Scales'], ['assignments', 'Teacher Assignments'],
];

export default function AcademicsPage() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [sections, setSections] = useState<AnyRow[]>([]);
  const [subjects, setSubjects] = useState<AnyRow[]>([]);
  const [teachers, setTeachers] = useState<AnyRow[]>([]);

  useEffect(() => {
    listSessions({ limit: 100 }).then((o) => setSessions(o.items)).catch(() => undefined);
    listClasses({ limit: 100 }).then((o) => setClasses(o.items)).catch(() => undefined);
    listSections({ limit: 100 }).then((o) => setSections(o.items)).catch(() => undefined);
    listSubjects({ limit: 100 }).then((o) => setSubjects(o.items)).catch(() => undefined);
    listTeachers({ limit: 100 }).then((o) => setTeachers(o.items)).catch(() => undefined);
  }, [tab]);

  const sessionOpts = sessions.map((s) => ({ value: String(s._id), label: String(s.name) }));
  const classOpts = classes.map((c) => ({ value: String(c._id), label: `${String(c.name)} (${refName(c.session)})` }));
  const sectionOpts = sections.map((s) => ({ value: String(s._id), label: `${refName(s.schoolClass)} · ${String(s.name)}` }));
  const subjectOpts = subjects.map((s) => ({ value: String(s._id), label: `${String(s.code)} — ${String(s.name)}` }));
  const teacherOpts = teachers.map((t) => ({ value: String(t._id), label: `${userName(t)} (${String(t.employeeId)})` }));

  return (<DashboardLayout role="admin" title="Academic Management" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold">Academic Management (§17)</h2>
        <p className="text-sm text-slate-600 mt-1">Sessions, classes, sections, subjects, classrooms, grading scales and teacher assignments. Uniqueness is enforced by the API (class per session, section per class, subject code per session, one current session).</p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'sessions' && <ResourceManager key="sessions"
        title="Academic Sessions"
        description="One session can be marked Current at a time — marking another session current clears the previous one. A session with classes cannot be deleted."
        load={(p) => listSessions(p)}
        columns={[
          { key: 'name', label: 'Session' },
          { key: 'startDate', label: 'Starts', render: (r) => fmtDate(r.startDate) },
          { key: 'endDate', label: 'Ends', render: (r) => fmtDate(r.endDate) },
          { key: 'isCurrent', label: 'Current', render: (r) => (r.isCurrent ? <span className="text-green-700 font-medium">Current</span> : '—') },
        ]}
        fields={[
          { name: 'name', label: 'Name (e.g. 2026–27)', required: true },
          { name: 'startDate', label: 'Start date', type: 'date', required: true },
          { name: 'endDate', label: 'End date', type: 'date', required: true },
          { name: 'isCurrent', label: 'Current session', type: 'checkbox' },
        ]}
        toForm={(r) => ({ name: String(r.name ?? ''), startDate: r.startDate ? String(r.startDate).slice(0, 10) : '', endDate: r.endDate ? String(r.endDate).slice(0, 10) : '', isCurrent: Boolean(r.isCurrent) })}
        onCreate={async (v) => { await createSession(v as never); }}
        onUpdate={async (id, v) => { await updateSession(id, v as never); }}
        onDelete={async (id) => { await deleteSession(id); }}
      />}

      {tab === 'classes' && <ResourceManager key="classes"
        title="Classes"
        description="A class name is unique within its academic session."
        load={(p) => listClasses(p)}
        filters={[{ name: 'sessionId', label: 'Session', options: sessionOpts }]}
        columns={[
          { key: 'name', label: 'Class' },
          { key: 'session', label: 'Session', render: (r) => refName(r.session) },
          { key: 'level', label: 'Level', render: (r) => (r.level == null ? '—' : String(r.level)) },
          { key: 'description', label: 'Description', render: (r) => String(r.description ?? '—') },
        ]}
        fields={[
          { name: 'name', label: 'Class name (e.g. Class 6)', required: true },
          { name: 'sessionId', label: 'Academic session', type: 'select', options: sessionOpts, required: true },
          { name: 'level', label: 'Level / order (0–20)', type: 'number' },
          { name: 'description', label: 'Description' },
        ]}
        toForm={(r) => ({ name: String(r.name ?? ''), sessionId: String((r.session as AnyRow)?._id ?? ''), level: r.level == null ? '' : String(r.level), description: String(r.description ?? '') })}
        onCreate={async (v) => { await createClass(v as never); }}
        onUpdate={async (id, v) => { await updateClass(id, v as never); }}
        onDelete={async (id) => { await deleteClass(id); }}
      />}

      {tab === 'sections' && <ResourceManager key="sections"
        title="Sections"
        description="A section name is unique within its class."
        load={(p) => listSections(p)}
        filters={[{ name: 'classId', label: 'Class', options: classOpts }]}
        columns={[
          { key: 'name', label: 'Section' },
          { key: 'schoolClass', label: 'Class', render: (r) => refName(r.schoolClass) },
          { key: 'capacity', label: 'Capacity', render: (r) => (r.capacity == null ? '—' : String(r.capacity)) },
          { key: 'classTeacher', label: 'Class teacher', render: (r) => { const ct = (r.classTeacher ?? {}) as AnyRow; const u = (ct.user ?? {}) as AnyRow; return typeof u.name === 'string' ? String(u.name) : '—'; } },
        ]}
        fields={[
          { name: 'classId', label: 'Class', type: 'select', options: classOpts, required: true },
          { name: 'name', label: 'Section name (e.g. A)', required: true },
          { name: 'capacity', label: 'Capacity', type: 'number' },
          { name: 'classTeacherId', label: 'Class teacher', type: 'select', options: teacherOpts },
        ]}
        toForm={(r) => ({ classId: String((r.schoolClass as AnyRow)?._id ?? ''), name: String(r.name ?? ''), capacity: r.capacity == null ? '' : String(r.capacity), classTeacherId: String((r.classTeacher as AnyRow)?._id ?? '') })}
        onCreate={async (v) => { await createSection(v as never); }}
        onUpdate={async (id, v) => { await updateSection(id, v as never); }}
        onDelete={async (id) => { await deleteSection(id); }}
      />}

      {tab === 'subjects' && <ResourceManager key="subjects"
        title="Subjects"
        description="A subject code is unique within its academic session."
        load={(p) => listSubjects(p)}
        filters={[{ name: 'sessionId', label: 'Session', options: sessionOpts }]}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Subject' },
          { key: 'session', label: 'Session', render: (r) => refName(r.session) },
          { key: 'description', label: 'Description', render: (r) => String(r.description ?? '—') },
        ]}
        fields={[
          { name: 'name', label: 'Subject name', required: true },
          { name: 'code', label: 'Code (e.g. MATH)', required: true },
          { name: 'sessionId', label: 'Academic session', type: 'select', options: sessionOpts, required: true },
          { name: 'description', label: 'Description' },
        ]}
        toForm={(r) => ({ name: String(r.name ?? ''), code: String(r.code ?? ''), sessionId: String((r.session as AnyRow)?._id ?? ''), description: String(r.description ?? '') })}
        onCreate={async (v) => { await createSubject(v as never); }}
        onUpdate={async (id, v) => { await updateSubject(id, v as never); }}
        onDelete={async (id) => { await deleteSubject(id); }}
      />}

      {tab === 'classrooms' && <ResourceManager key="classrooms"
        title="Classrooms"
        description="Physical rooms used by timetable planning (Phase 5 conflict checks build on these records)."
        load={(p) => listClassrooms(p)}
        columns={[
          { key: 'name', label: 'Room' },
          { key: 'capacity', label: 'Capacity', render: (r) => (r.capacity == null ? '—' : String(r.capacity)) },
          { key: 'location', label: 'Location', render: (r) => String(r.location ?? '—') },
          { key: 'facilities', label: 'Facilities', render: (r) => String(r.facilities ?? '—') },
        ]}
        fields={[
          { name: 'name', label: 'Room name (unique)', required: true },
          { name: 'capacity', label: 'Capacity', type: 'number' },
          { name: 'location', label: 'Location / floor' },
          { name: 'facilities', label: 'Facilities' },
        ]}
        onCreate={async (v) => { await createClassroom(v as never); }}
        onUpdate={async (id, v) => { await updateClassroom(id, v as never); }}
        onDelete={async (id) => { await deleteClassroom(id); }}
      />}

      {tab === 'grading' && <ResourceManager key="grading"
        title="Grading Scales"
        description='Ranges are entered as JSON, e.g. [{"min":85,"max":100,"grade":"A+","points":4},{"min":70,"max":84,"grade":"A"}]. One scale can be marked Default.'
        load={(p) => listGradingScales(p)}
        columns={[
          { key: 'name', label: 'Scale' },
          { key: 'session', label: 'Session', render: (r) => refName(r.session) },
          { key: 'ranges', label: 'Ranges', render: (r) => { const ranges = (r.ranges ?? []) as Array<{ min: number; max: number; grade: string }>; return ranges.map((x) => `${x.grade} (${x.min}–${x.max})`).join(', ') || '—'; } },
          { key: 'isDefault', label: 'Default', render: (r) => (r.isDefault ? 'Yes' : '—') },
        ]}
        fields={[
          { name: 'name', label: 'Scale name', required: true },
          { name: 'sessionId', label: 'Academic session (optional)', type: 'select', options: sessionOpts },
          { name: 'rangesJson', label: 'Ranges (JSON array)', type: 'textarea', required: true, placeholder: '[{"min":85,"max":100,"grade":"A+"}]' },
          { name: 'isDefault', label: 'Default scale', type: 'checkbox' },
        ]}
        toForm={(r) => ({ name: String(r.name ?? ''), sessionId: String((r.session as AnyRow)?._id ?? ''), rangesJson: JSON.stringify(r.ranges ?? [], null, 2), isDefault: Boolean(r.isDefault) })}
        mapSubmit={(values) => {
          let ranges: unknown;
          try { ranges = JSON.parse(String(values.rangesJson || '[]')); } catch { throw new Error('Ranges JSON is invalid — fix the JSON and try again.'); }
          if (!Array.isArray(ranges)) throw new Error('Ranges must be a JSON array.');
          const out: Record<string, unknown> = { name: values.name, ranges, isDefault: Boolean(values.isDefault) };
          if (values.sessionId) out.sessionId = values.sessionId;
          return out;
        }}
        onCreate={async (v) => { await createGradingScale(v as never); }}
        onUpdate={async (id, v) => { await updateGradingScale(id, v as never); }}
        onDelete={async (id) => { await deleteGradingScale(id); }}
      />}

      {tab === 'assignments' && <ResourceManager key="assignments"
        title="Teacher Assignments"
        description="The full assignment list across teachers. The same combination (teacher, class, section, subject, session) cannot be created twice. Per-teacher management is also available from Teachers → Assignments."
        load={(p) => listTeacherAssignments(p)}
        filters={[{ name: 'sessionId', label: 'Session', options: sessionOpts }, { name: 'teacherId', label: 'Teacher', options: teacherOpts }]}
        columns={[
          { key: 'teacher', label: 'Teacher', render: (r) => { const t = (r.teacher ?? {}) as AnyRow; const u = (t.user ?? {}) as AnyRow; return typeof u.name === 'string' ? `${String(u.name)} (${String(t.employeeId ?? '')})` : '—'; } },
          { key: 'session', label: 'Session', render: (r) => refName(r.session) },
          { key: 'schoolClass', label: 'Class', render: (r) => refName(r.schoolClass) },
          { key: 'section', label: 'Section', render: (r) => refName(r.section) },
          { key: 'subject', label: 'Subject', render: (r) => refName(r.subject) },
        ]}
        fields={[
          { name: 'teacherId', label: 'Teacher', type: 'select', options: teacherOpts, required: true },
          { name: 'sessionId', label: 'Session', type: 'select', options: sessionOpts, required: true },
          { name: 'classId', label: 'Class', type: 'select', options: classOpts, required: true },
          { name: 'sectionId', label: 'Section', type: 'select', options: sectionOpts, required: true },
          { name: 'subjectId', label: 'Subject', type: 'select', options: subjectOpts, required: true },
        ]}
        onCreate={async (v) => { await createTeacherAssignment(v as never); }}
        onDelete={async (id) => { await deleteTeacherAssignment(id); }}
      />}
    </div>
  </DashboardLayout>);
}
