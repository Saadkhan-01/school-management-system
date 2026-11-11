
import { api } from './api';
import type { Row } from './academic';
export type { Row };
/* Phase 8 Operations API client — /library, /transport, /inventory, /visitors, /complaints, /certificates, /staff-attendance. Money (fines, maintenance costs) is integer MINOR units. */
async function list(path: string, key: string, params: Record<string, string | number> = {}): Promise<Row[]> { const r = await api.get(path, { params: { limit: 100, ...params } }); return (r.data.data[key] as Row[]) ?? []; }
async function one<T>(p: Promise<{ data: { data: Record<string, T> } }>, key: string): Promise<T> { const r = await p; return r.data.data[key]; }
/* Library */
export const listLibraryCategories = () => list('/library/categories', 'categories');
export const createLibraryCategory = (b: Record<string, unknown>) => one(api.post('/library/categories', b), 'category');
export const listBooks = (params = {}) => list('/library/books', 'books', params);
export const createBook = (b: Record<string, unknown>) => one(api.post('/library/books', b), 'book');
export const listCopies = (params = {}) => list('/library/copies', 'copies', params);
export const createCopy = (b: Record<string, unknown>) => one(api.post('/library/copies', b), 'copy');
export const listCatalogue = (params = {}) => list('/library/catalogue', 'catalogue', params);
export const listIssues = (params = {}) => list('/library/issues', 'issues', params);
export const listOverdue = () => list('/library/overdue', 'issues');
export const issueBook = (b: Record<string, unknown>) => one(api.post('/library/issues', b), 'issue');
export const returnBook = (id: string, b: Record<string, unknown> = {}) => one(api.post(`/library/issues/${id}/return`, b), 'issue');
export async function librarySummary(): Promise<Row> { const r = await api.get('/library/reports/summary'); return r.data.data as Row; }
/* Transport */
export const listBuses = () => list('/transport/buses', 'buses');
export const createBus = (b: Record<string, unknown>) => one(api.post('/transport/buses', b), 'bus');
export const listRoutes = () => list('/transport/routes', 'routes');
export const createRoute = (b: Record<string, unknown>) => one(api.post('/transport/routes', b), 'route');
export const listAllocations = (params = {}) => list('/transport/allocations', 'allocations', params);
export const createAllocation = (b: Record<string, unknown>) => one(api.post('/transport/allocations', b), 'allocation');
export const cancelAllocation = (id: string) => one(api.post(`/transport/allocations/${id}/cancel`, {}), 'allocation');
export const listMaintenance = () => list('/transport/maintenance', 'records');
export const createMaintenance = (b: Record<string, unknown>) => one(api.post('/transport/maintenance', b), 'record');
export const listExpiring = (days = 30) => list('/transport/expiring', 'expiring', { days });
/* Inventory */
export const listInvCategories = () => list('/inventory/categories', 'categories');
export const createInvCategory = (b: Record<string, unknown>) => one(api.post('/inventory/categories', b), 'category');
export const listSuppliers = () => list('/inventory/suppliers', 'suppliers');
export const createSupplier = (b: Record<string, unknown>) => one(api.post('/inventory/suppliers', b), 'supplier');
export const listItems = (params = {}) => list('/inventory/items', 'items', params);
export const createItem = (b: Record<string, unknown>) => one(api.post('/inventory/items', b), 'item');
export const listTransactions = (params = {}) => list('/inventory/transactions', 'transactions', params);
export const createTransaction = (b: Record<string, unknown>) => one(api.post('/inventory/transactions', b), 'transaction');
export const listLowStock = () => list('/inventory/low-stock', 'items');
/* Visitors */
export const listVisitors = (params = {}) => list('/visitors', 'visitors', params);
export const checkInVisitor = (b: Record<string, unknown>) => one(api.post('/visitors', b), 'visitor');
export const checkOutVisitor = (id: string) => one(api.post(`/visitors/${id}/checkout`, {}), 'visitor');
export async function visitorDashboard(): Promise<Row> { const r = await api.get('/visitors/dashboard'); return r.data.data as Row; }
/* Complaints + Discipline */
export const listComplaints = (params = {}) => list('/complaints', 'complaints', params);
export const createComplaint = (b: Record<string, unknown>) => one(api.post('/complaints', b), 'complaint');
export const respondComplaint = (id: string, message: string) => one(api.post(`/complaints/${id}/responses`, { message }), 'complaint');
export const transitionComplaint = (id: string, b: Record<string, unknown>) => one(api.patch(`/complaints/${id}/status`, b), 'complaint');
export const listDiscipline = (params = {}) => list('/complaints/discipline', 'records', params);
export const createDiscipline = (b: Record<string, unknown>) => one(api.post('/complaints/discipline', b), 'record');
/* Certificates */
export const listCertificates = (params = {}) => list('/certificates', 'certificates', params);
export const issueCertificate = (b: Record<string, unknown>) => one(api.post('/certificates', b), 'certificate');
export const revokeCertificate = (id: string, reason: string) => one(api.post(`/certificates/${id}/revoke`, { reason }), 'certificate');
export const certificatePdfPath = (id: string) => `/certificates/${id}/pdf`;
/* Staff attendance */
export const listStaffAttendance = (params = {}) => list('/staff-attendance', 'records', params);
export const markStaffAttendance = (b: Record<string, unknown>) => one(api.post('/staff-attendance', b), 'record');
