
export const ROLES = ['admin','principal','teacher','student','parent','accountant','librarian','receptionist'] as const;
export type Role = (typeof ROLES)[number];
export interface AuthUser { id: string; name: string; email: string; role: Role; isActive: boolean; }
export const ROLE_DASHBOARD: Record<Role, string> = { admin: '/admin/dashboard', principal: '/principal/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', librarian: '/librarian/dashboard', receptionist: '/receptionist/dashboard' };
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', principal: 'Principal', teacher: 'Teacher', student: 'Student', parent: 'Parent', accountant: 'Accountant', librarian: 'Librarian', receptionist: 'Receptionist' };
