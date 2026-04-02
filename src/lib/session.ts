import { prisma } from "@/lib/prisma";
import { getBearerToken, verifyAccessToken } from "@/lib/auth";
import type { Role, UserStatus } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
};

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const jwt = await verifyAccessToken(token);
  if (!jwt) return null;
  const user = await prisma.user.findUnique({
    where: { id: jwt.sub },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (user.role !== jwt.role) return null;
  return user;
}

export function requireAuth(user: SessionUser | null): SessionUser {
  if (!user) {
    const err = new Error("UNAUTHORIZED") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return user;
}
