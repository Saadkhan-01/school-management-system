
import DashboardLayout from '../../components/layout/DashboardLayout';
import { STUDENT_NAV } from './nav';
import { Banner, Section, fmtDate, ghostBtnCls, useLoader } from '../opsShared';
import { listCertificates } from '../../services/operations';
import { downloadPdf } from '../../services/finance';
import { useState } from 'react';
export default function StudentCertificates() {
  const certs = useLoader(() => listCertificates());
  const [err, setErr] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  return (<DashboardLayout role="student" title="Certificates" nav={STUDENT_NAV}>
    <Banner banner={err ?? certs.banner} />
    <Section title="My certificates">
      {(certs.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No certificates have been issued to you yet.</p> : <ul className="divide-y text-sm">{(certs.data ?? []).map((c) => <li key={c._id} className="py-2 flex justify-between gap-2"><span><strong>{String(c.referenceNumber)}</strong> · {String(c.type)} · issued {fmtDate(c.issueDate)} · {String(c.status)}</span>{c.status === 'issued' && <button className={ghostBtnCls} onClick={() => void downloadPdf(`/certificates/${c._id}/pdf`, `certificate-${String(c.referenceNumber)}.pdf`).catch(() => setErr({ kind: 'err', text: 'PDF download failed.' }))}>Download PDF</button>}</li>)}</ul>}
    </Section>
  </DashboardLayout>);
}
