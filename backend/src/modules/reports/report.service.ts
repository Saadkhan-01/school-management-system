import { AdmissionApplication } from "../admissions/admission.model";
import { AcademicSession, SchoolClass, Section, Subject } from "../academics/academic.models";
import { Enrollment } from "../enrollments/enrollment.model";
import { ParentProfile } from "../parents/parent.model";
import { StaffProfile } from "../staff/staff.model";
import { Student } from "../students/student.model";
import { TeacherProfile } from "../teachers/teacher.model";
import { User } from "../users/user.model";

/**
 * Dashboard statistics (§7 Admin overview, §8 Principal overview).
 * Every number is a live countDocuments() over a real collection — nothing is
 * hardcoded. Attendance and fees belong to Phases 5/7: until those collections
 * exist the fields are returned as null with an explicit note, never invented.
 */
export async function dashboardStats(variant: "admin" | "principal") {
  const [
    totalStudents, activeStudents, totalTeachers, totalStaff, totalParents,
    totalClasses, totalSections, totalSubjects, totalUsers, activeEnrollments,
    pendingAdmissions, underReviewAdmissions, approvedAdmissions, currentSessionDoc,
    usersByRole,
  ] = await Promise.all([
    Student.countDocuments({}),
    Student.countDocuments({ status: "active" }),
    TeacherProfile.countDocuments({}),
    StaffProfile.countDocuments({}),
    ParentProfile.countDocuments({}),
    SchoolClass.countDocuments({}),
    Section.countDocuments({}),
    Subject.countDocuments({}),
    User.countDocuments({}),
    Enrollment.countDocuments({ status: "active" }),
    AdmissionApplication.countDocuments({ status: "Submitted" }),
    AdmissionApplication.countDocuments({ status: "Under Review" }),
    AdmissionApplication.countDocuments({ status: "Approved" }),
    AcademicSession.findOne({ isCurrent: true }).select("name startDate endDate").lean(),
    User.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);
  const roleCounts: Record<string, number> = {};
  for (const r of usersByRole) roleCounts[r._id] = r.count;
  return {
    variant,
    generatedAt: new Date().toISOString(),
    currentSession: currentSessionDoc ? { id: String(currentSessionDoc._id), name: currentSessionDoc.name, startDate: currentSessionDoc.startDate, endDate: currentSessionDoc.endDate } : null,
    totals: {
      students: totalStudents,
      activeStudents,
      teachers: totalTeachers,
      staff: totalStaff,
      parents: totalParents,
      classes: totalClasses,
      sections: totalSections,
      subjects: totalSubjects,
      users: totalUsers,
      activeEnrollments,
    },
    admissions: {
      pending: pendingAdmissions + underReviewAdmissions,
      submitted: pendingAdmissions,
      underReview: underReviewAdmissions,
      approvedAwaitingEnrollment: approvedAdmissions,
    },
    usersByRole: roleCounts,
    // Later phases — honest nulls, never fabricated figures (§40 rule 3).
    attendanceToday: null,
    attendanceNote: "Attendance is Phase 5 — no attendance records exist yet, so no figure is shown.",
    fees: null,
    feesNote: "Fee collection is Phase 7 — no invoices or payments exist yet, so no figure is shown.",
  };
}
