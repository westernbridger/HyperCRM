"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getLeadsByDay,
  getRecentActivities,
} from "@/lib/data/contacts";

// Shared dashboard queries. Several widgets previously each called
// getDashboardStats() in their own useEffect — these hooks dedupe that work
// through the React Query cache so the dashboard issues one request per source.

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });
}

export function useLeadsByDay() {
  return useQuery({
    queryKey: ["dashboard", "leads-by-day"],
    queryFn: getLeadsByDay,
  });
}

export function useRecentActivities() {
  return useQuery({
    queryKey: ["dashboard", "recent-activities"],
    queryFn: getRecentActivities,
  });
}
