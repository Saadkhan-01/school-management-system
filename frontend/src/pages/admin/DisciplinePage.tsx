
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { DisciplinePanel } from './OpsSharedPanels';
import { Banner, Section, btnCls, inputCls, labelCls } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { createDiscipline } from '../../services/operations';
import { lookupStudents } from '../../services/finance';
import type { Row } from '../../services/academic';
export default function AdminDiscipline() {
  const [form, setForm] = useState({ studentId: '', incidentDate: '', category: '', description: '', actionTaken: '' });
  const [search, setSearch] = useState(''); const [found, setFound] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const submit = async () => { try { await createDiscipline(form); setMsg({ kind: 'ok', text: 'Discipline record created.' }); setNonce(nonce + 1); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="admin" title="Discipline" nav={ADMIN_NAV}><div className="space-y-4">
    <Banner banner={msg} />
    <Section title="Record an incident (restricted — Admin/Principal only)">
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className={labelCls}>Student search</label><input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (search) void lookupStudents(search).then(setFound).catch(() => setFound([])); }} /></div>
        <div><label className={labelCls}>Student</label><select className={inputCls} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Select…</option>{found.map((s) => <option key={s._id} value={s._id}>{String(s.firstName ?? '')} {String(s.lastName ?? '')}</option>)}</select></div>
        <div><label className={labelCls}>Incident date</label><input className={inputCls} type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} /></div>
        <div><label className={labelCls}>Category</label><input className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><label className={labelCls}>Description</label><input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className={labelCls}>Action taken</label><input className={inputCls} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void submit()}>Record</button>
    </Section>
    <div key={nonce}><DisciplinePanel /></div>
  </div></DashboardLayout>);
}
