
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RECEPTIONIST_NAV } from './nav';
import { Banner, Section, btnCls, ghostBtnCls, inputCls, labelCls, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { checkInVisitor, checkOutVisitor, listVisitors } from '../../services/operations';
export default function ReceptionistVisitors() {
  const visitors = useLoader(() => listVisitors());
  const [form, setForm] = useState({ name: '', phone: '', purpose: '', visitingWhom: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); visitors.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="receptionist" title="Visitors" nav={RECEPTIONIST_NAV}><div className="space-y-4">
    <Banner banner={msg ?? visitors.banner} />
    <Section title="Check in a visitor">
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className={labelCls}>Purpose</label><input className={inputCls} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
        <div><label className={labelCls}>Visiting whom</label><input className={inputCls} value={form.visitingWhom} onChange={(e) => setForm({ ...form, visitingWhom: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => checkInVisitor(form), 'Visitor checked in.')}>Check in</button>
    </Section>
    <Section title="Visitor log">
      <ul className="divide-y text-sm">{(visitors.data ?? []).map((v) => <li key={v._id} className="py-2 flex justify-between gap-2"><span><strong>{String(v.name)}</strong> · {String(v.purpose)} → {String(v.visitingWhom)} · in {new Date(String(v.checkInAt)).toLocaleString()}{v.checkOutAt ? ` · out ${new Date(String(v.checkOutAt)).toLocaleString()}` : ' · on premises'}</span>{!v.checkOutAt && <button className={ghostBtnCls} onClick={() => void act(() => checkOutVisitor(v._id), 'Visitor checked out.')}>Check out</button>}</li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
