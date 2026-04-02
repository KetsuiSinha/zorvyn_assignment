import { Prisma } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canListRecords, canMutateRecords } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { financialRecordSchema, formatZodError, recordQuerySchema } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canListRecords(session.role)) {
    return jsonError(
      403,
      "Viewers can only use dashboard data. Analysts and admins may list financial records.",
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = recordQuerySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  const { type, category, dateFrom, dateTo, page, limit } = parsed.data;
  const where: Prisma.FinancialRecordWhereInput = {};
  if (type) where.type = type;
  if (category) where.category = { contains: category };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = dateFrom;
    if (dateTo) where.date.lte = dateTo;
  }

  const [total, records] = await Promise.all([
    prisma.financialRecord.count({ where }),
    prisma.financialRecord.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return jsonOk({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    records: records.map((r) => ({
      id: r.id,
      amount: r.amount.toString(),
      type: r.type,
      category: r.category,
      date: r.date.toISOString(),
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      createdBy: r.createdBy,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canMutateRecords(session.role)) {
    return jsonError(403, "Only administrators can create records");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = financialRecordSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  const r = await prisma.financialRecord.create({
    data: {
      amount: parsed.data.amount,
      type: parsed.data.type,
      category: parsed.data.category,
      date: parsed.data.date,
      notes: parsed.data.notes ?? null,
      createdById: session.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonOk(
    {
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
    },
    201,
  );
}
