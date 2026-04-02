import type { Role } from "@/generated/prisma/enums";

/**
 * Viewer — dashboard data only (aggregates, trends, recent activity; notes stripped server-side).
 * Analyst & Admin — same endpoint with full detail where applicable.
 */
export function canViewDashboardSummary(role: Role): boolean {
  return role === "VIEWER" || role === "ANALYST" || role === "ADMIN";
}

/** Alias: insights = summary aggregates (totals, trends, by-category, recent activity). */
export function canAccessInsights(role: Role): boolean {
  return canViewDashboardSummary(role);
}

/**
 * Analyst & Admin — list/filter records (read).
 * Viewer — forbidden (must not access raw record APIs).
 */
export function canListRecords(role: Role): boolean {
  return role === "ANALYST" || role === "ADMIN";
}

/**
 * Admin only — create / update / delete financial records.
 */
export function canMutateRecords(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Admin only — create users and change roles / status.
 */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}
