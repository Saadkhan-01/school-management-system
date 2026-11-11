
import { Construction } from 'lucide-react';
import type { Role } from '../types';
import { ROLE_LABEL } from '../types';
/** Honest dashboard shell home: NO statistics are shown until the backing APIs exist (Strict Rule 3). */
export default function DashboardHome({ role, phase, next }: { role: Role; phase: string; next: string }) {
  return (<div className="space-y-4">
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold">{ROLE_LABEL[role]} Dashboard</h2>
      <p className="text-slate-600 mt-1">You are signed in with a real, backend-verified session. This portal shell (shared layout, RBAC-protected route) is complete in Phase 1.</p>
    </div>
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
      <Construction className="text-amber-600 shrink-0" />
      <div><p className="font-medium text-amber-900">In progress — {phase}</p>
      <p className="text-sm text-amber-800 mt-1">{next} Dashboard numbers will appear here only when they come from real database records — nothing on this page is hardcoded or fake.</p></div>
    </div>
  </div>);
}
