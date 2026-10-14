"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QR_OWNER_EMAIL } from "@/lib/access";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "password" | "link" | "code" | "forgot" | "forgot-sent";

export function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = email.trim().toLowerCase();

  function switchTo(next: Mode) {
    setError(null);
    setCode("");
    setMode(next);
  }

  function ready() {
    if (normalized !== QR_OWNER_EMAIL) {
      setError("Badge codes are only open to the SEAMUN secretariat account.");
      return null;
    }
    const supabase = createBrowserSupabase();
    if (!supabase) setError("Sign-in is not configured yet.");
    return supabase;
  }

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await task();
    setBusy(false);
    if (message) setError(message);
  }

  function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    const supabase = ready();
    if (!supabase) return;
    void run(async () => {
      const { error: failure } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (failure) return "That email and password did not match.";
      router.replace("/codes");
      router.refresh();
      return null;
    });
  }

  function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = ready();
    if (!supabase) return;
    void run(async () => {
      const { error: failure } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/codes`,
        },
      });
      if (failure) return "The sign-in email could not be sent. Try again in a minute.";
      setMode("code");
      return null;
    });
  }

  function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const supabase = ready();
    if (!supabase) return;
    void run(async () => {
      const { error: failure } = await supabase.auth.verifyOtp({
        email: normalized,
        token: code.trim(),
        type: "email",
      });
      if (failure) return "That code did not work. Send a new email and try again.";
      router.replace("/codes");
      router.refresh();
      return null;
    });
  }

  function sendReset(event: React.FormEvent) {
    event.preventDefault();
    const supabase = ready();
    if (!supabase) return;
    void run(async () => {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (failure) return "The reset email could not be sent. Try again in a minute.";
      setMode("forgot-sent");
      return null;
    });
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

  const errorLine = error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;

  if (mode === "password") {
    return (
      <form className="panel desk-gate" onSubmit={signInWithPassword}>
        {emailField}
        <div className="label-row spaced">
          <label htmlFor="owner-password">Password</label>
          <button className="link-button" type="button" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        </div>
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
          <button className="button quiet" type="button" onClick={() => switchTo("link")}>
            Email me a sign-in link
          </button>
        </div>
        {errorLine}
      </form>
    );
  }

  if (mode === "link") {
    return (
      <form className="panel desk-gate" onSubmit={sendLink}>
        {emailField}
        <div className="actions">
          <button className="button" type="submit" disabled={busy}>
            Send the sign-in link
          </button>
          <button className="button quiet" type="button" onClick={() => switchTo("password")}>
            Use my password
          </button>
        </div>
        {errorLine}
      </form>
    );
  }

  if (mode === "code") {
    return (
      <form className="panel desk-gate" onSubmit={verifyCode}>
        <p className="note first">
          Open the link in that email on this device. If the email shows a code instead, type it
          here.
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
          <button className="button quiet" type="button" onClick={() => switchTo("password")}>
            Use my password
          </button>
        </div>
        {errorLine}
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="panel desk-gate" onSubmit={sendReset}>
        <p className="note first">
          We will email a link to choose a new password. Open it in this browser.
        </p>
        <div className="spaced">{emailField}</div>
        <div className="actions">
          <button className="button" type="submit" disabled={busy}>
            Email me a reset link
          </button>
          <button className="button quiet" type="button" onClick={() => switchTo("password")}>
            Back to sign in
          </button>
        </div>
        {errorLine}
      </form>
    );
  }

  return (
    <div className="panel desk-gate">
      <p className="note first">
        Check {normalized} for a reset link. It opens a page here where you can choose a new
        password.
      </p>
      <div className="actions">
        <button className="button secondary" type="button" onClick={() => switchTo("password")}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
