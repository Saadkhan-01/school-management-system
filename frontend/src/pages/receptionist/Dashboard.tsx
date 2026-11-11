
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RECEPTIONIST_NAV } from './nav';
import { Banner, Section, useLoader } from '../opsShared';
import { visitorDashboard } from '../../services/operations';
export default function ReceptionistDashboard() {
  const { data, banner } = useLoader(() => visitorDashboard());
  return (<DashboardLayout role="receptionist" title="Receptionist Dashboard" nav={RECEPTIONIST_NAV}>
    <Banner banner={banner} />
    <Section title="Front desk today">
      {data ? <div className="grid grid-cols-2 gap-3 text-sm max-w-md">
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.visitorsToday ?? 0)}</p><p className="text-slate-500">Visitors today</p></div>
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.currentlyOnPremises ?? 0)}</p><p className="text-slate-500">Currently on premises</p></div>
      </div> : <p className="text-sm text-slate-500">Loading…</p>}
      <p className="text-sm text-slate-500 mt-3">Receptionist scope: enquiries, admission intake, visitors and complaint routing only — no finance, payroll or confidential academic records.</p>
    </Section>
  </DashboardLayout>);
}
