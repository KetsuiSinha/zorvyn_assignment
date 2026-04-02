import type { Role } from "@/generated/prisma/enums";

/** Short labels for UI badges. */
export function roleTitle(role: Role): string {
  switch (role) {
    case "VIEWER":
      return "Viewer";
    case "ANALYST":
      return "Analyst";
    case "ADMIN":
      return "Admin";
  }
}

/**
 * Human-readable capabilities enforced by the API (see `src/lib/rbac.ts`).
 * Viewer: dashboard data only · Analyst: dashboard + read records · Admin: full management.
 */
export function roleCapabilityLines(role: Role): string[] {
  switch (role) {
    case "VIEWER":
      return [
        "View dashboard data only: KPIs, trends, category breakdown, and recent activity (notes hidden).",
        "Cannot open the full records list or change any data.",
      ];
    case "ANALYST":
      return [
        "View dashboard data and insights (full summary, including notes where applicable).",
        "View and filter all financial records (read-only).",
      ];
    case "ADMIN":
      return [
        "View dashboard data and insights.",
        "Create, update, and delete financial records.",
        "Create users and manage roles and account status.",
      ];
  }
}
