import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, btnCls, ghostBtnCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Row } from '../../services/communication';
import { fmtDateTime, notificationLink } from './shared';
import type { Role } from '../../types';

/** §24 notification centre page — used by every role's /<role>/notifications route. */
export default function NotificationsPage({ role, nav }: { role: Role; nav: NavItem[] }) {
  const [items, setItems] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const out = await listNotifications({ limit: 100, ...(unreadOnly ? { unread: 'true' } : {}) });
      setItems(out.notifications); setUnread(out.unread);
    } catch (e) { setBanner({ kind: 'err', text: `Could not load notifications: ${apiErrorMessage(e)}` }); }
  }, [unreadOnly]);
  useEffect(() => { void load(); }, [load]);

  const open = async (n: Row) => {
    if (!n.isRead) { try { await markNotificationRead(n._id); } catch { /* still navigate */ } }
    navigate(notificationLink(role, n));
  };
  const markAll = async () => {
    try { const n = await markAllNotificationsRead(); setBanner({ kind: 'ok', text: `${n} notification(s) marked as read.` }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); }
  };

  return (<DashboardLayout role={role} title="Notifications" nav={nav}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Notifications {unread > 0 && <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">{unread} unread</span>}</h2>
          <label className="text-sm flex items-center gap-1.5 ml-auto"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only</label>
          <button className={ghostBtnCls} onClick={() => void markAll()}>Mark all read</button>
          <button className={ghostBtnCls} onClick={() => void load()}>Refresh</button>
        </div>
        {items.length === 0 ? <p className="text-sm text-slate-500">No notifications{unreadOnly ? ' unread' : ''} yet. New assignment, result, payment, leave, admission and message activity will appear here.</p> : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n._id} className={`py-3 flex gap-3 ${n.isRead ? '' : 'bg-sky-50/60 -mx-2 px-2 rounded'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium text-sm">{String(n.title)}</span><span className="text-[10px] uppercase tracking-wide bg-slate-100 rounded px-1.5 py-0.5">{String(n.type)}</span>{!n.isRead && <span className="w-2 h-2 rounded-full bg-sky-500" />}</div>
                  <p className="text-sm text-slate-600 mt-0.5">{String(n.body)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(n.createdAt)}</p>
                </div>
                <button className={btnCls} onClick={() => void open(n)}>Open</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </DashboardLayout>);
}
