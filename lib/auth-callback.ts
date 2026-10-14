import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export async function finishEmailLink(request: NextRequest, next: string, failure: string) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createServerSupabase();
  let ok = false;
  if (supabase) {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type) {
      ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    }
  }
  return NextResponse.redirect(new URL(ok ? next : failure, origin));
}
