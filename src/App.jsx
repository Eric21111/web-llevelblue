import { useState } from "react";
import {
  LayoutDashboard, Users, BookOpen, Activity, ClipboardList,
  UserCog, Database, ServerCog, ChevronRight,
} from "lucide-react";
import FontImports from "./components/FontImports";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import TeacherHome from "./pages/teacher/TeacherHome";
import ClassRoster from "./pages/teacher/ClassRoster";
import SkillAnalytics from "./pages/teacher/SkillAnalytics";
import EngagementReports from "./pages/teacher/EngagementReports";
import UsabilityFeedback from "./pages/teacher/UsabilityFeedback";
import SuperAdminHome from "./pages/super/SuperAdminHome";
import TeacherManagement from "./pages/super/TeacherManagement";
import ContentBankManagement from "./pages/super/ContentBankManagement";
import SystemLogs from "./pages/super/SystemLogs";
import { COLORS } from "./constants/colors";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState("admin");
  const [page, setPage] = useState(0);

  const handleLogin = (r) => {
    setRole(r);
    setPage(0);
    setAuthed(true);
  };

  const handleLogout = () => {
    setAuthed(false);
    setPage(0);
  };

  if (!authed) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const adminPages = [
    { label: "Dashboard", icon: LayoutDashboard, component: TeacherHome },
    { label: "Class Roster", icon: Users, component: ClassRoster },
    { label: "Skill Analytics", icon: BookOpen, component: SkillAnalytics },
    { label: "Engagement", icon: Activity, component: EngagementReports },
    { label: "Usability Survey", icon: ClipboardList, component: UsabilityFeedback },
  ];

  const superPages = [
    { label: "Dashboard", icon: LayoutDashboard, component: SuperAdminHome },
    { label: "Teacher Accounts", icon: UserCog, component: TeacherManagement },
    { label: "Content Bank", icon: Database, component: ContentBankManagement },
    { label: "System Logs", icon: ServerCog, component: SystemLogs },
  ];

  const pages = role === "admin" ? adminPages : superPages;
  const Active = pages[page]?.component || pages[0].component;
  const pageMeta = pages[page] || pages[0];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      <FontImports />
      <Sidebar role={role} page={page} setPage={setPage} pages={pages} onLogout={handleLogout} />
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
            <span style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>WMSU-ILS · S.Y. 2025-2026</span>
          </div>
        </div>
        <Active />
      </div>
    </div>
  );
}
