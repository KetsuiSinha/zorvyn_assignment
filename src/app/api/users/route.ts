import bcrypt from "bcryptjs";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { createUserSchema, formatZodError } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canManageUsers(session.role)) return jsonError(403, "Forbidden");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return jsonOk({ users });
}

export async function POST(request: Request) {
  const session = await getSessionUser(request);
  if (!session) return jsonError(401, "Unauthorized");
  if (!canManageUsers(session.role)) return jsonError(403, "Forbidden");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "User with this email already exists");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  return jsonOk({ user }, 201);
}
