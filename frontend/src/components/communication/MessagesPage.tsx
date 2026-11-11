import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  createConversation, listContacts, listConversations, listMessages, markConversationRead, sendMessage, type Row,
} from '../../services/communication';
import { fmtDateTime } from './shared';
import type { Role } from '../../types';

function personName(v: unknown): string {
  const p = v as Row | undefined;
  return p ? String(p.name ?? p.email ?? 'User') : 'User';
}

/** §24 messaging — shared by Parent / Teacher / Admin / Receptionist /
 *  Accountant / Librarian. Pair rules are enforced by the backend; the
 *  contacts list only offers people the caller is allowed to message. */
export default function MessagesPage({ role, nav }: { role: Role; nav: NavItem[] }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Row[]>([]);
  const [contacts, setContacts] = useState<Row[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Row[]>([]);
  const [draft, setDraft] = useState('');
  const [newContact, setNewContact] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try { setConversations(await listConversations()); }
    catch (e) { setBanner({ kind: 'err', text: `Could not load conversations: ${apiErrorMessage(e)}` }); }
  }, []);
  const loadContacts = useCallback(async () => { try { setContacts(await listContacts()); } catch { setContacts([]); } }, []);
  useEffect(() => { void loadConversations(); void loadContacts(); }, [loadConversations, loadContacts]);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    try {
      setMessages(await listMessages(id));
      await markConversationRead(id);
      await loadConversations();
    } catch (e) { setBanner({ kind: 'err', text: `Could not open conversation: ${apiErrorMessage(e)}` }); }
  }, [loadConversations]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages]);

  const startNew = async () => {
    if (!newContact) return;
    const contact = contacts.find((c) => String(c.userId) === newContact);
    try {
      const conv = await createConversation(newContact, contact?.viaStudent ? String((contact.viaStudent as Row)._id) : undefined);
      setNewContact('');
      await loadConversations();
      await openConversation(String(conv._id));
    } catch (e) { setBanner({ kind: 'err', text: `Could not start conversation: ${apiErrorMessage(e)}` }); }
  };

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    try { await sendMessage(activeId, draft.trim()); setDraft(''); setMessages(await listMessages(activeId)); await loadConversations(); }
    catch (e) { setBanner({ kind: 'err', text: `Send failed: ${apiErrorMessage(e)}` }); }
  };

  const otherParty = (c: Row): string => {
    const parts = (c.participants as Row[] | undefined) ?? [];
    const other = parts.find((p) => String(p._id) !== String(user?.id));
    return other ? personName(other) : parts.map(personName).join(', ');
  };

  return (<DashboardLayout role={role} title="Messages" nav={nav}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="min-w-64">
            <label className={labelCls}>Start a new conversation</label>
            <select className={inputCls} value={newContact} onChange={(e) => setNewContact(e.target.value)}>
              <option value="">Select a contact…</option>
              {contacts.map((c) => <option key={String(c.userId)} value={String(c.userId)}>{String(c.name)} ({String(c.role)}){c.viaStudent ? ` — via ${(c.viaStudent as Row).firstName} ${(c.viaStudent as Row).lastName}` : ''}</option>)}
            </select>
          </div>
          <button className={btnCls} onClick={() => void startNew()} disabled={!newContact}>Start</button>
          <p className="text-xs text-slate-500">Only allowed contacts are listed: parents can message their children's teachers and the school office; staff can message other staff.</p>
        </div>
        <div className="grid md:grid-cols-[280px_1fr] gap-4">
          <ul className="divide-y border rounded-lg overflow-hidden">
            {conversations.length === 0 && <li className="p-3 text-sm text-slate-500">No conversations yet.</li>}
            {conversations.map((c) => (
              <li key={c._id}>
                <button className={`w-full text-left p-3 hover:bg-slate-50 ${activeId === c._id ? 'bg-sky-50' : ''}`} onClick={() => void openConversation(c._id)}>
                  <div className="flex items-center gap-2"><span className="font-medium text-sm">{otherParty(c)}</span>{Number(c.unreadCount ?? 0) > 0 && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{Number(c.unreadCount)}</span>}</div>
                  <div className="text-xs text-slate-500 truncate">{String(c.lastMessagePreview ?? '')}</div>
                  <div className="text-[11px] text-slate-400">{c.lastMessageAt ? fmtDateTime(c.lastMessageAt) : ''}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="border rounded-lg flex flex-col min-h-96">
            {activeId ? (<>
              <div ref={threadRef} className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px]">
                {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet — say hello.</p>}
                {messages.map((m) => {
                  const mine = String((m.sender as Row)?._id ?? m.sender) === String(user?.id);
                  return (<div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-brand text-white' : 'bg-slate-100'}`}>
                      <div>{String(m.body)}</div>
                      <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>{personName(m.sender)} · {fmtDateTime(m.createdAt)}</div>
                    </div>
                  </div>);
                })}
              </div>
              <div className="border-t p-3 flex gap-2">
                <input className={inputCls} placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
                <button className={btnCls} onClick={() => void send()} disabled={!draft.trim()}>Send</button>
                <button className={ghostBtnCls} onClick={() => activeId && void openConversation(activeId)}>Refresh</button>
              </div>
            </>) : <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6">Select a conversation or start a new one.</div>}
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>);
}
