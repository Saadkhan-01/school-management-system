import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage, tokenStore } from '../../services/api';
import { getReportCard, refName, reportCardPdfUrl, type Row } from '../../services/academic';
import { changeMyPassword, getMyAccount, getStudentPortal, listPortalAnnouncements, updateMyProfile } from '../../services/portal';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../teacher/shared';

/* Phase 6 portal building blocks shared by the Student and Parent portals.
 * Every value rendered here comes from a real API response — the pending
 * panel below deliberately calls NO endpoint, because certificate issuance
 * (Phase 8) does not exist yet. (Fees graduated in Phase 7 with real pages.) */

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="bg-white rounded-xl shadow-sm p-5">
    <h3 className="font-semibold mb-3">{title}</h3>
    {children}
  </div>);
}

export function LoadingNote({ text = 'Loading…' }: { text?: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

export function enrollmentLine(enrollment: Row | null | undefined): string {
  if (!enrollment) return 'No active enrollment';
  return `${refName(enrollment.schoolClass)} · Section ${refName(enrollment.section)} · ${refName(enrollment.session)}`;
}

/** Weekly timetable grouped by weekday (canonical Mon→Sun order). */
export function TimetableGrid({ entries }: { entries: Row[] }) {
  if (entries.length === 0) return <p className="text-sm text-slate-500">No timetable entries have been published for this class yet.</p>;
  return (<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
    {WEEKDAYS.map((day) => {
      const dayEntries = entries.filter((e) => String(e.weekday) === day).sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));
      if (dayEntries.length === 0) return null;
      return (<div key={day} className="border rounded-xl p-3">
        <p className="font-semibold capitalize text-sm mb-2">{day}</p>
        <ul className="space-y-2 text-sm">
          {dayEntries.map((e) => (<li key={e._id} className="flex justify-between gap-2 border-b last:border-0 pb-1">
            <span>P{String(e.periodNumber)} · <strong>{refName(e.subject)}</strong><br /><span className="text-slate-500 text-xs">{refName(e.teacher)}{e.classroom ? ` · ${refName(e.classroom)}` : ''}</span></span>
            <span className="text-slate-600 whitespace-nowrap">{String(e.startTime)}–{String(e.endTime)}</span>
          </li>))}
        </ul>
      </div>);
    })}
  </div>);
}

/** Published-results list with report-card view + authenticated PDF download (Phase 5 endpoints). */
export function ReportCardPanel({ exams, studentId }: { exams: Row[]; studentId: string }) {
  const [card, setCard] = useState<Row | null>(null);
  const [cardExam, setCardExam] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const openCard = async (examId: string) => {
    setCardExam(examId); setCard(null); setBanner(null);
    try { setCard(await getReportCard(examId, studentId)); }
    catch (e) { setBanner({ kind: 'err', text: `Report card: ${apiErrorMessage(e)}` }); }
  };
  const downloadPdf = async (examId: string) => {
    try {
      const res = await fetch(reportCardPdfUrl(examId, studentId), { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'report-card.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { setBanner({ kind: 'err', text: 'PDF download failed — the server could not generate the report card.' }); }
  };

  const subjects = card ? ((card.subjects as Row[]) ?? []) : [];
  return (<div className="space-y-3">
    <Banner banner={banner} />
    {exams.length === 0
      ? <p className="text-sm text-slate-500">No published results yet. Results appear here only after the school approves and publishes them.</p>
      : (<ul className="divide-y text-sm">{exams.map((e) => (<li key={e._id} className="py-2 flex items-center justify-between gap-3">
        <span><strong>{String(e.name)}</strong> · {String(e.type)} · published{ e.publishedAt ? ` ${new Date(String(e.publishedAt)).toLocaleDateString()}` : ''}</span>
        <span className="flex gap-2"><button className={ghostBtnCls} onClick={() => void openCard(e._id)}>View Report Card</button>
          <button className={ghostBtnCls} onClick={() => void downloadPdf(e._id)}>PDF</button></span></li>))}</ul>)}
    {card && cardExam && (<div className="border rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold">{String((card.exam as Row)?.name ?? '')} — Report Card</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-1 pr-3">Subject</th><th className="py-1 pr-3">Marks</th><th className="py-1">Max</th></tr></thead>
        <tbody>{subjects.map((s, i) => (<tr key={i} className="border-b last:border-0"><td className="py-1 pr-3">{refName(s.subject)}</td><td className="py-1 pr-3">{s.obtainedMarks === null || s.obtainedMarks === undefined ? '—' : String(s.obtainedMarks)}</td><td className="py-1">{String(s.maxMarks)}</td></tr>))}</tbody></table></div>
      <p className="text-sm">Total: <strong>{String(card.totalObtained)} / {String(card.totalMax)}</strong> · Percentage: <strong>{String(card.percentage)}%</strong>{card.grade ? <> · Grade: <strong>{String(card.grade)}</strong></> : ''}{card.position !== null && card.position !== undefined ? <> · Position: <strong>{String(card.position)}</strong></> : ''}</p>
    </div>)}
  </div>);
}

/** Announcements feed from GET /portal/announcements (audience-sliced server-side). */
export function AnnouncementsPanel() {
  const [items, setItems] = useState<Row[]>([]);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try { const out = await listPortalAnnouncements(); setItems(out.announcements); setAudiences(out.audiences); }
      catch (e) { setError(`Could not load announcements: ${apiErrorMessage(e)}`); }
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <LoadingNote text="Loading announcements…" />;
  if (error) return <Banner banner={{ kind: 'err', text: error }} />;
  return (<div className="space-y-3">
    <p className="text-xs text-slate-500">Showing published announcements addressed to: {audiences.join(', ') || '—'}. Announcements targeted at other roles are never shown here — the server filters by your role.</p>
    {items.length === 0
      ? <p className="text-sm text-slate-500">No announcements for you right now.</p>
      : (<ul className="space-y-3">{items.map((a) => (<li key={a._id} className="border rounded-xl p-4">
        <p className="font-medium text-sm">{String(a.title)} {a.isFeatured ? <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 ml-1">Featured</span> : null}</p>
        {a.description ? <p className="text-sm text-slate-600 mt-1">{String(a.description)}</p> : null}
        {a.body ? <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{String(a.body)}</p> : null}
        <p className="text-xs text-slate-400 mt-2">{a.publishAt ? new Date(String(a.publishAt)).toLocaleDateString() : new Date(String(a.createdAt)).toLocaleDateString()} · audience: {String(a.audience)}</p>
      </li>))}</ul>)}
  </div>);
}

/** Honest Phase 8 placeholder — certificate issuance does not exist yet. */
export function CertificatesPendingPanel() {
  return (<div className="space-y-3 text-sm text-slate-600">
    <p><strong>Certificates are not available in the portal yet.</strong> Certificate issuance (character, bonafide, school-leaving, fee-clearance and others, with PDF generation and reference verification) is built in <strong>Phase 8</strong>.</p>
    <p>No certificate records exist to display yet, so nothing is listed here rather than showing placeholder documents. To request a certificate today, please contact the school office.</p>
  </div>);
}

/** Account settings: profile edit (PATCH /auth/me/profile) + change password (POST /auth/change-password). */
export function AccountSettings() {
  const [account, setAccount] = useState<Row | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await getMyAccount();
      setAccount(me); setName(String(me.name ?? '')); setPhone(typeof me.phone === 'string' ? me.phone : '');
    } catch (e) { setBanner({ kind: 'err', text: `Could not load your account: ${apiErrorMessage(e)}` }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveProfile = async () => {
    setBanner(null);
    try {
      const updated = await updateMyProfile({ name: name.trim(), phone: phone.trim() });
      setAccount(updated);
      setBanner({ kind: 'ok', text: 'Profile saved. Your displayed name refreshes across the portal on the next page load.' });
    } catch (e) { setBanner({ kind: 'err', text: `Could not save profile: ${apiErrorMessage(e)}` }); }
  };

  const savePassword = async () => {
    setBanner(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword('');
      setBanner({ kind: 'ok', text: 'Password changed. Other sessions have been signed out — please log in again on your other devices.' });
    } catch (e) { setBanner({ kind: 'err', text: `Could not change password: ${apiErrorMessage(e)}` }); }
  };

  if (loading) return <LoadingNote text="Loading your account…" />;
  return (<div className="space-y-4">
    <Banner banner={banner} />
    <Section title="Your account">
      {account
        ? <dl className="text-sm space-y-1">
          <div><dt className="inline font-medium">Email (login): </dt><dd className="inline">{String(account.email ?? '')}</dd></div>
          <div><dt className="inline font-medium">Role: </dt><dd className="inline capitalize">{String(account.role ?? '')}</dd></div>
          <div><dt className="inline font-medium">Status: </dt><dd className="inline">{account.isActive ? 'Active' : 'Inactive'}</dd></div>
          <p className="text-xs text-slate-500 pt-1">Email and role cannot be changed here — email is your login identity and roles are assigned by the school Admin.</p>
        </dl>
        : <p className="text-sm text-slate-500">Account details could not be loaded.</p>}
    </Section>
    <Section title="Edit profile">
      <div className="space-y-3 max-w-md">
        <div><label className={labelCls}>Full name</label><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0300 1234567" /></div>
        <button className={btnCls} onClick={() => void saveProfile()} disabled={name.trim().length < 2}>Save profile</button>
      </div>
    </Section>
    <Section title="Change password">
      <div className="space-y-3 max-w-md">
        <div><label className={labelCls}>Current password</label><input type="password" className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
        <div><label className={labelCls}>New password (min 8 characters)</label><input type="password" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <button className={btnCls} onClick={() => void savePassword()} disabled={!currentPassword || newPassword.length < 8}>Change password</button>
      </div>
    </Section>
  </div>);
}

export function PortalFooterNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

/** Loads the student aggregate (GET /portal/student/me) once for a page. */
export function useStudentPortal() {
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try { setData(await getStudentPortal()); }
      catch (e) { setError(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, []);
  return { data, loading, error };
}
