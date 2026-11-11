import { useCallback, useEffect, useState } from 'react';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { downloadReportExport, reportCatalogue, runReport, type ReportDef, type ReportResult } from '../../services/communication';
import type { Role } from '../../types';

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** §27 Reports & Analytics — catalogue-driven: the picker only lists the
 *  reports the caller's role may access (enforced again on the backend). */
export default function ReportsPage({ role, nav, heading = 'Reports & Analytics', embedded = false }: { role: Role; nav: NavItem[]; heading?: string; embedded?: boolean }) {
  const [defs, setDefs] = useState<ReportDef[]>([]);
  const [key, setKey] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', month: '', year: '' });
  const [report, setReport] = useState<ReportResult | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => { try { const d = await reportCatalogue(); setDefs(d); if (d.length) setKey(d[0].key); } catch (e) { setBanner({ kind: 'err', text: `Could not load the report catalogue: ${apiErrorMessage(e)}` }); } })(); }, []);

  const activeFilters = useCallback(() => {
    const f: Record<string, unknown> = {};
    if (filters.from) f.from = filters.from;
    if (filters.to) f.to = filters.to;
    if (filters.month) f.month = filters.month;
    if (filters.year) f.year = filters.year;
    return f;
  }, [filters]);

  const run = async () => {
    if (!key) return;
    setBusy(true);
    try { setReport(await runReport(key, activeFilters())); setBanner(null); }
    catch (e) { setBanner({ kind: 'err', text: `Report failed: ${apiErrorMessage(e)}` }); setReport(null); }
    finally { setBusy(false); }
  };
  const exp = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try { await downloadReportExport(key, format, activeFilters()); }
    catch (e) { setBanner({ kind: 'err', text: `Export failed: ${apiErrorMessage(e)}` }); }
  };

  const content = (<div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-1">{heading}</h2>
        <p className="text-sm text-slate-500 mb-4">Computed live from school records. Money figures are in minor units (e.g. 1050 = 10.50) unless a column says otherwise. Only the reports your role may access are listed.</p>
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2"><label className={labelCls}>Report</label>
            <select className={inputCls} value={key} onChange={(e) => { setKey(e.target.value); setReport(null); }}>
              {defs.map((d) => <option key={d.key} value={d.key}>{d.title}</option>)}
            </select>
            {defs.find((d) => d.key === key) && <p className="text-xs text-slate-500 mt-1">{defs.find((d) => d.key === key)?.description}</p>}
          </div>
          <div><label className={labelCls}>From</label><input type="date" className={inputCls} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
          <div><label className={labelCls}>To</label><input type="date" className={inputCls} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className={labelCls}>Month</label><input type="number" min={1} max={12} className={inputCls} value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></div>
            <div className="flex-1"><label className={labelCls}>Year</label><input type="number" className={inputCls} value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className={btnCls} onClick={() => void run()} disabled={busy || !key}>{busy ? 'Running…' : 'Run report'}</button>
          <button className={ghostBtnCls} onClick={() => void exp('csv')} disabled={!key}>Export CSV</button>
          <button className={ghostBtnCls} onClick={() => void exp('xlsx')} disabled={!key}>Export XLSX</button>
          <button className={ghostBtnCls} onClick={() => void exp('pdf')} disabled={!key}>Export PDF</button>
        </div>
      </div>
      {report && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-2">{report.title}</h3>
          {report.note && <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2 mb-3">{report.note}</p>}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(report.summary).map(([k, v]) => <span key={k} className="text-xs bg-slate-100 rounded px-2 py-1"><strong>{k}:</strong> {cellText(v)}</span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b">{report.columns.map((c) => <th key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>)}</tr></thead>
              <tbody>
                {report.rows.length === 0 && <tr><td className="py-3 text-slate-500" colSpan={report.columns.length}>No rows for these filters.</td></tr>}
                {report.rows.map((r, i) => <tr key={i} className="border-b last:border-0">{report.columns.map((c) => <td key={c.key} className="py-2 pr-3">{cellText(r[c.key])}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>);
  if (embedded) return content;
  return (<DashboardLayout role={role} title={heading} nav={nav}>{content}</DashboardLayout>);
}
