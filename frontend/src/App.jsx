import { useState, useEffect, Suspense, lazy } from "react";
import {
  LayoutDashboard, Users, BookOpen, Activity, ClipboardList,
  UserCog, Database, ServerCog, Settings, GraduationCap, ShieldAlert, BarChart3
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

// Lazy load pages for code splitting and faster initial load
const TeacherHome = lazy(() => import("./pages/teacher/TeacherHome"));
const ClassRoster = lazy(() => import("./pages/teacher/ClassRoster"));
const SkillAnalytics = lazy(() => import("./pages/teacher/SkillAnalytics"));
const EngagementReports = lazy(() => import("./pages/teacher/EngagementReports"));
const UsabilityFeedback = lazy(() => import("./pages/teacher/UsabilityFeedback"));
const TeacherSettings = lazy(() => import("./pages/teacher/TeacherSettings"));
const SectionsManagement = lazy(() => import("./pages/teacher/SectionsManagement"));

const SuperAdminHome = lazy(() => import("./pages/super/SuperAdminHome"));
const TeacherManagement = lazy(() => import("./pages/super/TeacherManagement"));
const ContentBankManagement = lazy(() => import("./pages/super/ContentBankManagement"));
const SystemLogs = lazy(() => import("./pages/super/SystemLogs"));
const SuperAdminSettings = lazy(() => import("./pages/super/SuperAdminSettings"));

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
    { label: "Student Follow-ups", path: "/follow-ups", group: "Teaching & support", icon: ShieldAlert, component: TeacherHome, followUps: true },
    { label: "Student Roster", path: "/roster", group: "Teaching & support", icon: Users, component: ClassRoster, description: "Manage student records and keep your learners connected." },
    { label: "Sections", path: "/sections", group: "Teaching & support", icon: GraduationCap, component: SectionsManagement, description: "Organize your classes and learning groups." },
    { label: "Skill Insights", path: "/analytics", group: "Learning insights", icon: BookOpen, component: SkillAnalytics, description: "Explore strengths, learning gaps, and assessment results." },
    { label: "Engagement", path: "/engagement", group: "Learning insights", icon: Activity, component: EngagementReports, description: "Understand participation and recent learning activity." },
    { label: "Share Feedback", path: "/survey", group: "Workspace", icon: ClipboardList, component: UsabilityFeedback, description: "Help improve the learning experience for everyone." },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: TeacherSettings, description: "Manage your profile and sign-in details." },
  ];
  const schoolPages = [
    { label: "Dashboard", path: "/dashboard", group: "Overview", icon: LayoutDashboard, component: SuperAdminHome },
    { label: "School Progress", path: "/school-progress", group: "School insights", icon: BarChart3, component: SuperAdminHome, progress: true },
    { label: "Teacher Accounts", path: "/teachers", group: "Administration", icon: UserCog, component: TeacherManagement, description: "Manage teacher access and account invitations." },
    { label: "Training Content", path: "/content", group: "Administration", icon: Database, component: ContentBankManagement, description: "Review question coverage and maintain your training content." },
    { label: "Activity Log", path: "/logs", group: "Administration", icon: ServerCog, component: SystemLogs, description: "Keep track of account and content changes across your school." },
    { label: "Account Settings", path: "/settings", group: "Workspace", icon: Settings, component: SuperAdminSettings, description: "Manage your profile and school administration settings." },
  ];
  const pages = role === "admin" ? teacherPages : schoolPages;
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
        <Active key={`${currentPath}${currentSearch}`} user={user} setUser={setUser} onNavigate={navigate} followUps={page.followUps} progress={page.progress} />
      </ErrorBoundary>
    </Suspense>
  </ConsoleLayout></WorkspaceDataProvider>;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}