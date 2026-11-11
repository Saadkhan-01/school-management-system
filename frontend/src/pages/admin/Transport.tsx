
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, Section, btnCls, fmtDate, fmtMinor, ghostBtnCls, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { cancelAllocation, createAllocation, createBus, createMaintenance, createRoute, listAllocations, listBuses, listExpiring, listMaintenance, listRoutes } from '../../services/operations';
import { getFinanceReferenceData, lookupStudents } from '../../services/finance';
import type { Row } from '../../services/academic';
export default function AdminTransport() {
  const buses = useLoader(() => listBuses()); const routes = useLoader(() => listRoutes());
  const allocs = useLoader(() => listAllocations()); const maint = useLoader(() => listMaintenance());
  const expiring = useLoader(() => listExpiring(30)); const refs = useLoader(() => getFinanceReferenceData());
  const [tab, setTab] = useState<'buses' | 'routes' | 'allocations' | 'maintenance'>('buses');
  const [bus, setBus] = useState({ name: '', registrationNumber: '', capacity: '40', driverName: '', driverPhone: '', insuranceExpiry: '' });
  const [route, setRoute] = useState({ name: '', stops: '' });
  const [alloc, setAlloc] = useState({ studentId: '', routeId: '', busId: '', stop: '', sessionId: '' });
  const [mrec, setMrec] = useState({ busId: '', date: '', type: '', cost: '' });
  const [search, setSearch] = useState(''); const [found, setFound] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); buses.reload(); routes.reload(); allocs.reload(); maint.reload(); expiring.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  const routeStops = ((routes.data ?? []).find((r) => r._id === alloc.routeId)?.stops as string[] | undefined) ?? [];
  return (<DashboardLayout role="admin" title="Transport" nav={ADMIN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? buses.banner} />
    <div className="flex gap-2">{(['buses', 'routes', 'allocations', 'maintenance'] as const).map((t) => <button key={t} className={tab === t ? btnCls : ghostBtnCls} onClick={() => setTab(t)}>{t}</button>)}</div>
    {(expiring.data ?? []).length > 0 && <Section title="Documents expiring within 30 days"><ul className="text-sm">{(expiring.data ?? []).map((e, i) => <li key={i}>{String(e.busName)} ({String(e.registrationNumber)}) — {String(e.document)} expires {fmtDate(e.expiryDate)}{e.expired ? ' — EXPIRED' : ''}</li>)}</ul></Section>}
    {tab === 'buses' && <Section title="Vehicles">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={bus.name} onChange={(e) => setBus({ ...bus, name: e.target.value })} /></div>
        <div><label className={labelCls}>Registration (unique)</label><input className={inputCls} value={bus.registrationNumber} onChange={(e) => setBus({ ...bus, registrationNumber: e.target.value })} /></div>
        <div><label className={labelCls}>Capacity</label><input className={inputCls} type="number" value={bus.capacity} onChange={(e) => setBus({ ...bus, capacity: e.target.value })} /></div>
        <div><label className={labelCls}>Driver</label><input className={inputCls} value={bus.driverName} onChange={(e) => setBus({ ...bus, driverName: e.target.value })} /></div>
        <div><label className={labelCls}>Driver phone</label><input className={inputCls} value={bus.driverPhone} onChange={(e) => setBus({ ...bus, driverPhone: e.target.value })} /></div>
        <div><label className={labelCls}>Insurance expiry</label><input className={inputCls} type="date" value={bus.insuranceExpiry} onChange={(e) => setBus({ ...bus, insuranceExpiry: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createBus({ ...bus, capacity: Number(bus.capacity), insuranceExpiry: bus.insuranceExpiry || undefined }), 'Vehicle added.')}>Add vehicle</button>
      <ul className="divide-y text-sm mt-3">{(buses.data ?? []).map((b) => <li key={b._id} className="py-2">{String(b.name)} · {String(b.registrationNumber)} · cap {String(b.capacity)} · {String(b.driverName)}</li>)}</ul>
    </Section>}
    {tab === 'routes' && <Section title="Routes (stops in order, comma-separated)">
      <div className="flex gap-2"><input className={inputCls} placeholder="Route name" value={route.name} onChange={(e) => setRoute({ ...route, name: e.target.value })} /><input className={inputCls} placeholder="Stop A, Stop B, School" value={route.stops} onChange={(e) => setRoute({ ...route, stops: e.target.value })} /><button className={btnCls} onClick={() => void act(() => createRoute({ name: route.name, stops: route.stops.split(',').map((s) => s.trim()).filter(Boolean) }), 'Route created.')}>Add</button></div>
      <ul className="divide-y text-sm mt-3">{(routes.data ?? []).map((r) => <li key={r._id} className="py-2"><strong>{String(r.name)}</strong> — {((r.stops as string[]) ?? []).join(' → ')}</li>)}</ul>
    </Section>}
    {tab === 'allocations' && <Section title="Student allocations (capacity enforced)">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Student search</label><input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (search) void lookupStudents(search).then(setFound).catch(() => setFound([])); }} /></div>
        <div><label className={labelCls}>Student</label><select className={inputCls} value={alloc.studentId} onChange={(e) => setAlloc({ ...alloc, studentId: e.target.value })}><option value="">Select…</option>{found.map((s) => <option key={s._id} value={s._id}>{String(s.firstName ?? '')} {String(s.lastName ?? '')}</option>)}</select></div>
        <div><label className={labelCls}>Session</label><select className={inputCls} value={alloc.sessionId} onChange={(e) => setAlloc({ ...alloc, sessionId: e.target.value })}><option value="">Select…</option>{((refs.data?.sessions as Row[] | undefined) ?? []).map((s) => <option key={s._id} value={s._id}>{String(s.name)}</option>)}</select></div>
        <div><label className={labelCls}>Route</label><select className={inputCls} value={alloc.routeId} onChange={(e) => setAlloc({ ...alloc, routeId: e.target.value })}><option value="">Select…</option>{(routes.data ?? []).map((r) => <option key={r._id} value={r._id}>{String(r.name)}</option>)}</select></div>
        <div><label className={labelCls}>Vehicle</label><select className={inputCls} value={alloc.busId} onChange={(e) => setAlloc({ ...alloc, busId: e.target.value })}><option value="">Select…</option>{(buses.data ?? []).map((b) => <option key={b._id} value={b._id}>{String(b.name)}</option>)}</select></div>
        <div><label className={labelCls}>Stop</label><select className={inputCls} value={alloc.stop} onChange={(e) => setAlloc({ ...alloc, stop: e.target.value })}><option value="">Select…</option>{routeStops.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createAllocation(alloc), 'Allocation created.')}>Allocate</button>
      <ul className="divide-y text-sm mt-3">{(allocs.data ?? []).map((a) => <li key={a._id} className="py-2 flex justify-between"><span>{refName(a.student)} · {refName(a.route)} · {refName(a.bus)} · {String(a.stop)} · {String(a.status)}</span>{a.status === 'active' && <button className={ghostBtnCls} onClick={() => void act(() => cancelAllocation(a._id), 'Allocation cancelled.')}>Cancel</button>}</li>)}</ul>
    </Section>}
    {tab === 'maintenance' && <Section title="Maintenance records (cost in major units → stored as minor)">
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className={labelCls}>Vehicle</label><select className={inputCls} value={mrec.busId} onChange={(e) => setMrec({ ...mrec, busId: e.target.value })}><option value="">Select…</option>{(buses.data ?? []).map((b) => <option key={b._id} value={b._id}>{String(b.name)}</option>)}</select></div>
        <div><label className={labelCls}>Date</label><input className={inputCls} type="date" value={mrec.date} onChange={(e) => setMrec({ ...mrec, date: e.target.value })} /></div>
        <div><label className={labelCls}>Type</label><input className={inputCls} value={mrec.type} onChange={(e) => setMrec({ ...mrec, type: e.target.value })} /></div>
        <div><label className={labelCls}>Cost</label><input className={inputCls} type="number" step="0.01" value={mrec.cost} onChange={(e) => setMrec({ ...mrec, cost: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createMaintenance({ busId: mrec.busId, date: mrec.date, type: mrec.type, cost: Math.round(Number(mrec.cost) * 100) }), 'Maintenance recorded.')}>Record</button>
      <ul className="divide-y text-sm mt-3">{(maint.data ?? []).map((m) => <li key={m._id} className="py-2">{refName(m.bus)} · {String(m.type)} · {fmtDate(m.date)} · {fmtMinor(m.cost)}</li>)}</ul>
    </Section>}
    <p className="text-xs text-slate-500">Live GPS tracking is intentionally not implemented — it requires a real configured tracking service (future extension).</p>
  </div></DashboardLayout>);
}
