import type { NextRequest } from "next/server";
import { finishEmailLink } from "@/lib/auth-callback";
import { safeNext } from "@/lib/session";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  return finishEmailLink(request, next, "/login?link=expired");
}
