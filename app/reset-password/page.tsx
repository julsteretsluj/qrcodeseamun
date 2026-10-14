import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/lib/session";
import { NewPasswordForm } from "./new-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const { isOwner } = await getSession();

  return (
    <main className="page">
      <nav className="topbar">
        <Link className="back-link" href="/login">
          Sign in
        </Link>
      </nav>
      {isOwner ? (
        <>
          <Wordmark
            title="Choose a new password"
            lede="This replaces the password for your SEAMUN account everywhere it is used."
          />
          <NewPasswordForm />
        </>
      ) : (
        <>
          <Wordmark
            title="Reset link needed"
            lede="Open the reset link from your email in this browser to choose a new password."
          />
          <Link className="button secondary" href="/login">
            Request a new reset link
          </Link>
        </>
      )}
    </main>
  );
}
