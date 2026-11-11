
import type { UserRole } from "../modules/users/user.model";
/** Static baseline map mirroring docs/permissions.md. DB roles/permissions collections (Phase 3) can override per-user grants. */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["*"],
  principal: ["students.read","attendance.read","exams.approve","results.publish","leave.approve","announcements.write","reports.read","complaints.read"],
  teacher: ["attendance.write.own","assignments.write.own","marks.write.own","students.read.assigned","leave.apply"],
  student: ["self.read","assignments.submit.own","results.read.own"],
  parent: ["children.read.linked","fees.pay.linked","leave.apply.child","messages.write"],
  accountant: ["fees.write","invoices.write","payments.verify","expenses.write","payroll.read","reports.finance"],
  librarian: ["library.write","books.read","reports.library"],
  receptionist: ["admissions.intake","visitors.write","students.search.limited","complaints.route"],
};
