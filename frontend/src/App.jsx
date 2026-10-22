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
    { label: "Student Follow-ups", path: "/follow-ups", group: "Students", icon: ShieldAlert, component: StudentFollowUps },
    { label: "Reviews", path: "/interventions", group: "Students", icon: ClipboardList, component: ReviewsRemediation },
    { label: "Student Roster", path: "/roster", group: "Students", icon: Users, component: ClassRoster },
    { label: "Student Feedback", path: "/survey", group: "Students", icon: ClipboardList, component: UsabilityFeedback, description: "Ratings and comments from the mobile app." },
    { label: "Sections", path: "/sections", group: "Classes", icon: GraduationCap, component: SectionsManagement },
    { label: "Enrollment", path: "/enrollment", group: "Classes", icon: GraduationCap, component: CohortChecklist },
    { label: "Teaching Content", path: "/content", group: "Classes", icon: Database, component: CurriculumWorkspace },
    { label: "Password Help", path: "/password-assistance", group: "Classes", icon: ShieldAlert, component: PasswordAssistance },
    { label: "Diagnostics", path: "/analytics", group: "Insights", icon: BookOpen, component: LearningWorkspace },
    { label: "Learning Reports", path: "/engagement", group: "Insights", icon: Activity, component: LearningWorkspace, mode: "reports" },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: TeacherSettings, description: "Profile and sign-in." },
  ];
  const schoolPages = [
    { label: "Dashboard", path: "/dashboard", group: "Overview", icon: LayoutDashboard, component: SuperAdminHome },
    { label: "Teacher Accounts", path: "/teachers", group: "People", icon: UserCog, component: TeacherManagement },
    { label: "Developer Accounts", path: "/developers", group: "People", icon: UserCog, component: DeveloperAccounts },
    { label: "Sections", path: "/sections", group: "People", icon: GraduationCap, component: SectionsManagement },
    { label: "Enrollment", path: "/enrollment", group: "People", icon: GraduationCap, component: CohortChecklist },
    { label: "Password Help", path: "/password-assistance", group: "People", icon: ShieldAlert, component: PasswordAssistance },
    { label: "School Progress", path: "/school-progress", group: "Insights", icon: BarChart3, component: LearningWorkspace },
    { label: "Teacher Activity", path: "/teacher-activity", group: "Insights", icon: UserCog, component: TeacherActivity },
    { label: "Student Feedback", path: "/survey", group: "Insights", icon: ClipboardList, component: UsabilityFeedback, description: "Student experience by section and module." },
    { label: "Institutional Reports", path: "/reports", group: "Insights", icon: ClipboardList, component: LearningWorkspace, mode: "reports" },
    { label: "Review & Publish", path: "/content", group: "Operations", icon: Database, component: CurriculumWorkspace },
    { label: "Activity Log", path: "/logs", group: "Operations", icon: ServerCog, component: SystemLogs },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: SuperAdminSettings, description: "Profile and sign-in." },
  ];
  const developerComponents = { '/dashboard': DeveloperOverview, '/answers': DeveloperAnswers, '/analytics': DeveloperAnalytics, '/bkt': DeveloperBkt, '/monitoring': DeveloperMonitoring, '/reports': DeveloperReports, '/settings': TeacherSettings };
  const developerIcons = { '/dashboard': LayoutDashboard, '/answers': ClipboardList, '/analytics': BarChart3, '/bkt': Activity, '/monitoring': ShieldAlert, '/reports': FileText, '/settings': Settings };
  const developerPages = DEVELOPER_NAV.map(item => ({ ...item, icon: developerIcons[item.path], component: developerComponents[item.path], description: item.path === '/settings' ? 'Profile and sign-in.' : '' }));
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
