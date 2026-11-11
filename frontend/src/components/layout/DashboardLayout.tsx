
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, GraduationCap, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL, type Role } from '../../types';
export interface NavItem { to: string; label: string; phase: string }
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { connectNotificationSocket, listNotifications, markAllNotificationsRead, markNotificationRead, unreadCount, type Row } from '../../services/communication';
import { notificationLink } from '../communication/shared';

/** §24 notification bell: unread badge (REST poll + Socket.IO push), dropdown
 *  with recent notifications, mark-read / mark-all-read, deep links. If the
 *  socket is unavailable the polling still keeps the badge current. */
function NotificationBell({ role }: { role: Role }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Row[]>([]);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => { try { setUnread(await unreadCount()); } catch { /* silent */ } }, []);
  const loadItems = useCallback(async () => { try { const out = await listNotifications({ limit: 8 }); setItems(out.notifications); setUnread(out.unread); } catch { /* silent */ } }, []);

  useEffect(() => {
    void refreshCount();
    const t = setInterval(() => { void refreshCount(); }, 30000);
    const disconnect = connectNotificationSocket(() => { void refreshCount(); if (open) void loadItems(); });
    return () => { clearInterval(t); disconnect(); };
  }, [refreshCount, loadItems, open]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, loadItems]);

  const openItem = async (n: Row) => {
    if (!n.isRead) { try { await markNotificationRead(n._id); } catch { /* navigate anyway */ } }
    setOpen(false);
    navigate(notificationLink(role, n));
  };

  return (<div className="relative" ref={boxRef}>
    <button className="relative p-2 rounded hover:bg-slate-100" title="Notifications" onClick={() => setOpen((o) => !o)}>
      <Bell size={18} />
      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 text-[9px] leading-4 text-center bg-red-500 text-white rounded-full">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && (
      <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-20 text-left">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-xs text-brand hover:underline" onClick={async () => { try { await markAllNotificationsRead(); } catch { /* noop */ } await loadItems(); await refreshCount(); }}>Mark all read</button>
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y">
          {items.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No notifications yet.</li>}
          {items.map((n) => (
            <li key={n._id}>
              <button className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${n.isRead ? '' : 'bg-sky-50/60'}`} onClick={() => void openItem(n)}>
                <div className="text-sm font-medium flex items-center gap-2">{String(n.title)}{!n.isRead && <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{String(n.body)}</div>
                <div className="text-[11px] text-slate-400">{n.createdAt ? new Date(String(n.createdAt)).toLocaleString() : ''}</div>
              </button>
            </li>
          ))}
        </ul>
        <button className="w-full text-center text-sm text-brand py-2 border-t hover:bg-slate-50 rounded-b-xl" onClick={() => { setOpen(false); navigate(`/${role}/notifications`); }}>View all notifications</button>
      </div>
    )}
  </div>);
}
export default function DashboardLayout({ role, title, nav, children }: { role: Role; title: string; nav: NavItem[]; children?: ReactNode }) {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  return (<div className="min-h-screen flex">
    <aside className="w-64 shrink-0 bg-navy text-slate-200 hidden md:flex flex-col">
      <div className="p-4 flex items-center gap-2 text-white font-bold border-b border-white/10"><GraduationCap className="text-sky-400" /> School ERP</div>
      <div className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400">{ROLE_LABEL[role]} Portal</div>
      <nav className="px-2 space-y-1 flex-1 overflow-y-auto">
        <NavLink to={`/${role}/dashboard`} className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded text-sm ${isActive ? 'bg-brand text-white' : 'hover:bg-white/10'}`}><LayoutDashboard size={16} /> Dashboard</NavLink>
        {nav.map((n) => n.to && n.to !== '#'
          ? (<NavLink key={n.label} to={n.to} end className={({ isActive }) => `flex items-center justify-between px-3 py-2 rounded text-sm ${isActive ? 'bg-brand text-white' : 'hover:bg-white/10'}`}><span>{n.label}</span><span className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">{n.phase}</span></NavLink>)
          : (<div key={n.label} className="flex items-center justify-between px-3 py-2 rounded text-sm text-slate-400" title={`Planned — ${n.phase}`}><span>{n.label}</span><span className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">{n.phase}</span></div>))}
      </nav>
      <div className="p-3 border-t border-white/10 text-xs text-slate-400">Modules activate phase by phase — see docs/feature-tracker.md. No fake data is shown.</div>
    </aside>
    <div className="flex-1 min-w-0 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <h1 className="font-semibold text-lg">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell role={role} />
          <span className="text-sm text-slate-600 hidden sm:block">{user?.name} · {user ? ROLE_LABEL[user.role] : ''}</span>
          <Link to="/login" className="hidden">.</Link>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-navy text-white"><LogOut size={15} /> Logout</button>
          <Settings className="hidden" size={1} />
        </div>
      </header>
      <main className="p-4 md:p-6">{children ?? <Outlet />}</main>
    </div>
  </div>);
}
