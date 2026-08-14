import { useState, useEffect, Suspense, lazy } from "react";
import {
  LayoutDashboard, Users, BookOpen, Activity, ClipboardList,
  UserCog, Database, ServerCog, ChevronRight, Settings, GraduationCap
} from "lucide-react";
import FontImports from "./components/FontImports";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
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

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const handleLogin = (r, loginResponse) => {
    login(loginResponse);
    if (currentPath === "/" || currentPath === "/login") {
      window.history.pushState({}, "", "/dashboard");
      setCurrentPath("/dashboard");
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

  const adminPages = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, component: TeacherHome },
    { label: "Class Roster", path: "/roster", icon: Users, component: ClassRoster },
    { label: "Sections", path: "/sections", icon: GraduationCap, component: SectionsManagement },
    { label: "Skill Analytics", path: "/analytics", icon: BookOpen, component: SkillAnalytics },
    { label: "Engagement", path: "/engagement", icon: Activity, component: EngagementReports },
    { label: "Usability Survey", path: "/survey", icon: ClipboardList, component: UsabilityFeedback },
    { label: "Settings", path: "/settings", icon: Settings, component: TeacherSettings },
  ];

  const superPages = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, component: SuperAdminHome },
    { label: "Teacher Accounts", path: "/teachers", icon: UserCog, component: TeacherManagement },
    { label: "Content Bank", path: "/content", icon: Database, component: ContentBankManagement },
    { label: "System Logs", path: "/logs", icon: ServerCog, component: SystemLogs },
    { label: "Settings", path: "/settings", icon: Settings, component: SuperAdminSettings },
  ];

  const pages = role === "admin" ? adminPages : superPages;
  let pageIndex = pages.findIndex(p => p.path === currentPath);
  if (pageIndex === -1) pageIndex = 0;

  const Active = pages[pageIndex].component;
  const pageMeta = pages[pageIndex];

  const handleSetPage = (index) => {
    const targetPath = pages[index]?.path || "/dashboard";
    window.history.pushState({}, "", targetPath);
    setCurrentPath(targetPath);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: COLORS.bg, color: COLORS.text }}>
      <FontImports />
      <Sidebar role={role} user={user} page={pageIndex} setPage={handleSetPage} pages={pages} onLogout={handleLogout} />
      <div style={{ flex: 1, padding: "26px 32px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
              {role === "admin" ? "Teacher Console" : "Super Admin Console"} <ChevronRight size={12} /> {pageMeta.label}
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              {pageMeta.label}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>ZCSPC · S.Y. 2025-2026</span>
          </div>
        </div>
        <Suspense fallback={
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: COLORS.sub, fontFamily: "Inter, sans-serif" }}>
            Loading...
          </div>
        }>
          <ErrorBoundary>
            <Active user={user} setUser={setUser} />
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

