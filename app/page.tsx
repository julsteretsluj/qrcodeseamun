import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { RegistrationDesk } from "@/components/registration-desk";

export default function HomePage() {
  return (
    <main className="page">
      <nav className="topbar">
        <span />
        <Link className="button quiet" href="/codes">
          Secretariat sign in
        </Link>
      </nav>
      <Wordmark
        title="Registration"
        lede="Scan a delegate or chair badge. The desk shows their name, committee, and allocation, and marks them registered."
      />
      <RegistrationDesk />
    </main>
  );
}
