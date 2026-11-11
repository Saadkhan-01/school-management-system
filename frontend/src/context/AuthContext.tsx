
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../services/api';
import type { AuthUser } from '../types';
interface AuthCtx { user: AuthUser | null; loading: boolean; login: (email: string, password: string) => Promise<AuthUser>; logout: () => Promise<void>; }
const Ctx = createContext<AuthCtx | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { if (!tokenStore.get()) { setLoading(false); return; } try { const r = await api.get('/auth/me'); setUser(r.data.data.user as AuthUser); } catch { tokenStore.set(null); } finally { setLoading(false); } })(); }, []);
  const login = useCallback(async (email: string, password: string) => { const r = await api.post('/auth/login', { email, password }); tokenStore.set(r.data.data.accessToken as string); const u = r.data.data.user as AuthUser; setUser(u); return u; }, []);
  const logout = useCallback(async () => { try { await api.post('/auth/logout'); } catch { /* session already gone */ } tokenStore.set(null); setUser(null); }, []);
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
export function useAuth(): AuthCtx { const c = useContext(Ctx); if (!c) throw new Error('useAuth must be used inside AuthProvider'); return c; }
