import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/lib/session";
import { signOut } from "../actions";
import { SignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const { user, isOwner } = await getSession();
  if (isOwner) redirect("/codes");
  const { link } = await searchParams;

  return (
    <main className="page">
      <nav className="topbar">
        <Link className="back-link" href="/">
          Registration desk
        </Link>
      </nav>
      {user ? (
        <>
          <Wordmark
            title="Not this account"
            lede={`You are signed in as ${user.email}. Badge codes only open for the SEAMUN secretariat account.`}
          />
          <form action={signOut}>
            <button className="button secondary" type="submit">
              Sign out and switch account
            </button>
          </form>
        </>
      ) : (
        <>
          <Wordmark
            title="Sign in"
            lede="Badge codes are for the secretariat. Sign in with your SEAMUN account to view, print, and download them."
          />
          {link === "expired" ? (
            <p className="error banner" role="alert">
              That email link has expired or was opened in a different browser. Request a new one.
            </p>
          ) : null}
          <SignIn />
        </>
      )}
    </main>
  );
}
