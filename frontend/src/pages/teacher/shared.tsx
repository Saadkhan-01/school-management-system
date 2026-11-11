import { useEffect, useState } from 'react';
import { getMyAssignments, refName, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

export const inputCls = 'w-full border rounded px-3 py-2 text-sm';
export const labelCls = 'block text-sm font-medium mb-1';
export const btnCls = 'px-3 py-1.5 rounded text-sm font-medium bg-brand text-white hover:opacity-90 disabled:opacity-50';
export const ghostBtnCls = 'px-3 py-1.5 rounded text-sm font-medium bg-slate-100 hover:bg-slate-200';

export function Banner({ banner }: { banner: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!banner) return null;
  return <p className={`rounded p-3 text-sm ${banner.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{banner.text}</p>;
}

export function errText(e: unknown, what: string): string {
  return `${what}: ${apiErrorMessage(e)} If this is a 503, the database is not connected yet (configure MONGODB_URI).`;
}

/** Loads the signed-in teacher's assignments (class/section/subject/session scope) once. */
export function useMyAssignments() {
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [profile, setProfile] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const out = await getMyAssignments();
        setProfile(out.profile); setAssignments(out.assignments);
      } catch (e) { setError(errText(e, 'Could not load your assigned classes')); }
      finally { setLoading(false); }
    })();
  }, []);
  return { assignments, profile, error, loading };
}

export function assignmentLabel(a: Row): string {
  return `${refName(a.schoolClass)} · ${refName(a.section)} · ${refName(a.subject)} (${refName(a.session)})`;
}

/** Distinct class/section/session combos from the teacher's assignments (for attendance, which is subject-independent). */
export function classCombos(assignments: Row[]): Array<{ key: string; classId: string; sectionId: string; sessionId: string; label: string }> {
  const seen = new Map<string, { key: string; classId: string; sectionId: string; sessionId: string; label: string }>();
  for (const a of assignments) {
    const classId = String((a.schoolClass as Row)?._id ?? '');
    const sectionId = String((a.section as Row)?._id ?? '');
    const sessionId = String((a.session as Row)?._id ?? '');
    const key = `${classId}|${sectionId}|${sessionId}`;
    if (!seen.has(key)) seen.set(key, { key, classId, sectionId, sessionId, label: `${refName(a.schoolClass)} · ${refName(a.section)} (${refName(a.session)})` });
  }
  return [...seen.values()];
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
