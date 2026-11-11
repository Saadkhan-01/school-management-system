
import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1', withCredentials: true });
const KEY = 'sms_access_token';
export const tokenStore = { get: () => localStorage.getItem(KEY), set: (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY)) };
api.interceptors.request.use((c) => { const t = tokenStore.get(); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, async (err) => {
  const orig = err.config as { _retry?: boolean; url?: string; headers: Record<string, string> };
  if (err.response?.status === 401 && !orig._retry && orig.url && !orig.url.includes('/auth/')) {
    orig._retry = true;
    try { const res = await api.post('/auth/refresh'); tokenStore.set(res.data.data.accessToken as string); orig.headers.Authorization = `Bearer ${res.data.data.accessToken}`; return api(orig); }
    catch { tokenStore.set(null); }
  }
  return Promise.reject(err);
});
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) return (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message ?? fallback;
  return fallback;
}
