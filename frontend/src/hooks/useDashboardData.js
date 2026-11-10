import {useWorkspaceQuery} from './useWorkspaceQuery';
export const TEACHER_SOURCES = { students: "/api/students", risk: "/api/analytics/at-risk", sections: "/api/sections", content: "/api/curriculum", recovery: "/api/password-assistance" };
export const SCHOOL_SOURCES = { ...TEACHER_SOURCES, teachers: "/api/teachers", logs: "/api/system-logs" };

export function useDashboardData(sources) {
  const state=useWorkspaceQuery(sources);
  for(const [key,value] of Object.entries(state.data)){
    if(!Array.isArray(value)){
      delete state.data[key];
      state.errors[key]='Unexpected response. Please try again.';
    }
  }
  return state;
}
