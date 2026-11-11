import { api } from './api';

/* Types mirroring the backend Phase 2 CMS API (/api/v1/website, /api/v1/settings, /api/v1/admissions). */
export interface CmsLink { label: string; url: string }
export interface WebsiteContent {
  _id?: string;
  schoolName: string;
  tagline?: string;
  logoUrl?: string;
  hero: { title: string; subtitle: string; imageUrl?: string; primaryCtaLabel?: string; primaryCtaLink?: string; secondaryCtaLabel?: string; secondaryCtaLink?: string };
  aboutText: string;
  aboutImageUrl?: string;
  principal: { name: string; title: string; message: string; photoUrl?: string };
  stats: Array<{ label: string; value: string }>;
  programs: Array<{ title: string; description: string; imageUrl?: string }>;
  facultyHighlights: Array<{ name: string; role: string; subject?: string; photoUrl?: string; bio?: string }>;
  facilities: Array<{ name: string; description: string; icon?: string; imageUrl?: string }>;
  testimonials: Array<{ name: string; role: string; quote: string }>;
  contact: { email: string; phone: string; alternatePhone?: string; address: string; city?: string; mapEmbedUrl?: string; mapLink?: string; officeHours?: string };
  footer: { aboutText?: string; quickLinks: CmsLink[]; socialLinks: CmsLink[] };
  admissionOpen: boolean;
  isPublished: boolean;
  updatedAt?: string;
}
export type ContentItemType = 'news' | 'event' | 'gallery' | 'announcement';
export interface PublicItem {
  _id: string;
  type: ContentItemType;
  title: string;
  description?: string;
  body?: string;
  imageUrl?: string;
  category?: string;
  eventStart?: string;
  eventEnd?: string;
  location?: string;
  audience: string;
  status: 'draft' | 'published' | 'archived';
  publishAt?: string;
  isFeatured: boolean;
  createdAt: string;
}
export interface Enquiry {
  _id: string; name: string; email: string; phone?: string; subject: string; message: string;
  status: 'new' | 'contacted' | 'resolved' | 'closed'; internalNotes?: string; createdAt: string;
}
export type AdmissionStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Enrolled';
export interface AdmissionApplication {
  _id: string; studentName: string; dateOfBirth: string; gender: string;
  guardianName: string; guardianRelation?: string; guardianEmail: string; guardianPhone: string;
  previousSchool?: string; desiredClass: string; address: string; city?: string;
  documents: Array<{ name: string; type?: string; url?: string; note?: string }>;
  status: AdmissionStatus;
  statusHistory: Array<{ status: AdmissionStatus; byRole?: string; note?: string; at: string }>;
  createdAt: string;
}

/**
 * DEMO fallback content — used ONLY when the CMS API is unreachable or nothing has
 * been published yet. Every page that renders this keeps a visible "Demo content"
 * badge, so sample data is never presented as the real school's content.
 */
export const DEMO_CONTENT: WebsiteContent = {
  schoolName: 'Greenfield School',
  tagline: 'Demo homepage — CMS-managed (Phase 2)',
  hero: {
    title: 'A place where students learn, grow and belong.',
    subtitle: 'Welcome to Greenfield School (sample name). This public website and the school ERP behind it are being built phase by phase — admissions, academics, fees, library, transport and more.',
    primaryCtaLabel: 'Apply for Admission', primaryCtaLink: '/online-admission',
    secondaryCtaLabel: 'Explore Academics', secondaryCtaLink: '/academics',
  },
  aboutText: 'Greenfield School is a sample single-school identity used for development. The real school\u2019s history, mission and values will be published here through the Admin Website CMS — no code changes needed. Our ERP keeps one record per student across admissions, academics, attendance, examinations, fees and library, with strict role-based access for staff, students and parents.',
  principal: {
    name: 'Principal (demo)', title: 'Principal',
    message: 'Welcome to our school. (Sample message — replace via CMS.) Education here is built on three habits: show up, work honestly, and look after one another. Our teachers track every learner\u2019s progress, and parents can follow attendance, homework and results through their own portal. \u201cEvery child deserves teaching that is careful, kind and ambitious.\u201d',
  },
  stats: [
    { label: 'Sample stat — Students', value: '—' },
    { label: 'Sample stat — Teachers', value: '—' },
    { label: 'Sample stat — Classes', value: '—' },
  ],
  programs: [
    { title: 'Early Years', description: 'Play-based foundations for Playgroup and Kindergarten (sample program).' },
    { title: 'Primary (Classes 1–5)', description: 'English, Mathematics, Science, Social Studies, Computer Science and Languages (sample).' },
    { title: 'Middle (Classes 6–8)', description: 'Structured assessments and subject specialists (sample program).' },
    { title: 'Secondary (Classes 9–10)', description: 'Board-focused preparation with labs and mentoring (sample program).' },
  ],
  facultyHighlights: [
    { name: 'Sample Teacher A', role: 'Head of Science', subject: 'Science', bio: 'Sample faculty highlight — real profiles are managed in the ERP and published via the CMS.' },
    { name: 'Sample Teacher B', role: 'Mathematics Lead', subject: 'Mathematics', bio: 'Sample faculty highlight. No real staff personal data is published in this demo.' },
  ],
  facilities: [
    { name: 'Library', description: 'Demo facility — reading room and lending managed by the ERP Library module.' },
    { name: 'Science & Computer Labs', description: 'Demo facility listing.' },
    { name: 'Sports Ground', description: 'Demo facility listing.' },
    { name: 'Transport', description: 'Managed bus routes (ERP Transport module, Phase 8). Live GPS is not claimed.' },
  ],
  testimonials: [
    { name: 'Sample Parent', role: 'Parent', quote: 'Sample testimonial — real testimonials are added from Admin → Website Management.' },
  ],
  contact: { email: 'office@example-school.edu', phone: '+1 (555) 010-2030', address: '123 Education Road', city: 'Springfield', officeHours: 'Mon–Fri, 8:00–15:00 (demo)' },
  footer: { aboutText: 'Sample public website content — managed from Admin → Website Management in the ERP.', quickLinks: [], socialLinks: [] },
  admissionOpen: true,
  isPublished: false,
};

export const DEMO_ITEMS: PublicItem[] = [
  { _id: 'demo-news-1', type: 'news', title: '[Demo] Admissions open for the new session', description: 'Sample news item — published items come from Admin → Website Management.', audience: 'public', status: 'published', isFeatured: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'demo-event-1', type: 'event', title: '[Demo] Winter sports week', description: 'Sample event — dates are set in the school calendar.', audience: 'public', status: 'published', isFeatured: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'demo-ann-1', type: 'announcement', title: '[Demo] Parent-teacher meeting', description: 'Sample announcement — real announcements are published via the CMS.', audience: 'public', status: 'published', isFeatured: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'demo-gal-1', type: 'gallery', title: '[Demo] Campus gallery placeholder', description: 'Gallery images are uploaded and published from the CMS once storage (Cloudinary/S3) is configured. No stock photos are presented as real school photos.', audience: 'public', status: 'published', isFeatured: false, createdAt: '2026-01-01T00:00:00.000Z' },
];

/* ---------- Public API ---------- */
export async function fetchPublicContent(): Promise<WebsiteContent | null> {
  const r = await api.get('/website/public');
  return (r.data.data.content as WebsiteContent | null) ?? null;
}
export async function fetchPublicItems(type?: ContentItemType): Promise<PublicItem[]> {
  const r = await api.get('/website/public/items', { params: type ? { type } : undefined });
  return r.data.data.items as PublicItem[];
}

/* ---------- Admin API ---------- */
export async function adminGetContent(): Promise<WebsiteContent | null> {
  const r = await api.get('/website/admin/content');
  return (r.data.data.content as WebsiteContent | null) ?? null;
}
export async function adminSaveContent(payload: Partial<WebsiteContent>): Promise<WebsiteContent> {
  const r = await api.put('/website/admin/content', payload);
  return r.data.data.content as WebsiteContent;
}
export async function adminListItems(params: Record<string, string>): Promise<{ items: PublicItem[]; meta?: unknown }> {
  const r = await api.get('/website/admin/items', { params });
  return { items: r.data.data.items as PublicItem[], meta: r.data.meta };
}
export async function adminCreateItem(payload: Record<string, unknown>): Promise<PublicItem> {
  const r = await api.post('/website/admin/items', payload);
  return r.data.data.item as PublicItem;
}
export async function adminUpdateItem(id: string, payload: Record<string, unknown>): Promise<PublicItem> {
  const r = await api.put(`/website/admin/items/${id}`, payload);
  return r.data.data.item as PublicItem;
}
export async function adminDeleteItem(id: string): Promise<void> {
  await api.delete(`/website/admin/items/${id}`);
}
export async function adminListEnquiries(params: Record<string, string>): Promise<Enquiry[]> {
  const r = await api.get('/website/admin/enquiries', { params });
  return r.data.data.enquiries as Enquiry[];
}
export async function adminUpdateEnquiryStatus(id: string, status: Enquiry['status'], note?: string): Promise<void> {
  await api.patch(`/website/admin/enquiries/${id}/status`, { status, note });
}
export async function adminListApplications(params: Record<string, string>): Promise<AdmissionApplication[]> {
  const r = await api.get('/admissions', { params });
  return r.data.data.applications as AdmissionApplication[];
}
export async function adminUpdateApplicationStatus(id: string, status: AdmissionStatus, note?: string): Promise<AdmissionApplication> {
  const r = await api.patch(`/admissions/${id}/status`, { status, note });
  return r.data.data.application as AdmissionApplication;
}
