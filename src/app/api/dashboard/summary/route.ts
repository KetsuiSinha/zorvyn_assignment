import { jsonError, jsonOk } from "@/lib/api-response";
import { buildDashboardSummary } from "@/lib/dashboard";
import { canViewDashboardSummary } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { dashboardQuerySchema, formatZodError } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canViewDashboardSummary(session.role)) {
    return jsonError(403, "Forbidden");
  }

  const { searchParams } = new URL(request.url);
  const parsed = dashboardQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  const summary = await buildDashboardSummary(parsed.data.period);

  if (session.role === "VIEWER") {
    return jsonOk({
      summary: {
        ...summary,
        recentActivity: summary.recentActivity.map((r) => ({
          id: r.id,
          date: r.date,
          amount: r.amount,
          type: r.type,
          category: r.category,
        })),
      },
    });
  }

  return jsonOk({ summary });
}
