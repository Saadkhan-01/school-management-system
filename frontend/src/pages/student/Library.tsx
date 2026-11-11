
import DashboardLayout from '../../components/layout/DashboardLayout';
import { STUDENT_NAV } from './nav';
import { Banner, Section, fmtDate, fmtMinor, inputCls, refName, useLoader } from '../opsShared';
import { useState } from 'react';
import { listCatalogue, listIssues } from '../../services/operations';
export default function StudentLibrary() {
  const [search, setSearch] = useState('');
  const catalogue = useLoader(() => listCatalogue(search ? { search } : {}), [search]);
  const mine = useLoader(() => listIssues());
  return (<DashboardLayout role="student" title="Library" nav={STUDENT_NAV}><div className="space-y-4">
    <Banner banner={catalogue.banner ?? mine.banner} />
    <Section title="Catalogue (availability only)">
      <input className={inputCls} placeholder="Search title, author or ISBN…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="divide-y text-sm mt-2">{(catalogue.data ?? []).map((row) => { const b = row.book as Record<string, unknown>; return <li key={String(b._id)} className="py-2 flex justify-between"><span><strong>{String(b.title)}</strong> — {String(b.author)}</span><span>{String(row.availableCopies)} of {String(row.totalCopies)} available</span></li>; })}</ul>
    </Section>
    <Section title="My borrowed books">
      {(mine.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No borrowing history.</p> : <ul className="divide-y text-sm">{(mine.data ?? []).map((i) => <li key={i._id} className="py-2 flex justify-between"><span>{refName(i.book)} · due {fmtDate(i.dueDate)}</span><span>{i.returnDate ? `Returned · fine ${fmtMinor(i.fineAmount)}` : 'On loan'}</span></li>)}</ul>}
    </Section>
  </div></DashboardLayout>);
}
