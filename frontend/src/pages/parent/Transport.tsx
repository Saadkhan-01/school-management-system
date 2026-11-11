
import DashboardLayout from '../../components/layout/DashboardLayout';
import { PARENT_NAV } from './nav';
import { ChildSwitcher, useParentChildren } from './shared';
import { Banner, Section, refName, useLoader } from '../opsShared';
import { listAllocations } from '../../services/operations';
export default function ParentTransport() {
  const { children, childId, setChildId, loading } = useParentChildren();
  const allocs = useLoader(() => (childId ? listAllocations({ studentId: childId }) : Promise.resolve([])), [childId]);
  if (loading) return (<DashboardLayout role="parent" title="Transport" nav={PARENT_NAV}><p className="text-sm text-slate-500">Loading…</p></DashboardLayout>);
  return (<DashboardLayout role="parent" title="Transport" nav={PARENT_NAV}><div className="space-y-4">
    <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
    <Banner banner={allocs.banner} />
    <Section title="Child's transport allocation (read-only)">
      {(allocs.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No transport allocation for this child.</p> : <ul className="divide-y text-sm">{(allocs.data ?? []).map((a) => { const bus = a.bus as Record<string, unknown> | null; return <li key={a._id} className="py-2">Route <strong>{refName(a.route)}</strong> · Stop: {String(a.stop)} · Vehicle: {refName(a.bus)}{bus ? ` · Driver: ${String(bus.driverName ?? '')} (${String(bus.driverPhone ?? '')})` : ''} · {String(a.status)}</li>; })}</ul>}
    </Section>
  </div></DashboardLayout>);
}
