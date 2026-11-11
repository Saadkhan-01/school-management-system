
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RECEPTIONIST_NAV } from './nav';
import { Banner, Section, fmtDate, useLoader } from '../opsShared';
import { api } from '../../services/api';
import type { Row } from '../../services/academic';
async function getList(path: string, key: string): Promise<Row[]> { const r = await api.get(path, { params: { limit: 100 } }); return (r.data.data[key] as Row[]) ?? []; }
export default function ReceptionistEnquiries() {
  const enquiries = useLoader(() => getList('/website/admin/enquiries', 'enquiries'));
  const admissions = useLoader(() => getList('/admissions', 'admissions'));
  return (<DashboardLayout role="receptionist" title="Enquiries & Admissions" nav={RECEPTIONIST_NAV}><div className="space-y-4">
    <Banner banner={enquiries.banner ?? admissions.banner} />
    <Section title="Enquiries inbox (Phase 2 API)">
      {(enquiries.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No enquiries.</p> : <ul className="divide-y text-sm">{(enquiries.data ?? []).map((e) => <li key={e._id} className="py-2"><strong>{String(e.name ?? '')}</strong> · {String(e.subject ?? e.message ?? '')} · {String(e.status ?? '')}</li>)}</ul>}
    </Section>
    <Section title="Admission applications (read view — decisions are Admin/Principal)">
      {(admissions.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No applications.</p> : <ul className="divide-y text-sm">{(admissions.data ?? []).map((a) => <li key={a._id} className="py-2">{String(a.studentFirstName ?? '')} {String(a.studentLastName ?? '')} · {String(a.status ?? '')} · {fmtDate(a.createdAt)}</li>)}</ul>}
    </Section>
  </div></DashboardLayout>);
}
