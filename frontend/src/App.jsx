import { useState, useEffect, Suspense, lazy } from "react";
import {
  LayoutDashboard, Users, BookOpen, Activity, ClipboardList,
  UserCog, Database, ServerCog, Settings, GraduationCap, ShieldAlert, BarChart3, FileText
} from "lucide-react";
import FontImports from "./components/FontImports";
import ConsoleLayout from "./components/ConsoleLayout";
import { WorkspaceDataProvider } from "./context/WorkspaceDataContext";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import SuperAdminSignupPage from "./pages/super/SuperAdminSignupPage";
import ForcePasswordChangeModal from "./components/ForcePasswordChangeModal";
import { COLORS } from "./constants/colors";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DEVELOPER_NAV } from "./utils/developerConsole";

// Lazy load pages for code splitting and faster initial load
const StudentFollowUps = lazy(() => import("./pages/StudentFollowUps"));
const ReviewsRemediation = lazy(() => import("./pages/ReviewsRemediation"));
const TeacherHome = lazy(() => import("./pages/teacher/TeacherHome"));
const ClassRoster = lazy(() => import("./pages/teacher/ClassRoster"));
const LearningWorkspace = lazy(() => import("./pages/LearningWorkspace"));

const UsabilityFeedback = lazy(() => import("./pages/teacher/UsabilityFeedback"));
const TeacherSettings = lazy(() => import("./pages/teacher/TeacherSettings"));
const SectionsManagement = lazy(() => import("./pages/SectionWorkspace"));
const CohortChecklist = lazy(() => import("./pages/CohortChecklist"));
const TeacherActivity = lazy(() => import("./pages/TeacherActivity"));
const PasswordAssistance = lazy(() => import("./pages/PasswordAssistance"));
const StudentReset = lazy(() => import("./pages/StudentReset"));

const SuperAdminHome = lazy(() => import("./pages/super/SuperAdminHome"));
const TeacherManagement = lazy(() => import("./pages/super/TeacherManagement"));
const CurriculumWorkspace = lazy(() => import("./pages/CurriculumWorkspace"));
const SystemLogs = lazy(() => import("./pages/super/SystemLogs"));
const SuperAdminSettings = lazy(() => import("./pages/super/SuperAdminSettings"));
const DeveloperOverview = lazy(() => import("./pages/developer/DeveloperOverview"));
const DeveloperAnswers = lazy(() => import("./pages/developer/DeveloperAnswers"));
const DeveloperAnalytics = lazy(() => import("./pages/developer/DeveloperAnalytics"));
const DeveloperBkt = lazy(() => import("./pages/developer/DeveloperBkt"));
const DeveloperMonitoring = lazy(() => import("./pages/developer/DeveloperMonitoring"));
const DeveloperReports = lazy(() => import("./pages/developer/DeveloperReports"));
const DeveloperAccounts = lazy(() => import("./pages/super/DeveloperAccounts"));

function AppContent() {
  const { authed, role, user, setUser, loadingSession, login, logout } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  useEffect(() => {
    if (!authed || role !== "developer") return;
    if (DEVELOPER_NAV.some(item => item.path === currentPath)) return;
    window.history.replaceState({}, "", "/dashboard");
    setCurrentPath("/dashboard");
    setCurrentSearch("");
  }, [authed, role, currentPath]);

  const handleLogin = (r, loginResponse) => {
    login(loginResponse);
    if (currentPath === "/" || currentPath === "/login") {
      window.history.pushState({}, "", "/dashboard");
      setCurrentPath("/dashboard");
      setCurrentSearch("");
    }
  };

  const handleLogout = () => {
    logout();
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  };

  if (currentPath === '/student-reset') return <Suspense fallback={<p role="status">Loading secure recovery…</p>}><StudentReset /></Suspense>;

  if (loadingSession) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: COLORS.bg, color: COLORS.sub, fontFamily: "Inter, sans-serif" }}>
        Restoring secure session...
      </div>
    );
  }

  if (currentPath === "/create-super-admin") {
    return (
      <SuperAdminSignupPage
        onComplete={() => {
          window.history.pushState({}, "", "/");
          setCurrentPath("/");
        }}
      />
    );
  }

  if (!authed) {
    if (currentPath === "/") return <LandingPage />;
    return <LoginPage onLogin={handleLogin} />;
  }

  // Force password change on first login
  if (user?.status === "Invited") {
    return (
      <ForcePasswordChangeModal 
        user={user} 
        onComplete={(updatedUser) => setUser(updatedUser)} 
      />
    );
  }

  const teacherPages = [
    { label: "Dashboard", path: "/dashboard", group: "Overview", icon: LayoutDashboard, component: TeacherHome },
    { label: 'Password Assistance', path: '/password-assistance', group: 'Teaching & support', icon: ShieldAlert, component: PasswordAssistance },
    { label: "Section Checklist", path: "/enrollment", group: "Teaching & support", icon: GraduationCap, component: CohortChecklist },
    { label: "Student Follow-ups", path: "/follow-ups", group: "Teaching & support", icon: ShieldAlert, component: StudentFollowUps },
    { label: "Reviews & Remediation", path: "/interventions", group: "Teaching & support", icon: ClipboardList, component: ReviewsRemediation },
    { label: "Student Roster", path: "/roster", group: "Teaching & support", icon: Users, component: ClassRoster, description: "Manage student records and keep your learners connected." },
    { label: "Sections", path: "/sections", group: "Teaching & support", icon: GraduationCap, component: SectionsManagement, description: "Organize your classes and learning groups." },
    { label: "Classroom Diagnostics", path: "/analytics", group: "Learning insights", icon: BookOpen, component: LearningWorkspace, description: "Explore strengths, learning gaps, and assessment results." },
    { label: "Learning Reports", path: "/engagement", group: "Learning insights", icon: Activity, component: LearningWorkspace, mode: "reports", description: "Export individual recorded learning evidence." },
    { label: "Student Feedback & Usability", path: "/survey", group: "Teaching & support", icon: ClipboardList, component: UsabilityFeedback, description: "Understand student satisfaction, difficulty fit, and feedback from the mobile app." },
    { label: "My Teaching Content", path: "/content", group: "Teaching & support", icon: Database, component: CurriculumWorkspace },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: TeacherSettings, description: "Manage your profile and sign-in details." },
  ];
  const schoolPages = [
    { label: "Dashboard", path: "/dashboard", group: "Overview", icon: LayoutDashboard, component: SuperAdminHome },
    { label: 'Password Assistance', path: '/password-assistance', group: 'Administration', icon: ShieldAlert, component: PasswordAssistance },
    { label: "Section Checklist", path: "/enrollment", group: "Administration", icon: GraduationCap, component: CohortChecklist },
    { label: "Teacher Activity", path: "/teacher-activity", group: "School insights", icon: UserCog, component: TeacherActivity },
    { label: "School Progress", path: "/school-progress", group: "School insights", icon: BarChart3, component: LearningWorkspace },
    { label: "Student Feedback & Usability", path: "/survey", group: "School insights", icon: ClipboardList, component: UsabilityFeedback, description: "Explore student experience across sections and training modules." },
    { label: "Institutional Reports", path: "/reports", group: "School insights", icon: ClipboardList, component: LearningWorkspace, mode: "reports" },
    { label: "Sections", path: "/sections", group: "Administration", icon: GraduationCap, component: SectionsManagement },
    { label: "Teacher Accounts", path: "/teachers", group: "Administration", icon: UserCog, component: TeacherManagement, description: "Manage teacher access and account invitations." },
    { label: "Developer Accounts", path: "/developers", group: "Administration", icon: UserCog, component: DeveloperAccounts, description: "Invite and deactivate developer access." },
    { label: "Review & Publish", path: "/content", group: "Administration", icon: Database, component: CurriculumWorkspace },
    { label: "Activity Log", path: "/logs", group: "Administration", icon: ServerCog, component: SystemLogs, description: "Keep track of account and content changes across your school." },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: SuperAdminSettings, description: "Manage your profile and school administration settings." },
  ];
  const developerComponents = { '/dashboard': DeveloperOverview, '/answers': DeveloperAnswers, '/analytics': DeveloperAnalytics, '/bkt': DeveloperBkt, '/monitoring': DeveloperMonitoring, '/reports': DeveloperReports, '/settings': TeacherSettings };
  const developerIcons = { '/dashboard': LayoutDashboard, '/answers': ClipboardList, '/analytics': BarChart3, '/bkt': Activity, '/monitoring': ShieldAlert, '/reports': FileText, '/settings': Settings };
  const developerPages = DEVELOPER_NAV.map(item => ({ ...item, icon: developerIcons[item.path], component: developerComponents[item.path], description: 'Read-only learning records and analytics.' }));
  const pages = role === "admin" ? teacherPages : role === "developer" ? developerPages : schoolPages;
  const pageIndex = Math.max(0, pages.findIndex(page => page.path === currentPath));
  const page = pages[pageIndex];
  const Active = page.component;
  const navigate = target => {
    const path = target.split("?")[0];
    if (!pages.some(item => item.path === path)) return;
    window.history.pushState({}, "", target);
    setCurrentPath(path);
    setCurrentSearch(window.location.search);
  };

  return <WorkspaceDataProvider key={`${role}:${user?._id ?? user?.id ?? user?.email ?? "session"}`} role={role}><ConsoleLayout user={user} role={role} pages={pages} pageIndex={pageIndex} currentPath={`${currentPath}${currentSearch}`} onNavigate={navigate} onLogout={handleLogout}>
    <FontImports />
    <Suspense fallback={<div className="dash-empty" role="status">Loading your workspace…</div>}>
      <ErrorBoundary key={currentPath}>
        <Active key={`${currentPath}${currentSearch}`} user={user} setUser={setUser} onNavigate={navigate} followUps={page.followUps} progress={page.progress} mode={page.mode} />
      </ErrorBoundary>
    </Suspense>
  </ConsoleLayout></WorkspaceDataProvider>;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
