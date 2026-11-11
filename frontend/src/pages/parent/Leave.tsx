import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import { createLeave, listLeave, refName, type Row } from '../../services/academic';
import { Banner, btnCls, errText, inputCls, labelCls } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

const LEAVE_TYPES = ['sick', 'casual', 'annual', 'emergency', 'other'];

/** Leave applications for the selected child (Phase 5 leave API — the server
 *  requires a verified link for the studentId on every create). */
export default function ParentLeave() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ leaveType: 'sick', fromDate: '', toDate: '', reason: '' });

  const load = useCallback(async () => {
    if (!childId) return;
    setListLoading(true);
    try {
      const rows = await listLeave({ limit: 50 });
      setLeaves(rows.filter((l) => String((l.student as Row | null)?._id ?? l.student ?? '') === childId));
    } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load leave applications') }); setLeaves([]); }
    finally { setListLoading(false); }
  }, [childId]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setBanner(null);
    try {
      await createLeave({ studentId: childId, leaveType: form.leaveType, fromDate: form.fromDate, toDate: form.toDate, reason: form.reason } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Leave application submitted. The school will review it.' });
      setForm({ leaveType: 'sick', fromDate: '', toDate: '', reason: '' });
      void load();
    } catch (e) { setBanner({ kind: 'err', text: `Could not submit leave: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="parent" title="Leave Applications" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : banner} />
      {loading ? <LoadingNote /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        <Section title="Apply for leave for this child">
          <div className="grid md:grid-cols-2 gap-3 max-w-2xl">
            <div><label className={labelCls}>Leave type</label>
              <select className={inputCls} value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select></div>
            <div><label className={labelCls}>Reason</label><input className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief reason for the leave" /></div>
            <div><label className={labelCls}>From date</label><input type="date" className={inputCls} value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
            <div><label className={labelCls}>To date</label><input type="date" className={inputCls} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
          </div>
          <button className={`${btnCls} mt-3`} onClick={() => void submit()} disabled={!form.fromDate || !form.toDate || form.reason.trim().length < 3}>Submit application</button>
        </Section>
        <Section title="Applications for this child">
          {listLoading ? <LoadingNote /> : leaves.length === 0
            ? <p className="text-sm text-slate-500">No leave applications for this child yet.</p>
            : (<ul className="divide-y text-sm">{leaves.map((l) => (<li key={l._id} className="py-2 flex justify-between gap-3">
              <span><strong className="capitalize">{String(l.leaveType)}</strong> · {new Date(String(l.fromDate)).toLocaleDateString()} → {new Date(String(l.toDate)).toLocaleDateString()} · {String(l.reason)}{l.student ? <> · {refName(l.student)}</> : null}{l.decisionNote ? <><br /><span className="text-slate-500">Decision note: {String(l.decisionNote)}</span></> : null}</span>
              <span className="capitalize font-medium">{String(l.status)}</span></li>))}</ul>)}
        </Section>
      </>)}
    </div>
  </DashboardLayout>);
}
