import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

const encoder = new TextEncoder();

const DEV_FALLBACK_SECRET =
  "zorvyn-dev-only-fallback-min-32-chars!!";

function getSecretBytes() {
  const raw = process.env.AUTH_SECRET?.trim();
  if (raw && raw.length >= 16) {
    return encoder.encode(raw);
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[auth] AUTH_SECRET is missing or shorter than 16 characters. Using a dev-only default; set AUTH_SECRET in .env (≥16 chars) for stable sessions.",
    );
    return encoder.encode(DEV_FALLBACK_SECRET);
  }
  throw new Error("AUTH_SECRET must be set and at least 16 characters");
}

export type JwtPayload = {
  sub: string;
  role: Role;
};

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretBytes());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretBytes());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const role = payload.role as Role | undefined;
    if (!sub || !role) return null;
    return { sub, role };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
