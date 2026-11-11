
import type { UserRole } from "../modules/users/user.model";
declare global { namespace Express { interface Request { user?: { id: string; role: UserRole; email: string }; requestId?: string; } } }
export {};
