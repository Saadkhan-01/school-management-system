
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env";
import { dbState } from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import websiteRoutes from "./modules/website/website.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import admissionRoutes from "./modules/admissions/admission.routes";
import userRoutes from "./modules/users/user.routes";
import studentRoutes from "./modules/students/student.routes";
import parentRoutes from "./modules/parents/parent.routes";
import teacherRoutes from "./modules/teachers/teacher.routes";
import staffRoutes from "./modules/staff/staff.routes";
import academicRoutes from "./modules/academics/academic.routes";
import enrollmentRoutes from "./modules/enrollments/enrollment.routes";
import reportRoutes from "./modules/reports/report.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";
import examRoutes from "./modules/examinations/exam.routes";
import marksRoutes from "./modules/examinations/marks.routes";
import resultsRoutes from "./modules/examinations/results.routes";
import assignmentRoutes, { studyMaterialRouter } from "./modules/assignments/assignment.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import portalRoutes from "./modules/portal/portal.routes";
import feeRoutes from "./modules/fees/fee.routes";
import invoiceRoutes from "./modules/fees/invoice.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import financeRoutes from "./modules/finance/finance.routes";
import expenseRoutes from "./modules/finance/expense.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import libraryRoutes from "./modules/library/library.routes";
import transportRoutes from "./modules/transport/transport.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import visitorRoutes from "./modules/visitors/visitor.routes";
import complaintRoutes from "./modules/complaints/complaint.routes";
import certificateRoutes from "./modules/certificates/certificate.routes";
import staffAttendanceRoutes from "./modules/hr/staffAttendance.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import messageRoutes from "./modules/messages/message.routes";
import eventRoutes, { appointmentRouter } from "./modules/events/event.routes";
import { stubRouter } from "./modules/stub.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
const app = express();
app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.get("/api/v1/health", (_req, res) => res.json({ success: true, data: { status: "ok", service: "school-erp-backend", db: dbState, mongoReadyState: mongoose.connection.readyState, timestamp: new Date().toISOString(), note: dbState === "connected" ? undefined : "DB not connected — configure MONGODB_URI (Atlas). Health does not require DB by design." } }));
app.use("/api/v1/auth", authRoutes);
/* Phase 2 — real modules (mounted before the stub catch-alls). */
app.use("/api/v1/website", websiteRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/admissions", admissionRoutes);
/* Phase 4 — real modules: people, academics, enrollments, dashboard reports. */
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/parents", parentRoutes);
app.use("/api/v1/teachers", teacherRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/academics", academicRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/reports", reportRoutes);
/* Phase 5 — real modules: attendance, timetable, examinations/marks/results, assignments, study materials, leave. */
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/timetable", timetableRoutes);
app.use("/api/v1/exams", examRoutes);
app.use("/api/v1/marks", marksRoutes);
app.use("/api/v1/results", resultsRoutes);
app.use("/api/v1/assignments", assignmentRoutes);
app.use("/api/v1/study-materials", studyMaterialRouter);
app.use("/api/v1/leave", leaveRoutes);
/* Phase 6 — student/parent portal aggregates + role-sliced announcements. */
app.use("/api/v1/portal", portalRoutes);
/* Phase 7 — finance: fee structures/invoices, payments/receipts, expenses/income/summary, payroll. */
app.use("/api/v1/fees", feeRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/payroll", payrollRoutes);
/* Phase 8 — operations: library, transport, inventory, visitors, complaints/discipline, certificates, staff attendance. */
app.use("/api/v1/library", libraryRoutes);
app.use("/api/v1/transport", transportRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/visitors", visitorRoutes);
app.use("/api/v1/complaints", complaintRoutes);
app.use("/api/v1/certificates", certificateRoutes);
app.use("/api/v1/staff-attendance", staffAttendanceRoutes);
/* Phase 9 — communication & reporting: notifications, messaging, internal calendar, appointments.
   (Reports + activity logs extend the Phase 4 /reports router mounted above.) */
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/appointments", appointmentRouter);
const stubs: Array<[string, string]> = [
  ["roles","Roles"],["permissions","Permissions"],
];
for (const [path, label] of stubs) app.use(`/api/v1/${path}`, stubRouter(label));
app.use(notFoundHandler);
app.use(errorHandler);
export default app;
