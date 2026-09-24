import { DashboardStats } from "./types";

export function renderSummary(stats: DashboardStats): string {
  return `Sessions: ${stats.activeSessions} | Users: ${stats.totalUsers}`;
}
