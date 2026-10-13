"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QR_OWNER_EMAIL } from "@/lib/access";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "password" | "email" | "code";

export function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  function client() {
    const supabase = createBrowserSupabase();
    if (!supabase) setError("Badge codes are not configured yet.");
    return supabase;
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (normalizedEmail() !== QR_OWNER_EMAIL) {
      setError("That email cannot open badge codes.");
      return;
    }
    const supabase = client();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError("That email and password did not match.");
      return;
    }
    router.refresh();
  }

  async function requestEmail(event: React.FormEvent) {
    event.preventDefault();
    if (normalizedEmail() !== QR_OWNER_EMAIL) {
      setError("That email cannot open badge codes.");
      return;
    }
    const supabase = client();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (sendError) {
      setError("The sign-in email could not be sent. Try again in a moment.");
      return;
    }
    setMode("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const supabase = client();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (verifyError) {
      setError("That code did not work. Request a new email and try again.");
      return;
    }
    router.refresh();
  }

  const emailField = (
    <>
      <label htmlFor="owner-email">Email</label>
      <input
        id="owner-email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
    </>
  );

  if (mode === "password") {
    return (
      <form className="panel desk-gate" onSubmit={signInWithPassword}>
        {emailField}
        <label htmlFor="owner-password" className="spaced">
          Password
        </label>
        <input
          id="owner-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <div className="actions">
          <button className="button" type="submit" disabled={busy}>
            Sign in to badge codes
          </button>
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              setError(null);
              setMode("email");
            }}
          >
            Email me a link instead
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }

  if (mode === "email") {
    return (
      <form className="panel desk-gate" onSubmit={requestEmail}>
        {emailField}
        <div className="actions">
          <button className="button" type="submit" disabled={busy}>
            Send the sign-in email
          </button>
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              setError(null);
              setMode("password");
            }}
          >
            Use my password
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }

  return (
    <form className="panel desk-gate" onSubmit={verifyCode}>
      <p className="note first">
        Open the link in that email on this device. If the email shows a code instead, type it here.
      </p>
      <label htmlFor="email-code" className="spaced">
        Code from your email
      </label>
      <input
        id="email-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      <div className="actions">
        <button className="button" type="submit" disabled={busy}>
          Open badge codes
        </button>
        <button
          className="button quiet"
          type="button"
          onClick={() => {
            setCode("");
            setError(null);
            setMode("password");
          }}
        >
          Use my password
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
