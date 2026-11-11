
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import PublicLayout from './components/layout/PublicLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/public/Home';
import About from './pages/public/About';
import PrincipalMessage from './pages/public/PrincipalMessage';
import Academics from './pages/public/Academics';
import ClassesPage from './pages/public/ClassesPage';
import Faculty from './pages/public/Faculty';
import AdmissionsInfo from './pages/public/AdmissionsInfo';
import OnlineAdmission from './pages/public/OnlineAdmission';
import Facilities from './pages/public/Facilities';
import NewsEvents from './pages/public/NewsEvents';
import Gallery from './pages/public/Gallery';
import Contact from './pages/public/Contact';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import AdminDashboard from './pages/admin/Dashboard';
import AdminWebsiteManagement from './pages/admin/WebsiteManagement';
import AdminUsers from './pages/admin/Users';
import AdminStudents from './pages/admin/Students';
import AdminParents from './pages/admin/Parents';
import AdminTeachers from './pages/admin/Teachers';
import AdminStaff from './pages/admin/Staff';
import AdminAcademics from './pages/admin/Academics';
import AdminEnrollments from './pages/admin/Enrollments';
import AdminAdmissions from './pages/admin/Admissions';
import PrincipalDashboard from './pages/principal/Dashboard';
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherMyClasses from './pages/teacher/MyClasses';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherAssignments from './pages/teacher/Assignments';
import TeacherMarks from './pages/teacher/Marks';
import TeacherMaterials from './pages/teacher/Materials';
import TeacherLeave from './pages/teacher/Leave';
import AdminTimetable from './pages/admin/Timetable';
import AdminExams from './pages/admin/Exams';
import AdminAttendanceOverview from './pages/admin/AttendanceOverview';
import StudentDashboard from './pages/student/Dashboard';
import StudentTimetable from './pages/student/Timetable';
import StudentAttendance from './pages/student/Attendance';
import StudentAssignments from './pages/student/Assignments';
import StudentMaterials from './pages/student/Materials';
import StudentResults from './pages/student/Results';
import StudentFees from './pages/student/Fees';
import StudentCertificates from './pages/student/Certificates';
import StudentAnnouncements from './pages/student/Announcements';
import StudentSettings from './pages/student/Settings';
import ParentDashboard from './pages/parent/Dashboard';
import ParentAttendance from './pages/parent/Attendance';
import ParentResults from './pages/parent/Results';
import ParentAssignments from './pages/parent/Assignments';
import ParentTimetable from './pages/parent/Timetable';
import ParentLeave from './pages/parent/Leave';
import ParentFees from './pages/parent/Fees';
import ParentAnnouncements from './pages/parent/Announcements';
import ParentSettings from './pages/parent/Settings';
import AccountantDashboard from './pages/accountant/Dashboard';
import AccountantFees from './pages/accountant/Fees';
import AccountantInvoices from './pages/accountant/Invoices';
import AccountantPayments from './pages/accountant/Payments';
import AccountantExpenses from './pages/accountant/Expenses';
import AccountantPayroll from './pages/accountant/Payroll';
import AccountantReports from './pages/accountant/Reports';
import AdminFinance from './pages/admin/Finance';
import LibrarianDashboard from './pages/librarian/Dashboard';
import LibrarianBooks from './pages/librarian/Books';
import LibrarianCirculation from './pages/librarian/Circulation';
import LibrarianOverdue from './pages/librarian/Overdue';
import LibrarianReports from './pages/librarian/Reports';
import StudentLibrary from './pages/student/Library';
import StudentComplaints from './pages/student/Complaints';
import ParentComplaints from './pages/parent/Complaints';
import ParentTransport from './pages/parent/Transport';
import AdminTransport from './pages/admin/Transport';
import AdminInventory from './pages/admin/Inventory';
import AdminCertificates from './pages/admin/Certificates';
import AdminComplaints from './pages/admin/ComplaintsPage';
import AdminDiscipline from './pages/admin/DisciplinePage';
import AdminStaffAttendance from './pages/admin/StaffAttendance';
import ReceptionistDashboard from './pages/receptionist/Dashboard';
import ReceptionistVisitors from './pages/receptionist/Visitors';
import ReceptionistEnquiries from './pages/receptionist/Enquiries';
import ReceptionistComplaints from './pages/receptionist/Complaints';
import AdminNotifications from './pages/admin/Notifications';
import AdminMessages from './pages/admin/Messages';
import AdminCalendar from './pages/admin/Calendar';
import AdminReports from './pages/admin/Reports';
import AdminActivityLogs from './pages/admin/ActivityLogs';
import AdminAppointments from './pages/admin/Appointments';
import PrincipalNotifications from './pages/principal/Notifications';
import PrincipalMessages from './pages/principal/Messages';
import PrincipalCalendar from './pages/principal/Calendar';
import PrincipalReports from './pages/principal/Reports';
import TeacherNotifications from './pages/teacher/Notifications';
import TeacherMessages from './pages/teacher/Messages';
import TeacherCalendar from './pages/teacher/Calendar';
import TeacherAppointments from './pages/teacher/Appointments';
import StudentNotifications from './pages/student/Notifications';
import StudentCalendar from './pages/student/Calendar';
import ParentNotifications from './pages/parent/Notifications';
import ParentMessages from './pages/parent/Messages';
import ParentCalendar from './pages/parent/Calendar';
import AccountantNotifications from './pages/accountant/Notifications';
import AccountantMessages from './pages/accountant/Messages';
import AccountantCalendar from './pages/accountant/Calendar';
import LibrarianNotifications from './pages/librarian/Notifications';
import LibrarianMessages from './pages/librarian/Messages';
import LibrarianCalendar from './pages/librarian/Calendar';
import ReceptionistNotifications from './pages/receptionist/Notifications';
import ReceptionistMessages from './pages/receptionist/Messages';
import ReceptionistCalendar from './pages/receptionist/Calendar';
import ReceptionistAppointments from './pages/receptionist/Appointments';
const qc = new QueryClient();
export default function App() {
  return (<QueryClientProvider client={qc}><AuthProvider><BrowserRouter><Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<Home />} /><Route path="/about" element={<About />} /><Route path="/principal-message" element={<PrincipalMessage />} />
      <Route path="/academics" element={<Academics />} /><Route path="/classes" element={<ClassesPage />} /><Route path="/faculty" element={<Faculty />} />
      <Route path="/admissions" element={<AdmissionsInfo />} /><Route path="/online-admission" element={<OnlineAdmission />} /><Route path="/facilities" element={<Facilities />} />
      <Route path="/news-events" element={<NewsEvents />} /><Route path="/gallery" element={<Gallery />} /><Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<Login />} /><Route path="/forgot-password" element={<ForgotPassword />} />
    </Route>
    <Route element={<ProtectedRoute role="admin" />}><Route path="/admin/dashboard" element={<AdminDashboard />} /><Route path="/admin/website" element={<AdminWebsiteManagement />} /><Route path="/admin/users" element={<AdminUsers />} /><Route path="/admin/students" element={<AdminStudents />} /><Route path="/admin/parents" element={<AdminParents />} /><Route path="/admin/teachers" element={<AdminTeachers />} /><Route path="/admin/staff" element={<AdminStaff />} /><Route path="/admin/academics" element={<AdminAcademics />} /><Route path="/admin/enrollments" element={<AdminEnrollments />} /><Route path="/admin/admissions" element={<AdminAdmissions />} /><Route path="/admin/timetable" element={<AdminTimetable />} /><Route path="/admin/exams" element={<AdminExams />} /><Route path="/admin/attendance" element={<AdminAttendanceOverview />} /><Route path="/admin/finance" element={<AdminFinance />} /><Route path="/admin/transport" element={<AdminTransport />} /><Route path="/admin/inventory" element={<AdminInventory />} /><Route path="/admin/certificates" element={<AdminCertificates />} /><Route path="/admin/complaints" element={<AdminComplaints />} /><Route path="/admin/discipline" element={<AdminDiscipline />} /><Route path="/admin/staff-attendance" element={<AdminStaffAttendance />} /><Route path="/admin/calendar" element={<AdminCalendar />} /><Route path="/admin/appointments" element={<AdminAppointments />} /><Route path="/admin/messages" element={<AdminMessages />} /><Route path="/admin/notifications" element={<AdminNotifications />} /><Route path="/admin/reports" element={<AdminReports />} /><Route path="/admin/activity-logs" element={<AdminActivityLogs />} /></Route>
    <Route element={<ProtectedRoute role="principal" />}><Route path="/principal/dashboard" element={<PrincipalDashboard />} /><Route path="/principal/reports" element={<PrincipalReports />} /><Route path="/principal/calendar" element={<PrincipalCalendar />} /><Route path="/principal/messages" element={<PrincipalMessages />} /><Route path="/principal/notifications" element={<PrincipalNotifications />} /></Route>
    <Route element={<ProtectedRoute role="teacher" />}><Route path="/teacher/dashboard" element={<TeacherDashboard />} /><Route path="/teacher/classes" element={<TeacherMyClasses />} /><Route path="/teacher/attendance" element={<TeacherAttendance />} /><Route path="/teacher/assignments" element={<TeacherAssignments />} /><Route path="/teacher/marks" element={<TeacherMarks />} /><Route path="/teacher/materials" element={<TeacherMaterials />} /><Route path="/teacher/leave" element={<TeacherLeave />} /><Route path="/teacher/messages" element={<TeacherMessages />} /><Route path="/teacher/calendar" element={<TeacherCalendar />} /><Route path="/teacher/appointments" element={<TeacherAppointments />} /><Route path="/teacher/notifications" element={<TeacherNotifications />} /></Route>
    <Route element={<ProtectedRoute role="student" />}><Route path="/student/dashboard" element={<StudentDashboard />} /><Route path="/student/timetable" element={<StudentTimetable />} /><Route path="/student/attendance" element={<StudentAttendance />} /><Route path="/student/assignments" element={<StudentAssignments />} /><Route path="/student/materials" element={<StudentMaterials />} /><Route path="/student/results" element={<StudentResults />} /><Route path="/student/fees" element={<StudentFees />} /><Route path="/student/certificates" element={<StudentCertificates />} /><Route path="/student/library" element={<StudentLibrary />} /><Route path="/student/complaints" element={<StudentComplaints />} /><Route path="/student/announcements" element={<StudentAnnouncements />} /><Route path="/student/settings" element={<StudentSettings />} /><Route path="/student/calendar" element={<StudentCalendar />} /><Route path="/student/notifications" element={<StudentNotifications />} /></Route>
    <Route element={<ProtectedRoute role="parent" />}><Route path="/parent/dashboard" element={<ParentDashboard />} /><Route path="/parent/attendance" element={<ParentAttendance />} /><Route path="/parent/results" element={<ParentResults />} /><Route path="/parent/assignments" element={<ParentAssignments />} /><Route path="/parent/timetable" element={<ParentTimetable />} /><Route path="/parent/leave" element={<ParentLeave />} /><Route path="/parent/fees" element={<ParentFees />} /><Route path="/parent/announcements" element={<ParentAnnouncements />} /><Route path="/parent/complaints" element={<ParentComplaints />} /><Route path="/parent/transport" element={<ParentTransport />} /><Route path="/parent/settings" element={<ParentSettings />} /><Route path="/parent/messages" element={<ParentMessages />} /><Route path="/parent/calendar" element={<ParentCalendar />} /><Route path="/parent/notifications" element={<ParentNotifications />} /></Route>
    <Route element={<ProtectedRoute role="accountant" />}><Route path="/accountant/dashboard" element={<AccountantDashboard />} /><Route path="/accountant/fees" element={<AccountantFees />} /><Route path="/accountant/invoices" element={<AccountantInvoices />} /><Route path="/accountant/payments" element={<AccountantPayments />} /><Route path="/accountant/expenses" element={<AccountantExpenses />} /><Route path="/accountant/payroll" element={<AccountantPayroll />} /><Route path="/accountant/reports" element={<AccountantReports />} /><Route path="/accountant/messages" element={<AccountantMessages />} /><Route path="/accountant/calendar" element={<AccountantCalendar />} /><Route path="/accountant/notifications" element={<AccountantNotifications />} /></Route>
    <Route element={<ProtectedRoute role="librarian" />}><Route path="/librarian/dashboard" element={<LibrarianDashboard />} /><Route path="/librarian/books" element={<LibrarianBooks />} /><Route path="/librarian/circulation" element={<LibrarianCirculation />} /><Route path="/librarian/overdue" element={<LibrarianOverdue />} /><Route path="/librarian/reports" element={<LibrarianReports />} /><Route path="/librarian/messages" element={<LibrarianMessages />} /><Route path="/librarian/calendar" element={<LibrarianCalendar />} /><Route path="/librarian/notifications" element={<LibrarianNotifications />} /></Route>
    <Route element={<ProtectedRoute role="receptionist" />}><Route path="/receptionist/dashboard" element={<ReceptionistDashboard />} /><Route path="/receptionist/visitors" element={<ReceptionistVisitors />} /><Route path="/receptionist/enquiries" element={<ReceptionistEnquiries />} /><Route path="/receptionist/complaints" element={<ReceptionistComplaints />} /><Route path="/receptionist/appointments" element={<ReceptionistAppointments />} /><Route path="/receptionist/messages" element={<ReceptionistMessages />} /><Route path="/receptionist/calendar" element={<ReceptionistCalendar />} /><Route path="/receptionist/notifications" element={<ReceptionistNotifications />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AuthProvider></QueryClientProvider>);
}
