import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, assignmentLabel, btnCls, errText, ghostBtnCls, inputCls, labelCls, useMyAssignments } from './shared';
import { createMaterial, deleteMaterial, listMaterials, refName, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

export default function TeacherMaterials() {
  const { assignments: scope, error: scopeError } = useMyAssignments();
  const [items, setItems] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ scopeKey: '', title: '', description: '', fileName: '', fileUrl: '' });

  const load = useCallback(async () => {
    try { setItems(await listMaterials({ limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load study materials') }); setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const scopeRow = scope.find((a) => a._id === form.scopeKey) ?? scope[0];

  const add = async () => {
    if (!scopeRow) { setBanner({ kind: 'err', text: 'You have no assigned class/subject.' }); return; }
    try {
      await createMaterial({
        title: form.title, description: form.description || undefined,
        classId: String((scopeRow.schoolClass as Row)._id), sectionId: String((scopeRow.section as Row)._id),
        subjectId: String((scopeRow.subject as Row)._id), sessionId: String((scopeRow.session as Row)._id),
        fileName: form.fileName || undefined, fileUrl: form.fileUrl || undefined,
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Study material added. Students in this class can see it.' });
      setForm({ ...form, title: '', description: '', fileName: '', fileUrl: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Add failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="teacher" title="Study Materials" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={scopeError ? { kind: 'err', text: scopeError } : banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold">Add Study Material (§20)</h2>
        <p className="text-xs text-slate-500">File storage is not configured yet — materials are stored as title + file name/URL metadata, exactly like assignment attachments. Nothing is uploaded or faked.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Class / Section / Subject</label>
            <select className={inputCls} value={scopeRow?._id ?? ''} onChange={(e) => setForm({ ...form, scopeKey: e.target.value })}>
              {scope.length === 0 && <option value="">No assigned classes</option>}
              {scope.map((a) => <option key={a._id} value={a._id}>{assignmentLabel(a)}</option>)}
            </select></div>
          <div><label className={labelCls}>Title</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Algebra notes — week 3" /></div>
          <div><label className={labelCls}>File name</label><input className={inputCls} value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="notes.pdf" /></div>
          <div><label className={labelCls}>File URL</label><input className={inputCls} value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://…" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Description</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <button className={btnCls} onClick={() => void add()}>Add Material</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">Materials for My Classes</h3>
        {items.length === 0 ? <p className="text-sm text-slate-500">No materials yet.</p>
          : (<ul className="divide-y">{items.map((m) => (<li key={m._id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span><strong>{String(m.title)}</strong> · {refName(m.schoolClass)} · {refName(m.subject)}{m.fileUrl ? <> · <a className="text-brand hover:underline" href={String(m.fileUrl)} target="_blank" rel="noreferrer">Open file</a></> : ''}</span>
            <button className={ghostBtnCls} onClick={() => { void (async () => { try { await deleteMaterial(m._id); await load(); } catch (e) { setBanner({ kind: 'err', text: `Delete failed: ${apiErrorMessage(e)}` }); } })(); }}>Delete</button></li>))}</ul>)}
      </div>
    </div>
  </DashboardLayout>);
}
