
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../../services/api';
const schema = z.object({ email: z.string().email(), token: z.string().optional(), newPassword: z.string().optional() });
type F = z.infer<typeof schema>;
export default function ForgotPassword() {
  const [msg, setMsg] = useState(''); const [devToken, setDevToken] = useState(''); const [done, setDone] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) });
  const request = async (d: F) => { try { const r = await api.post('/auth/forgot-password', { email: d.email }); setMsg('If this email exists, a reset has been issued. In production it is emailed; email delivery activates when SMTP is configured.'); if (r.data.data.devResetToken) setDevToken(r.data.data.devResetToken as string); } catch (e) { setMsg(apiErrorMessage(e)); } };
  const reset = async (d: F) => { if (!d.token || !d.newPassword || d.newPassword.length < 8) { setMsg('Paste the reset token and choose a password of at least 8 characters.'); return; } try { await api.post('/auth/reset-password', { token: d.token, newPassword: d.newPassword }); setDone('Password reset. You can now log in.'); } catch (e) { setMsg(apiErrorMessage(e)); } };
  return (<div className="max-w-md mx-auto px-4 py-14"><div className="bg-white rounded-xl shadow p-7">
    <h1 className="text-2xl font-bold">Forgot Password</h1>
    <form onSubmit={handleSubmit(request)} className="mt-5 space-y-3"><label className="block text-sm font-medium">Email</label><input type="email" className="w-full border rounded px-3 py-2" {...register('email')} /><button disabled={isSubmitting} className="w-full bg-navy text-white py-2.5 rounded font-medium">Request Reset</button></form>
    {msg && <p className="text-sm mt-4 bg-slate-50 border rounded p-3">{msg}</p>}
    {devToken && <p className="text-xs mt-2 break-all bg-amber-50 border border-amber-200 rounded p-3">Development only — reset token: {devToken}</p>}
    <form onSubmit={handleSubmit(reset)} className="mt-6 space-y-3 border-t pt-5"><label className="block text-sm font-medium">Reset token</label><input className="w-full border rounded px-3 py-2" {...register('token')} /><label className="block text-sm font-medium">New password</label><input type="password" className="w-full border rounded px-3 py-2" {...register('newPassword')} /><button className="w-full bg-brand text-white py-2.5 rounded font-medium">Set New Password</button></form>
    {done && <p className="text-success text-sm mt-3 font-medium">{done}</p>}
    <p className="text-sm mt-4"><Link className="text-brand" to="/login">Back to login</Link></p>
  </div></div>);
}
