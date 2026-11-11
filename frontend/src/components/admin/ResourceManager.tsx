import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiErrorMessage } from '../../services/api';
import type { ListOut } from '../../services/admin';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  /** Hide this field when editing an existing record (e.g. passwords). */
  hideOnEdit?: boolean;
  /** Show this field only when editing (e.g. status on a student). */
  onlyOnEdit?: boolean;
}
export interface ColumnDef<T> { key: string; label: string; render?: (row: T) => ReactNode }
export interface ManagerHelpers { reload: () => void; notify: (kind: 'ok' | 'err', text: string) => void }
export interface FilterDef { name: string; label: string; options: Array<{ value: string; label: string }> }

type FormValues = Record<string, string | boolean>;
type Row = Record<string, unknown> & { _id: string };

const inputCls = 'w-full border rounded px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium mb-1';

/**
 * Shared CRUD surface for the Phase 4 admin modules: server-side
 * search/filter/pagination, create/edit form, honest loading/empty/error
 * states. All data comes from the real APIs — on failure an error banner is
 * shown and the table stays empty (never placeholder rows).
 */
export default function ResourceManager<T extends Row>(props: {
  title: string;
  description?: string;
  load: (params: { page: number; limit: number; search: string; filters: Record<string, string> }) => Promise<ListOut<T>>;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  toForm?: (row: T) => FormValues;
  onCreate?: (values: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: string, values: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  rowActions?: (row: T, helpers: ManagerHelpers) => ReactNode;
  detailPanel?: (row: T, helpers: ManagerHelpers) => ReactNode;
  detailLabel?: string;
  filters?: FilterDef[];
  createLabel?: string;
  mapSubmit?: (values: FormValues, editing: T | null) => Record<string, unknown>;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState<T | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  const [detailRow, setDetailRow] = useState<T | null>(null);

  const notify = useCallback((kind: 'ok' | 'err', text: string) => setBanner({ kind, text }), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const out = await props.load({ page, limit: 20, search, filters: filterValues });
      setItems(out.items); setMeta(out.meta);
    } catch (e) {
      setItems([]);
      setBanner({ kind: 'err', text: `Could not load ${props.title.toLowerCase()}: ${apiErrorMessage(e)} If this is a 503, the database is not connected yet (configure MONGODB_URI).` });
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterValues]);
  useEffect(() => { void load(); }, [load]);
  const helpers: ManagerHelpers = { reload: () => void load(), notify };

  const openCreate = () => {
    setEditing(null); setShowForm(true);
    const init: FormValues = {};
    for (const f of props.fields) if (!f.onlyOnEdit) init[f.name] = f.type === 'checkbox' ? false : '';
    setForm(init);
  };
  const openEdit = (row: T) => {
    setEditing(row); setShowForm(true);
    if (props.toForm) { setForm(props.toForm(row)); return; }
    const init: FormValues = {};
    for (const f of props.fields) {
      if (f.hideOnEdit) continue;
      const v = row[f.name];
      init[f.name] = typeof v === 'boolean' ? v : v == null ? '' : String(v).slice(0, f.type === 'date' ? 10 : undefined);
    }
    setForm(init);
  };
  const submit = async () => {
    setSaving(true); setBanner(null);
    try {
      const values = props.mapSubmit ? props.mapSubmit(form, editing) : { ...form };
      for (const f of props.fields) {
        if (f.type === 'number' && typeof values[f.name] === 'string') values[f.name] = values[f.name] === '' ? undefined : Number(values[f.name]);
        if (values[f.name] === '') values[f.name] = undefined;
      }
      if (editing && props.onUpdate) await props.onUpdate(String(editing._id), values);
      else if (props.onCreate) await props.onCreate(values);
      setBanner({ kind: 'ok', text: `${props.title} ${editing ? 'updated' : 'created'} successfully.` });
      setShowForm(false); setEditing(null);
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Save failed: ${apiErrorMessage(e)}` }); } finally { setSaving(false); }
  };

  const visibleFields = props.fields.filter((f) => (editing ? !f.hideOnEdit : !f.onlyOnEdit));

  return (<div className="space-y-4">
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-52">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          {props.description && <p className="text-sm text-slate-600 mt-1">{props.description}</p>}
        </div>
        {props.onCreate && <button onClick={openCreate} className="bg-brand text-white px-4 py-2 rounded text-sm font-medium">{props.createLabel ?? `New ${props.title.replace(/s$/, '')}`}</button>}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <input className="border rounded px-3 py-2 text-sm flex-1 min-w-48" placeholder="Search…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        {(props.filters ?? []).map((f) => (
          <select key={f.name} className="border rounded px-2 py-2 text-sm" value={filterValues[f.name] ?? ''} onChange={(e) => { setPage(1); setFilterValues((v) => ({ ...v, [f.name]: e.target.value })); }}>
            <option value="">{f.label}: All</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>
      {banner && <p className={`mt-4 rounded p-3 text-sm ${banner.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{banner.text}</p>}
    </div>

    {showForm && (props.onCreate || props.onUpdate) && (<div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h3 className="font-semibold">{editing ? `Edit ${props.title.replace(/s$/, '')}` : (props.createLabel ?? `New ${props.title.replace(/s$/, '')}`)}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {visibleFields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
            <label className={labelCls}>{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'select' ? (
              <select className={inputCls} value={String(form[f.name] ?? '')} onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.value }))}>
                <option value="">— Select —</option>
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea rows={3} className={inputCls} value={String(form[f.name] ?? '')} placeholder={f.placeholder} onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.value }))} />
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" checked={Boolean(form[f.name])} onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.checked }))} />
            ) : (
              <input type={f.type ?? 'text'} className={inputCls} value={String(form[f.name] ?? '')} placeholder={f.placeholder} onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button disabled={saving} onClick={() => void submit()} className="bg-brand text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
        <button onClick={() => { setShowForm(false); setEditing(null); }} className="bg-slate-100 px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>)}

    <div className="bg-white rounded-xl shadow-sm p-6">
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : items.length === 0 ? (
        <p className="text-sm text-slate-500">No records found. (If the database is unavailable, an error is shown above — no placeholder data is displayed.)</p>
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left border-b">{props.columns.map((c) => <th key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>)}<th>Actions</th></tr></thead>
          <tbody>{items.map((row) => (
            <tr key={String(row._id)} className="border-b last:border-0 align-top">
              {props.columns.map((c) => <td key={c.key} className="py-2 pr-3">{c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>)}
              <td className="whitespace-nowrap py-2">
                {props.detailPanel && <button className="text-brand font-medium mr-3" onClick={() => setDetailRow(detailRow?._id === row._id ? null : row)}>{props.detailLabel ?? 'View'}</button>}
                {props.onUpdate && <button className="text-brand font-medium mr-3" onClick={() => openEdit(row)}>Edit</button>}
                {props.onDelete && <button className="text-red-600 font-medium mr-3" onClick={async () => { if (window.confirm('Delete this record? This cannot be undone.')) { try { await props.onDelete!(String(row._id)); notify('ok', 'Record deleted.'); await load(); } catch (e) { notify('err', `Delete failed: ${apiErrorMessage(e)}`); } } }}>Delete</button>}
                {props.rowActions?.(row, helpers)}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="flex items-center gap-3 mt-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded bg-slate-100 disabled:opacity-40">Previous</button>
        <span className="text-slate-600">Page {meta.page} of {Math.max(1, meta.pages)} · {meta.total} record{meta.total === 1 ? '' : 's'}</span>
        <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded bg-slate-100 disabled:opacity-40">Next</button>
      </div>
    </div>

    {detailRow && props.detailPanel && (<div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{props.detailLabel ?? 'Details'}</h3>
        <button className="text-sm text-slate-500" onClick={() => setDetailRow(null)}>Close</button>
      </div>
      {props.detailPanel(detailRow, helpers)}
    </div>)}
  </div>);
}
