import bcrypt from "bcryptjs";
import { signAccessToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { formatZodError, loginSchema } from "@/lib/validations";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    return jsonError(401, "Invalid email or password");
  }
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return jsonError(401, "Invalid email or password");

  try {
    const token = await signAccessToken({ sub: user.id, role: user.role });
    return jsonOk({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create session";
    return jsonError(500, message);
  }
}
