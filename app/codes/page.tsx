import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/lib/session";
import type { RosterBadge } from "@/lib/types";
import { signOut } from "../actions";
import { BadgeBoard } from "./badge-board";
import { PrintCodes } from "./print-codes";
import { ZipButton } from "./zip-button";

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const { supabase, user, isOwner } = await getSession();
  if (!supabase || !user) redirect("/login");

  if (!isOwner) {
    return (
      <main className="page">
        <nav className="topbar">
          <Link className="back-link" href="/">
            Registration desk
          </Link>
        </nav>
        <Wordmark
          title="Badge codes"
          lede={`${user.email} cannot open badge codes. They are only available to the SEAMUN secretariat account.`}
        />
        <form action={signOut}>
          <button className="button secondary" type="submit">
            Sign out and switch account
          </button>
        </form>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("list_registration_badges");
  const people = (data ?? []) as RosterBadge[];

  return (
    <main className="page">
      <nav className="topbar">
        <Link className="back-link" href="/">
          Registration desk
        </Link>
        <div className="account">
          <span>{user.email}</span>
          <form action={signOut}>
            <button className="button quiet" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="board-head">
        <Wordmark
          title="Badge codes"
          lede={`${people.length} codes, one for every delegate and chair allocation. Scanning a code at the desk checks that person in.`}
        />
        {people.length > 0 ? (
          <div className="head-actions">
            <ZipButton
              label="Download all as ZIP"
              zipLabel="All committees"
              badges={people.map(({ placard_code, committee, allocation }) => ({
                placard_code,
                committee,
                allocation,
              }))}
            />
            <PrintCodes />
          </div>
        ) : null}
      </div>
      {error || people.length === 0 ? (
        <p className="note">Badge codes could not be loaded for this account.</p>
      ) : (
        <BadgeBoard people={people} />
      )}
    </main>
  );
}
