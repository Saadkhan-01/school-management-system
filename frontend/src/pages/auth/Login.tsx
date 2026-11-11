
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DASHBOARD } from '../../types';
import { apiErrorMessage } from '../../services/api';
const schema = z.object({ email: z.string().email('Valid email required'), password: z.string().min(1, 'Password required') });
type F = z.infer<typeof schema>;
export default function Login() {
  const { login } = useAuth(); const navigate = useNavigate(); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) });
  const onSubmit = async (d: F) => { setErr(''); try { const u = await login(d.email, d.password); navigate(ROLE_DASHBOARD[u.role], { replace: true }); } catch (e) { setErr(apiErrorMessage(e, 'Login failed. If the backend database is not configured yet, accounts cannot be verified — see README (Atlas setup).')); } };
  return (<div className="max-w-md mx-auto px-4 py-14"><div className="bg-white rounded-xl shadow p-7">
    <h1 className="text-2xl font-bold">Login</h1><p className="text-sm text-slate-500 mt-1">Staff, students and parents sign in here. Accounts are created by the school — there is no public sign-up.</p>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
      <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" className="w-full border rounded px-3 py-2" {...register('email')} />{errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}</div>
      <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" className="w-full border rounded px-3 py-2" {...register('password')} />{errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}</div>
      {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{err}</p>}
      <button disabled={isSubmitting} className="w-full bg-brand text-white py-2.5 rounded font-medium disabled:opacity-50">{isSubmitting ? 'Signing in…' : 'Sign In'}</button>
    </form>
    <p className="text-sm mt-4"><Link className="text-brand" to="/forgot-password">Forgot password?</Link></p>
  </div></div>);
}
