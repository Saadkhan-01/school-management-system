
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARD, type Role } from '../types';
export default function ProtectedRoute({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role && user.role !== 'admin') return <Navigate to={ROLE_DASHBOARD[user.role]} replace />;
  if (user.role === 'admin' && role !== 'admin') return <Outlet />;
  return <Outlet />;
}
