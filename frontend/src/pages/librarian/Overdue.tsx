
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LIBRARIAN_NAV } from './nav';
import { Banner, Section, fmtDate, fmtMinor, refName, useLoader } from '../opsShared';
import { listIssues, listOverdue } from '../../services/operations';
export default function LibrarianOverdue() {
  const overdue = useLoader(() => listOverdue());
  const returned = useLoader(() => listIssues());
  const fined = (returned.data ?? []).filter((i) => Number(i.fineAmount ?? 0) > 0);
  return (<DashboardLayout role="librarian" title="Overdue & Fines" nav={LIBRARIAN_NAV}><div className="space-y-4">
    <Banner banner={overdue.banner} />
    <Section title="Overdue (still out)">
      {(overdue.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No overdue books.</p> : <ul className="divide-y text-sm">{(overdue.data ?? []).map((i) => <li key={i._id} className="py-2">{refName(i.copy)} · {refName(i.book)} → {refName(i.borrowerStudent)} · was due {fmtDate(i.dueDate)}</li>)}</ul>}
    </Section>
    <Section title="Fines recorded (5.00 per overdue day, integer minor units)">
      {fined.length === 0 ? <p className="text-sm text-slate-500">No fines recorded yet.</p> : <ul className="divide-y text-sm">{fined.map((i) => <li key={i._id} className="py-2 flex justify-between"><span>{refName(i.book)} → {refName(i.borrowerStudent)}</span><span>{fmtMinor(i.fineAmount)} · {String(i.fineStatus)}</span></li>)}</ul>}
    </Section>
  </div></DashboardLayout>);
}
