import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import { refName, type Row } from '../../services/academic';
import { getChildSummary, getParentPortal } from '../../services/portal';
import { inputCls, labelCls } from '../teacher/shared';

const CHILD_KEY = 'sms_parent_selected_child';

/**
 * Parent child-switcher state (Phase 6, §11). The children list comes ONLY
 * from GET /portal/parent/me, which returns verified-linked children — an
 * unverified link never appears here. The selection is kept in localStorage
 * so switching child on one page re-scopes every other portal page; each page
 * still re-validates scope server-side on every request.
 */
export function useParentChildren() {
  const [portal, setPortal] = useState<Row | null>(null);
  const [childId, setChildIdState] = useState<string>(() => localStorage.getItem(CHILD_KEY) ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getParentPortal();
        setPortal(data);
        const kids = (data.children as Row[]) ?? [];
        setChildIdState((prev) => {
          if (prev && kids.some((k) => String(k.studentId) === prev)) return prev;
          const first = kids[0] ? String(kids[0].studentId) : '';
          if (first) localStorage.setItem(CHILD_KEY, first);
          return first;
        });
      } catch (e) { setError(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  const setChildId = useCallback((id: string) => {
    localStorage.setItem(CHILD_KEY, id);
    setChildIdState(id);
  }, []);

  const children = portal ? ((portal.children as Row[]) ?? []) : [];
  const child = children.find((c) => String(c.studentId) === childId) ?? null;
  return { portal, children, child, childId, setChildId, loading, error };
}

/** Loads the per-child summary for the selected child; reloads on switch. */
export function useChildSummary(childId: string) {
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!childId) { setSummary(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try { const data = await getChildSummary(childId); if (!cancelled) setSummary(data); }
      catch (e) { if (!cancelled) { setError(apiErrorMessage(e)); setSummary(null); } }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [childId]);
  return { summary, loading, error };
}

export function ChildSwitcher({ children, childId, onChange }: { children: Row[]; childId: string; onChange: (id: string) => void }) {
  if (children.length === 0) return null;
  return (<div className="bg-white rounded-xl shadow-sm p-4">
    <label className={labelCls}>Viewing child</label>
    <select className={inputCls} value={childId} onChange={(e) => onChange(e.target.value)}>
      {children.map((c) => (<option key={String(c.studentId)} value={String(c.studentId)}>
        {String(c.name)} ({String(c.admissionNumber)}){c.enrollment ? ` — ${refName((c.enrollment as Row).schoolClass)} ${refName((c.enrollment as Row).section)}` : ''}
      </option>))}
    </select>
    <p className="text-xs text-slate-500 mt-1">Only children verified and linked to your account by the school are listed. Switching re-scopes every page in this portal.</p>
  </div>);
}

export function NoChildrenNote({ portal }: { portal: Row | null }) {
  const unverified = portal ? (portal.unverifiedLinks as Row | undefined) : undefined;
  return (<div className="bg-white rounded-xl shadow-sm p-5 text-sm text-slate-600 space-y-2">
    <p><strong>No verified children are linked to your account yet.</strong></p>
    <p>The school office creates and verifies parent–child links (usually at admission). Until a link is verified, no child data is visible in this portal — by design.</p>
    {unverified && Number(unverified.count) > 0 ? <p>{String(unverified.note ?? '')}</p> : null}
  </div>);
}
