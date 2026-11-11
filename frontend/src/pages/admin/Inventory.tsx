
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, Section, btnCls, fmtDate, ghostBtnCls, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { createInvCategory, createItem, createSupplier, createTransaction, listInvCategories, listItems, listLowStock, listSuppliers, listTransactions } from '../../services/operations';
export default function AdminInventory() {
  const cats = useLoader(() => listInvCategories()); const items = useLoader(() => listItems());
  const txs = useLoader(() => listTransactions()); const low = useLoader(() => listLowStock()); const sups = useLoader(() => listSuppliers());
  const [tab, setTab] = useState<'items' | 'transactions' | 'setup'>('items');
  const [cat, setCat] = useState(''); const [sup, setSup] = useState('');
  const [item, setItem] = useState({ name: '', categoryId: '', unit: 'pcs', lowStockThreshold: '5' });
  const [tx, setTx] = useState({ itemId: '', type: 'purchase', quantity: '1', reference: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); cats.reload(); items.reload(); txs.reload(); low.reload(); sups.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="admin" title="Inventory" nav={ADMIN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? items.banner} />
    <div className="flex gap-2">{(['items', 'transactions', 'setup'] as const).map((t) => <button key={t} className={tab === t ? btnCls : ghostBtnCls} onClick={() => setTab(t)}>{t}</button>)}</div>
    {(low.data ?? []).length > 0 && <Section title="Low stock"><ul className="text-sm">{(low.data ?? []).map((i) => <li key={i._id}>{String(i.name)} — {String(i.quantityOnHand)} {String(i.unit)} on hand (threshold {String(i.lowStockThreshold)})</li>)}</ul></Section>}
    {tab === 'items' && <Section title="Items (quantity is derived from transactions — never typed in)">
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
        <div><label className={labelCls}>Category</label><select className={inputCls} value={item.categoryId} onChange={(e) => setItem({ ...item, categoryId: e.target.value })}><option value="">Select…</option>{(cats.data ?? []).map((c) => <option key={c._id} value={c._id}>{String(c.name)}</option>)}</select></div>
        <div><label className={labelCls}>Unit</label><input className={inputCls} value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} /></div>
        <div><label className={labelCls}>Low-stock threshold</label><input className={inputCls} type="number" value={item.lowStockThreshold} onChange={(e) => setItem({ ...item, lowStockThreshold: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createItem({ name: item.name, categoryId: item.categoryId, unit: item.unit, lowStockThreshold: Number(item.lowStockThreshold) }), 'Item created.')}>Add item</button>
      <ul className="divide-y text-sm mt-3">{(items.data ?? []).map((i) => <li key={i._id} className="py-2 flex justify-between"><span>{String(i.name)} ({refName(i.category)})</span><span>{String(i.quantityOnHand)} {String(i.unit)}</span></li>)}</ul>
    </Section>}
    {tab === 'transactions' && <Section title="Stock transactions">
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className={labelCls}>Item</label><select className={inputCls} value={tx.itemId} onChange={(e) => setTx({ ...tx, itemId: e.target.value })}><option value="">Select…</option>{(items.data ?? []).map((i) => <option key={i._id} value={i._id}>{String(i.name)}</option>)}</select></div>
        <div><label className={labelCls}>Type</label><select className={inputCls} value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>{['purchase', 'received', 'issued', 'adjustment', 'return'].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className={labelCls}>Quantity (adjustment may be negative)</label><input className={inputCls} type="number" value={tx.quantity} onChange={(e) => setTx({ ...tx, quantity: e.target.value })} /></div>
        <div><label className={labelCls}>Reference</label><input className={inputCls} value={tx.reference} onChange={(e) => setTx({ ...tx, reference: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void act(() => createTransaction({ itemId: tx.itemId, type: tx.type, quantity: Number(tx.quantity), reference: tx.reference || undefined }), 'Transaction recorded.')}>Record</button>
      <ul className="divide-y text-sm mt-3">{(txs.data ?? []).map((t) => <li key={t._id} className="py-2 flex justify-between"><span>{refName(t.item)} · {String(t.type)} · {fmtDate(t.createdAt)}</span><span>{Number(t.quantity) > 0 ? '+' : ''}{String(t.quantity)} → balance {String(t.balanceAfter)}</span></li>)}</ul>
    </Section>}
    {tab === 'setup' && <Section title="Categories & suppliers">
      <div className="flex gap-2 mb-2"><input className={inputCls} placeholder="Category name" value={cat} onChange={(e) => setCat(e.target.value)} /><button className={btnCls} onClick={() => void act(() => createInvCategory({ name: cat }), 'Category created.')}>Add category</button></div>
      <p className="text-sm text-slate-600 mb-3">{(cats.data ?? []).map((c) => String(c.name)).join(' · ') || 'None'}</p>
      <div className="flex gap-2"><input className={inputCls} placeholder="Supplier name" value={sup} onChange={(e) => setSup(e.target.value)} /><button className={btnCls} onClick={() => void act(() => createSupplier({ name: sup }), 'Supplier created.')}>Add supplier</button></div>
      <p className="text-sm text-slate-600 mt-2">{(sups.data ?? []).map((s) => String(s.name)).join(' · ') || 'None'}</p>
    </Section>}
  </div></DashboardLayout>);
}
