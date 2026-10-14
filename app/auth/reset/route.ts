import type { NextRequest } from "next/server";
import { finishEmailLink } from "@/lib/auth-callback";

export async function GET(request: NextRequest) {
  return finishEmailLink(request, "/reset-password", "/login?link=expired");
}
