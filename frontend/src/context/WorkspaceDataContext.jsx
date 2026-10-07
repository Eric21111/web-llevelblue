import { createContext, useContext } from "react";
import { SCHOOL_SOURCES, TEACHER_SOURCES, useDashboardData } from "../hooks/useDashboardData";

const WorkspaceDataContext = createContext(null);

// The dashboard and notification menu share one refresh cycle across page changes.
export function WorkspaceDataProvider({ role, children }) {
  const state = useDashboardData(role === "super" ? SCHOOL_SOURCES : TEACHER_SOURCES);
  return <WorkspaceDataContext.Provider value={state}>{children}</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData() {
  const state = useContext(WorkspaceDataContext);
  if (!state) throw new Error("Workspace data requires WorkspaceDataProvider");
  return state;
}
