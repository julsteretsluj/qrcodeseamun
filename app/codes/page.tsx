import { Wordmark } from "@/components/wordmark";
import { QR_OWNER_EMAIL } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";
import type { RosterBadge } from "@/lib/types";
import { signOutOfCodes } from "./actions";
import { BadgeBoard } from "./badge-board";
import { PrintCodes } from "./print-codes";
import { SignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return (
      <main className="page">
        <Wordmark
          title="Badge codes"
          lede="Badge codes are not configured yet."
        />
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (user.email ?? "").toLowerCase() !== QR_OWNER_EMAIL) {
    const denied = Boolean(user);
    return (
      <main className="page">
        <Wordmark
          title="Badge codes"
          lede={
            denied
              ? "This account cannot open badge codes."
              : "Sign in to print a code for every allocation."
          }
        />
        {denied ? (
          <form action={signOutOfCodes}>
            <button className="button secondary" type="submit">
              Sign out
            </button>
          </form>
        ) : (
          <SignIn />
        )}
      </main>
    );
  }

  const { data, error } = await supabase.rpc("list_registration_badges");
  const people = (data ?? []) as RosterBadge[];

  return (
    <main className="page">
      <div className="board-head">
        <Wordmark
          title="Badge codes"
          lede="One code for every allocation. Scanning a code checks that delegate or chair in."
        />
        <div className="head-actions">
          <PrintCodes />
          <form action={signOutOfCodes}>
            <button className="button quiet" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
      {error || people.length === 0 ? (
        <p className="note">Badge codes could not be loaded for this account.</p>
      ) : (
        <BadgeBoard people={people} />
      )}
    </main>
  );
}
