import { Wordmark } from "@/components/wordmark";
import { RegistrationDesk } from "@/components/registration-desk";

export default function HomePage() {
  return (
    <main className="page">
      <Wordmark
        title="Registration"
        lede="Scan a delegate or chair badge. The desk shows their name, committee, and allocation, and marks them registered."
      />
      <RegistrationDesk />
    </main>
  );
}
