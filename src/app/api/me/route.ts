import { jsonError, jsonOk } from "@/lib/api-response";
import { getSessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError(401, "Unauthorized");
  return jsonOk({ user });
}
