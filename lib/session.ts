import { QR_OWNER_EMAIL } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createServerSupabase();
  if (!supabase) return { supabase: null, user: null, isOwner: false } as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = (user?.email ?? "").toLowerCase() === QR_OWNER_EMAIL;
  return { supabase, user, isOwner } as const;
}

export function safeNext(value: string | null | undefined, fallback = "/codes") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
