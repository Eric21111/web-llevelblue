import {useDashboardData} from './useDashboardData';
const sources={students:'/api/students',sections:'/api/sections',notes:'/api/interventions'};
export default function useSupportData(){
 const state=useDashboardData(sources);
 return {...state,data:{students:[],sections:[],notes:[],...state.data}};
}
