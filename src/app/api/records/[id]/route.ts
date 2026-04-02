import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canMutateRecords } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { financialRecordSchema, formatZodError } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Params) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canMutateRecords(session.role)) {
    return jsonError(403, "Only administrators can update records");
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = financialRecordSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  if (Object.keys(parsed.data).length === 0) {
    return jsonError(400, "No fields to update");
  }

  const existing = await prisma.financialRecord.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Record not found");

  const r = await prisma.financialRecord.update({
    where: { id },
    data: parsed.data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonOk({
    record: {
      id: r.id,
      amount: r.amount.toString(),
      type: r.type,
      category: r.category,
      date: r.date.toISOString(),
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      createdBy: r.createdBy,
    },
  });
}

export async function DELETE(request: Request, ctx: Params) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canMutateRecords(session.role)) {
    return jsonError(403, "Only administrators can delete records");
  }

  const { id } = await ctx.params;
  const existing = await prisma.financialRecord.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Record not found");

  await prisma.financialRecord.delete({ where: { id } });
  return jsonOk({ ok: true });
}
