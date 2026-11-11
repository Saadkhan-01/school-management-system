import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, btnCls, errText, inputCls, labelCls } from './shared';
import { createLeave, listLeave, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

export default function TeacherLeave() {
  const [items, setItems] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ leaveType: 'sick', fromDate: '', toDate: '', reason: '' });

  const load = useCallback(async () => {
    try { setItems(await listLeave({ limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load your leave applications') }); setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const apply = async () => {
    try {
      await createLeave({ leaveType: form.leaveType, fromDate: form.fromDate, toDate: form.toDate, reason: form.reason } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Leave application submitted. A Principal or Admin will decide it.' });
      setForm({ leaveType: 'sick', fromDate: '', toDate: '', reason: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Application failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="teacher" title="Leave Application" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold">Apply for Leave (§9/§13)</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Type</label>
            <select className={inputCls} value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
              {['sick', 'casual', 'annual', 'emergency', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label className={labelCls}>Reason</label><input className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief reason" /></div>
          <div><label className={labelCls}>From</label><input type="date" className={inputCls} value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
          <div><label className={labelCls}>To</label><input type="date" className={inputCls} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
        </div>
        <button className={btnCls} onClick={() => void apply()}>Submit Application</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">My Applications</h3>
        {items.length === 0 ? <p className="text-sm text-slate-500">No applications yet.</p>
          : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">From</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Status</th><th className="py-2">Decision note</th></tr></thead>
            <tbody>{items.map((l) => (<tr key={l._id} className="border-b last:border-0"><td className="py-2 pr-3 capitalize">{String(l.leaveType)}</td>
              <td className="py-2 pr-3">{new Date(String(l.fromDate)).toLocaleDateString()}</td><td className="py-2 pr-3">{new Date(String(l.toDate)).toLocaleDateString()}</td>
              <td className="py-2 pr-3 capitalize">{String(l.status)}</td><td className="py-2">{(l.decisionNote as string) ?? '—'}</td></tr>))}</tbody></table></div>)}
      </div>
    </div>
  </DashboardLayout>);
}
