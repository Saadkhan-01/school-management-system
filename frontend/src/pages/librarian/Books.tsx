
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LIBRARIAN_NAV } from './nav';
import { Banner, Section, btnCls, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { createBook, createCopy, createLibraryCategory, listBooks, listCopies, listLibraryCategories } from '../../services/operations';
export default function LibrarianBooks() {
  const cats = useLoader(() => listLibraryCategories());
  const books = useLoader(() => listBooks());
  const copies = useLoader(() => listCopies());
  const [cat, setCat] = useState(''); const [book, setBook] = useState({ title: '', author: '', isbn: '', categoryId: '', publisher: '', publicationYear: '' });
  const [copy, setCopy] = useState({ bookId: '', copyCode: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ kind: 'ok', text: ok }); books.reload(); copies.reload(); cats.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="librarian" title="Books & Copies" nav={LIBRARIAN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? books.banner} />
    <Section title="Categories">
      <div className="flex gap-2 mb-2"><input className={inputCls} placeholder="New category name" value={cat} onChange={(e) => setCat(e.target.value)} /><button className={btnCls} onClick={() => void run(() => createLibraryCategory({ name: cat }), 'Category created.')}>Add</button></div>
      <p className="text-sm text-slate-600">{(cats.data ?? []).map((c) => String(c.name)).join(' · ') || 'No categories yet.'}</p>
    </Section>
    <Section title="Add book">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Title</label><input className={inputCls} value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /></div>
        <div><label className={labelCls}>Author</label><input className={inputCls} value={book.author} onChange={(e) => setBook({ ...book, author: e.target.value })} /></div>
        <div><label className={labelCls}>ISBN (optional)</label><input className={inputCls} value={book.isbn} onChange={(e) => setBook({ ...book, isbn: e.target.value })} /></div>
        <div><label className={labelCls}>Category</label><select className={inputCls} value={book.categoryId} onChange={(e) => setBook({ ...book, categoryId: e.target.value })}><option value="">Select…</option>{(cats.data ?? []).map((c) => <option key={c._id} value={c._id}>{String(c.name)}</option>)}</select></div>
        <div><label className={labelCls}>Publisher</label><input className={inputCls} value={book.publisher} onChange={(e) => setBook({ ...book, publisher: e.target.value })} /></div>
        <div><label className={labelCls}>Year</label><input className={inputCls} type="number" value={book.publicationYear} onChange={(e) => setBook({ ...book, publicationYear: e.target.value })} /></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void run(() => createBook({ title: book.title, author: book.author, isbn: book.isbn || undefined, categoryId: book.categoryId, publisher: book.publisher || undefined, publicationYear: book.publicationYear ? Number(book.publicationYear) : undefined }), 'Book created.')}>Add book</button>
      <ul className="divide-y text-sm mt-4">{(books.data ?? []).map((b) => <li key={b._id} className="py-2"><strong>{String(b.title)}</strong> — {String(b.author)} <span className="text-slate-500">({refName(b.category)})</span></li>)}</ul>
    </Section>
    <Section title="Copies">
      <div className="flex gap-2 mb-3">
        <select className={inputCls} value={copy.bookId} onChange={(e) => setCopy({ ...copy, bookId: e.target.value })}><option value="">Book…</option>{(books.data ?? []).map((b) => <option key={b._id} value={b._id}>{String(b.title)}</option>)}</select>
        <input className={inputCls} placeholder="Copy code (unique)" value={copy.copyCode} onChange={(e) => setCopy({ ...copy, copyCode: e.target.value })} />
        <button className={btnCls} onClick={() => void run(() => createCopy({ bookId: copy.bookId, copyCode: copy.copyCode }), 'Copy added.')}>Add copy</button>
      </div>
      <ul className="divide-y text-sm">{(copies.data ?? []).map((c) => <li key={c._id} className="py-2 flex justify-between"><span>{String(c.copyCode)} — {refName(c.book)}</span><span className="text-slate-500">{String(c.status)}</span></li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
