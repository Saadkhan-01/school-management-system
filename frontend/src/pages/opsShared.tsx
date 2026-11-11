
import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../services/api';
import type { Row } from '../services/academic';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from './teacher/shared';
export { Banner, btnCls, ghostBtnCls, inputCls, labelCls };
export type { Row };
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-semibold mb-3">{title}</h3>{children}</div>);
}
export function useLoader<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const load = useCallback(async () => { try { setData(await fn()); } catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); } }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  return { data, banner, setBanner, reload: load };
}
export function refName(v: unknown): string {
  if (!v || typeof v !== 'object') return '';
  const o = v as Row;
  if (o.firstName || o.lastName) return `${String(o.firstName ?? '')} ${String(o.lastName ?? '')}`.trim();
  return String(o.name ?? o.title ?? o.copyCode ?? '');
}
export const fmtMinor = (v: unknown) => (Number(v ?? 0) / 100).toFixed(2);
export const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : '—');
