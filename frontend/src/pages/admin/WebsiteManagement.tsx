import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import {
  adminCreateItem, adminDeleteItem, adminGetContent, adminListApplications, adminListEnquiries, adminListItems,
  adminSaveContent, adminUpdateApplicationStatus, adminUpdateEnquiryStatus, adminUpdateItem,
  type AdmissionApplication, type AdmissionStatus, type ContentItemType, type Enquiry, type PublicItem, type WebsiteContent,
} from '../../services/website';

export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', phase: 'P4' },
  { to: '/admin/users', label: 'User Management', phase: 'P4' },
  { to: '/admin/students', label: 'Students', phase: 'P4' },
  { to: '/admin/parents', label: 'Parents', phase: 'P4' },
  { to: '/admin/teachers', label: 'Teachers', phase: 'P4' },
  { to: '/admin/staff', label: 'Staff', phase: 'P4' },
  { to: '/admin/academics', label: 'Academics', phase: 'P4' },
  { to: '/admin/enrollments', label: 'Enrollments', phase: 'P4' },
  { to: '/admin/admissions', label: 'Admissions', phase: 'P4' },
  { to: '/admin/timetable', label: 'Timetable', phase: 'P5' },
  { to: '/admin/exams', label: 'Examinations', phase: 'P5' },
  { to: '/admin/attendance', label: 'Attendance Overview', phase: 'P5' },
  { to: '/admin/finance', label: 'Finance', phase: 'P7' },
  { to: '/admin/transport', label: 'Transport', phase: 'P8' },
  { to: '/admin/inventory', label: 'Inventory', phase: 'P8' },
  { to: '/admin/certificates', label: 'Certificates', phase: 'P8' },
  { to: '/admin/complaints', label: 'Complaints', phase: 'P8' },
  { to: '/admin/discipline', label: 'Discipline', phase: 'P8' },
  { to: '/admin/staff-attendance', label: 'Staff Attendance', phase: 'P8' },
  { to: '/admin/calendar', label: 'Events & Calendar', phase: 'P9' },
  { to: '/admin/appointments', label: 'Appointments', phase: 'P9' },
  { to: '/admin/messages', label: 'Messages', phase: 'P9' },
  { to: '/admin/notifications', label: 'Notifications', phase: 'P9' },
  { to: '/admin/reports', label: 'Reports & Analytics', phase: 'P9' },
  { to: '/admin/activity-logs', label: 'Activity Logs', phase: 'P9' },
  { to: '/admin/website', label: 'Website Management', phase: 'P2' },
];

type Tab = 'content' | 'items' | 'enquiries' | 'admissions';
const inputCls = 'w-full border rounded px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium mb-1';

function parseJsonArray(text: string, label: string): unknown[] {
  const v = JSON.parse(text) as unknown;
  if (!Array.isArray(v)) throw new Error(`${label} must be a JSON array`);
  return v;
}

export default function WebsiteManagement() {
  const [tab, setTab] = useState<Tab>('content');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  /* ---------- Site content state ---------- */
  const [form, setForm] = useState({
    schoolName: '', tagline: '', logoUrl: '', heroTitle: '', heroSubtitle: '', heroImageUrl: '',
    aboutText: '', principalName: '', principalTitle: 'Principal', principalMessage: '', principalPhotoUrl: '',
    contactEmail: '', contactPhone: '', contactAddress: '', contactCity: '', contactMapLink: '', officeHours: '',
    footerAbout: '', admissionOpen: true, isPublished: false,
  });
  const [json, setJson] = useState({ stats: '[]', programs: '[]', facultyHighlights: '[]', facilities: '[]', testimonials: '[]', quickLinks: '[]', socialLinks: '[]' });
  const [contentLoaded, setContentLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      const c = await adminGetContent();
      if (c) {
        setForm({
          schoolName: c.schoolName ?? '', tagline: c.tagline ?? '', logoUrl: c.logoUrl ?? '',
          heroTitle: c.hero?.title ?? '', heroSubtitle: c.hero?.subtitle ?? '', heroImageUrl: c.hero?.imageUrl ?? '',
          aboutText: c.aboutText ?? '', principalName: c.principal?.name ?? '', principalTitle: c.principal?.title ?? 'Principal',
          principalMessage: c.principal?.message ?? '', principalPhotoUrl: c.principal?.photoUrl ?? '',
          contactEmail: c.contact?.email ?? '', contactPhone: c.contact?.phone ?? '', contactAddress: c.contact?.address ?? '',
          contactCity: c.contact?.city ?? '', contactMapLink: c.contact?.mapLink ?? '', officeHours: c.contact?.officeHours ?? '',
          footerAbout: c.footer?.aboutText ?? '', admissionOpen: c.admissionOpen ?? true, isPublished: c.isPublished ?? false,
        });
        setJson({
          stats: JSON.stringify(c.stats ?? [], null, 2), programs: JSON.stringify(c.programs ?? [], null, 2),
          facultyHighlights: JSON.stringify(c.facultyHighlights ?? [], null, 2), facilities: JSON.stringify(c.facilities ?? [], null, 2),
          testimonials: JSON.stringify(c.testimonials ?? [], null, 2), quickLinks: JSON.stringify(c.footer?.quickLinks ?? [], null, 2),
          socialLinks: JSON.stringify(c.footer?.socialLinks ?? [], null, 2),
        });
      }
      setContentLoaded(true);
    } catch (e) {
      setBanner({ kind: 'err', text: `Could not load saved website content: ${apiErrorMessage(e)} If the database is not connected (503), editing is unavailable until MONGODB_URI is configured.` });
    }
  }, []);

  useEffect(() => { void loadContent(); }, [loadContent]);

  const saveContent = async () => {
    setSaving(true); setBanner(null);
    try {
      const payload: Partial<WebsiteContent> = {
        schoolName: form.schoolName, tagline: form.tagline, logoUrl: form.logoUrl || undefined,
        hero: { title: form.heroTitle, subtitle: form.heroSubtitle, imageUrl: form.heroImageUrl || undefined },
        aboutText: form.aboutText,
        principal: { name: form.principalName, title: form.principalTitle, message: form.principalMessage, photoUrl: form.principalPhotoUrl || undefined },
        contact: { email: form.contactEmail, phone: form.contactPhone, address: form.contactAddress, city: form.contactCity || undefined, mapLink: form.contactMapLink || undefined, officeHours: form.officeHours || undefined },
        footer: { aboutText: form.footerAbout, quickLinks: parseJsonArray(json.quickLinks, 'Footer quick links') as WebsiteContent['footer']['quickLinks'], socialLinks: parseJsonArray(json.socialLinks, 'Footer social links') as WebsiteContent['footer']['socialLinks'] },
        stats: parseJsonArray(json.stats, 'Stats') as WebsiteContent['stats'],
        programs: parseJsonArray(json.programs, 'Programs') as WebsiteContent['programs'],
        facultyHighlights: parseJsonArray(json.facultyHighlights, 'Faculty highlights') as WebsiteContent['facultyHighlights'],
        facilities: parseJsonArray(json.facilities, 'Facilities') as WebsiteContent['facilities'],
        testimonials: parseJsonArray(json.testimonials, 'Testimonials') as WebsiteContent['testimonials'],
        admissionOpen: form.admissionOpen, isPublished: form.isPublished,
      };
      await adminSaveContent(payload);
      setBanner({ kind: 'ok', text: form.isPublished ? 'Website content saved and published — the public site now serves it from the API.' : 'Website content saved as unpublished. The public site keeps showing the demo fallback until “Published” is enabled.' });
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof SyntaxError || (e instanceof Error && e.message.includes('JSON')) ? `Invalid JSON in one of the list editors: ${e.message}` : `Save failed: ${apiErrorMessage(e)}` });
    } finally { setSaving(false); }
  };

  /* ---------- Content items state ---------- */
  const [items, setItems] = useState<PublicItem[]>([]);
  const [itemFilter, setItemFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ type: 'news' as ContentItemType, title: '', description: '', body: '', imageUrl: '', category: '', location: '', eventStart: '', status: 'draft' as PublicItem['status'], audience: 'public' });

  const loadItems = useCallback(async () => {
    try {
      const out = await adminListItems(itemFilter ? { type: itemFilter, limit: '100' } : { limit: '100' });
      setItems(out.items);
    } catch (e) { setBanner({ kind: 'err', text: `Could not load content items: ${apiErrorMessage(e)}` }); }
  }, [itemFilter]);
  useEffect(() => { if (tab === 'items') void loadItems(); }, [tab, loadItems]);

  const saveItem = async () => {
    setBanner(null);
    const payload: Record<string, unknown> = {
      type: itemForm.type, title: itemForm.title, description: itemForm.description || undefined, body: itemForm.body || undefined,
      imageUrl: itemForm.imageUrl || undefined, category: itemForm.category || undefined, location: itemForm.location || undefined,
      eventStart: itemForm.eventStart || undefined, status: itemForm.status, audience: itemForm.audience,
    };
    try {
      if (editingId) await adminUpdateItem(editingId, payload); else await adminCreateItem(payload);
      setBanner({ kind: 'ok', text: `Content item ${editingId ? 'updated' : 'created'} (${itemForm.status}). Published items with public audience appear on the website immediately.` });
      setEditingId(null); setItemForm({ type: 'news', title: '', description: '', body: '', imageUrl: '', category: '', location: '', eventStart: '', status: 'draft', audience: 'public' });
      await loadItems();
    } catch (e) { setBanner({ kind: 'err', text: `Item save failed: ${apiErrorMessage(e)}` }); }
  };

  /* ---------- Enquiries state ---------- */
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const loadEnquiries = useCallback(async () => {
    try { setEnquiries(await adminListEnquiries({ limit: '100' })); }
    catch (e) { setBanner({ kind: 'err', text: `Could not load enquiries: ${apiErrorMessage(e)}` }); }
  }, []);
  useEffect(() => { if (tab === 'enquiries') void loadEnquiries(); }, [tab, loadEnquiries]);

  /* ---------- Admissions state ---------- */
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const loadApplications = useCallback(async () => {
    try { setApplications(await adminListApplications({ limit: '100' })); }
    catch (e) { setBanner({ kind: 'err', text: `Could not load admission applications: ${apiErrorMessage(e)}` }); }
  }, []);
  useEffect(() => { if (tab === 'admissions') void loadApplications(); }, [tab, loadApplications]);

  const actOnApplication = async (id: string, status: AdmissionStatus) => {
    setBanner(null);
    try {
      await adminUpdateApplicationStatus(id, status);
      setBanner({ kind: 'ok', text: `Application moved to “${status}”. Approved applications are converted to enrollments from the Admissions page (Phase 4).` });
      await loadApplications();
    } catch (e) { setBanner({ kind: 'err', text: `Status change failed: ${apiErrorMessage(e)}` }); }
  };

  const setF = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const setJ = (k: keyof typeof json, v: string) => setJson((j) => ({ ...j, [k]: v }));

  return (<DashboardLayout role="admin" title="Website Management" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold">Website Management (CMS)</h2>
        <p className="text-sm text-slate-600 mt-1">Edit the public website without touching code. Public pages only show content whose status is <strong>Published</strong>; until then they display clearly-marked demo fallback content. Image fields take URLs — direct file upload arrives when Cloudinary/S3 storage is configured (§34), it is not faked here.</p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {([['content', 'Site Content'], ['items', 'News / Events / Gallery / Announcements'], ['enquiries', 'Enquiries'], ['admissions', 'Admission Applications']] as Array<[Tab, string]>).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>
        {banner && <p className={`mt-4 rounded p-3 text-sm ${banner.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{banner.text}</p>}
      </div>

      {tab === 'content' && (<div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {!contentLoaded && <p className="text-sm text-slate-500">Loading saved content… (if this fails, the database is not connected — see banner above.)</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className={labelCls}>School name</label><input className={inputCls} value={form.schoolName} onChange={(e) => setF('schoolName', e.target.value)} /></div>
          <div><label className={labelCls}>Tagline</label><input className={inputCls} value={form.tagline} onChange={(e) => setF('tagline', e.target.value)} /></div>
          <div><label className={labelCls}>Logo URL (optional)</label><input className={inputCls} value={form.logoUrl} onChange={(e) => setF('logoUrl', e.target.value)} placeholder="https://…" /></div>
          <div><label className={labelCls}>Hero image URL (optional)</label><input className={inputCls} value={form.heroImageUrl} onChange={(e) => setF('heroImageUrl', e.target.value)} placeholder="https://…" /></div>
          <div><label className={labelCls}>Hero title</label><input className={inputCls} value={form.heroTitle} onChange={(e) => setF('heroTitle', e.target.value)} /></div>
          <div><label className={labelCls}>Hero subtitle</label><input className={inputCls} value={form.heroSubtitle} onChange={(e) => setF('heroSubtitle', e.target.value)} /></div>
        </div>
        <div><label className={labelCls}>About text</label><textarea rows={4} className={inputCls} value={form.aboutText} onChange={(e) => setF('aboutText', e.target.value)} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className={labelCls}>Principal name</label><input className={inputCls} value={form.principalName} onChange={(e) => setF('principalName', e.target.value)} /></div>
          <div><label className={labelCls}>Principal title</label><input className={inputCls} value={form.principalTitle} onChange={(e) => setF('principalTitle', e.target.value)} /></div>
        </div>
        <div><label className={labelCls}>Principal's message</label><textarea rows={4} className={inputCls} value={form.principalMessage} onChange={(e) => setF('principalMessage', e.target.value)} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className={labelCls}>Contact email</label><input className={inputCls} value={form.contactEmail} onChange={(e) => setF('contactEmail', e.target.value)} /></div>
          <div><label className={labelCls}>Contact phone</label><input className={inputCls} value={form.contactPhone} onChange={(e) => setF('contactPhone', e.target.value)} /></div>
          <div><label className={labelCls}>Address</label><input className={inputCls} value={form.contactAddress} onChange={(e) => setF('contactAddress', e.target.value)} /></div>
          <div><label className={labelCls}>City</label><input className={inputCls} value={form.contactCity} onChange={(e) => setF('contactCity', e.target.value)} /></div>
          <div><label className={labelCls}>Map link (optional)</label><input className={inputCls} value={form.contactMapLink} onChange={(e) => setF('contactMapLink', e.target.value)} placeholder="https://maps…" /></div>
          <div><label className={labelCls}>Office hours</label><input className={inputCls} value={form.officeHours} onChange={(e) => setF('officeHours', e.target.value)} /></div>
        </div>
        <div><label className={labelCls}>Footer about text</label><input className={inputCls} value={form.footerAbout} onChange={(e) => setF('footerAbout', e.target.value)} /></div>
        {([['stats', 'Stats — JSON array of {"label","value"}'], ['programs', 'Academic programs — JSON array of {"title","description"}'], ['facultyHighlights', 'Faculty highlights — JSON array of {"name","role","subject","bio"}'], ['facilities', 'Facilities — JSON array of {"name","description"}'], ['testimonials', 'Testimonials — JSON array of {"name","role","quote"}'], ['quickLinks', 'Footer quick links — JSON array of {"label","url"}'], ['socialLinks', 'Footer social links — JSON array of {"label","url"}']] as Array<[keyof typeof json, string]>).map(([k, label]) => (
          <div key={k}><label className={labelCls}>{label}</label><textarea rows={3} className={`${inputCls} font-mono text-xs`} value={json[k]} onChange={(e) => setJ(k, e.target.value)} spellCheck={false} /></div>
        ))}
        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.admissionOpen} onChange={(e) => setF('admissionOpen', e.target.checked)} /> Admissions open</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(e) => setF('isPublished', e.target.checked)} /> Published (visible on the public website)</label>
        </div>
        <button disabled={saving} onClick={() => void saveContent()} className="bg-brand text-white px-5 py-2.5 rounded font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Website Content'}</button>
      </div>)}

      {tab === 'items' && (<div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
          <h3 className="font-semibold">{editingId ? 'Edit item' : 'New item'}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className={labelCls}>Type</label><select className={inputCls} value={itemForm.type} onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value as ContentItemType }))}><option value="news">News</option><option value="event">Event</option><option value="gallery">Gallery</option><option value="announcement">Announcement</option></select></div>
            <div><label className={labelCls}>Status</label><select className={inputCls} value={itemForm.status} onChange={(e) => setItemForm((f) => ({ ...f, status: e.target.value as PublicItem['status'] }))}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
            <div><label className={labelCls}>Audience</label><select className={inputCls} value={itemForm.audience} onChange={(e) => setItemForm((f) => ({ ...f, audience: e.target.value }))}><option value="public">Public (website)</option><option value="all">All (incl. website)</option><option value="students">Students only (portal)</option><option value="parents">Parents only (portal)</option><option value="teachers">Teachers only (portal)</option><option value="staff">Staff only (portal)</option></select></div>
          </div>
          <div><label className={labelCls}>Title</label><input className={inputCls} value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div><label className={labelCls}>Short description</label><input className={inputCls} value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div><label className={labelCls}>Body (optional)</label><textarea rows={3} className={inputCls} value={itemForm.body} onChange={(e) => setItemForm((f) => ({ ...f, body: e.target.value }))} /></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className={labelCls}>Image URL (optional)</label><input className={inputCls} value={itemForm.imageUrl} onChange={(e) => setItemForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" /></div>
            <div><label className={labelCls}>Category (optional)</label><input className={inputCls} value={itemForm.category} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} /></div>
            <div><label className={labelCls}>Event start (optional)</label><input type="datetime-local" className={inputCls} value={itemForm.eventStart} onChange={(e) => setItemForm((f) => ({ ...f, eventStart: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void saveItem()} className="bg-brand text-white px-4 py-2 rounded text-sm font-medium">{editingId ? 'Update item' : 'Create item'}</button>
            {editingId && <button onClick={() => setEditingId(null)} className="bg-slate-100 px-4 py-2 rounded text-sm">Cancel edit</button>}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3"><h3 className="font-semibold">All items</h3>
            <select className="border rounded px-2 py-1 text-sm" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}><option value="">All types</option><option value="news">News</option><option value="event">Events</option><option value="gallery">Gallery</option><option value="announcement">Announcements</option></select>
          </div>
          {items.length === 0 ? <p className="text-sm text-slate-500">No items yet (or the database is unavailable — see banner).</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Title</th><th className="pr-2">Type</th><th className="pr-2">Status</th><th className="pr-2">Audience</th><th>Actions</th></tr></thead>
            <tbody>{items.map((i) => (<tr key={i._id} className="border-b last:border-0"><td className="py-2 pr-2 font-medium">{i.title}</td><td className="pr-2 capitalize">{i.type}</td><td className="pr-2 capitalize">{i.status}</td><td className="pr-2">{i.audience}</td>
              <td className="whitespace-nowrap"><button className="text-brand font-medium mr-3" onClick={() => { setEditingId(i._id); setItemForm({ type: i.type, title: i.title, description: i.description ?? '', body: i.body ?? '', imageUrl: i.imageUrl ?? '', category: i.category ?? '', location: i.location ?? '', eventStart: i.eventStart ? i.eventStart.slice(0, 16) : '', status: i.status, audience: i.audience }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
              <button className="text-red-600 font-medium" onClick={async () => { if (window.confirm(`Delete “${i.title}”?`)) { try { await adminDeleteItem(i._id); await loadItems(); } catch (e) { setBanner({ kind: 'err', text: `Delete failed: ${apiErrorMessage(e)}` }); } } }}>Delete</button></td></tr>))}</tbody></table></div>
          )}
        </div>
      </div>)}

      {tab === 'enquiries' && (<div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-3">Contact-form enquiries</h3>
        {enquiries.length === 0 ? <p className="text-sm text-slate-500">No enquiries yet (or the database is unavailable — see banner).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">From</th><th className="pr-2">Subject</th><th className="pr-2">Message</th><th className="pr-2">Received</th><th>Status</th></tr></thead>
          <tbody>{enquiries.map((e2) => (<tr key={e2._id} className="border-b last:border-0 align-top"><td className="py-2 pr-2"><span className="font-medium">{e2.name}</span><br /><span className="text-slate-500">{e2.email}</span></td><td className="pr-2">{e2.subject}</td><td className="pr-2 max-w-xs"><span className="line-clamp-3">{e2.message}</span></td><td className="pr-2 whitespace-nowrap">{new Date(e2.createdAt).toLocaleDateString()}</td>
            <td><select className="border rounded px-2 py-1 text-sm" value={e2.status} onChange={async (ev) => { try { await adminUpdateEnquiryStatus(e2._id, ev.target.value as Enquiry['status']); await loadEnquiries(); } catch (err) { setBanner({ kind: 'err', text: `Enquiry update failed: ${apiErrorMessage(err)}` }); } }}><option value="new">New</option><option value="contacted">Contacted</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></td></tr>))}</tbody></table></div>
        )}
      </div>)}

      {tab === 'admissions' && (<div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-1">Online admission applications</h3>
        <p className="text-sm text-slate-500 mb-3">Workflow: Submitted → Under Review → Approved / Rejected → Enrolled. Enrollment conversion (admission number, verified parent link, class/session assignment) is done from the dedicated <strong>Admissions</strong> page in the sidebar. Fee-structure application follows in Phase 7.</p>
        {applications.length === 0 ? <p className="text-sm text-slate-500">No applications yet (or the database is unavailable — see banner).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Student</th><th className="pr-2">Guardian</th><th className="pr-2">Class</th><th className="pr-2">Submitted</th><th className="pr-2">Status</th><th>Actions</th></tr></thead>
          <tbody>{applications.map((a) => (<tr key={a._id} className="border-b last:border-0 align-top"><td className="py-2 pr-2 font-medium">{a.studentName}</td><td className="pr-2">{a.guardianName}<br /><span className="text-slate-500">{a.guardianEmail}</span></td><td className="pr-2">{a.desiredClass}</td><td className="pr-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</td><td className="pr-2"><span className="bg-slate-100 rounded px-2 py-0.5 text-xs font-medium">{a.status}</span><br /><span className="text-xs text-slate-400">{a.statusHistory.length} history entr{a.statusHistory.length === 1 ? 'y' : 'ies'}</span></td>
            <td className="whitespace-nowrap">
              {a.status === 'Submitted' && <button className="text-brand font-medium" onClick={() => void actOnApplication(a._id, 'Under Review')}>Mark Under Review</button>}
              {a.status === 'Under Review' && (<><button className="text-green-700 font-medium mr-3" onClick={() => void actOnApplication(a._id, 'Approved')}>Approve</button><button className="text-red-600 font-medium" onClick={() => void actOnApplication(a._id, 'Rejected')}>Reject</button></>)}
              {a.status === 'Approved' && <span className="text-slate-500 text-xs">Approved — enroll from the Admissions page</span>}
              {a.status === 'Rejected' && <span className="text-slate-400 text-xs">Decided</span>}
              {a.status === 'Enrolled' && <span className="text-green-700 text-xs font-medium">Enrolled</span>}
            </td></tr>))}</tbody></table></div>
        )}
      </div>)}
    </div>
  </DashboardLayout>);
}
