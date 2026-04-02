import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { formatZodError, updateUserSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Params) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canManageUsers(session.role)) return jsonError(403, "Forbidden");

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  if (Object.keys(parsed.data).length === 0) {
    return jsonError(400, "No fields to update");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "User not found");

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });
  return jsonOk({ user });
}
