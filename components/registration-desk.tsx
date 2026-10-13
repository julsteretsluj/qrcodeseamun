"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { createDeskClient } from "@/lib/supabase/desk";
import { parseBadgeCode } from "@/lib/parse-code";
import type { BadgeLookup, DeskCounts } from "@/lib/types";

const PIN_KEY = "seamun-desk-pin";

const emptyCounts: DeskCounts = {
  delegates_registered: 0,
  delegates_total: 0,
  chairs_registered: 0,
  chairs_total: 0,
};

function messageFor(status: BadgeLookup["status"]) {
  if (status === "bad_pin") return "That desk code is not right.";
  if (status === "locked") {
    return "The desk is paused after too many wrong codes. Try again in a few minutes.";
  }
  if (status === "not_found") return "No delegate or chair allocation uses that code.";
  if (status === "error") return "The roster could not be reached. Try the code again.";
  return null;
}

export function RegistrationDesk() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [counts, setCounts] = useState<DeskCounts>(emptyCounts);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<BadgeLookup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const pinRef = useRef("");
  const resumeCamera = useRef(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (!saved) return;
    pinRef.current = saved;
    void openDesk(saved, true);
  }, []);

  async function openDesk(nextPin: string, fromSession = false) {
    const supabase = createDeskClient();
    if (!supabase) {
      setNotice("The scanner is not connected to the roster yet.");
      return false;
    }
    setBusy(true);
    setNotice(null);
    const { data, error } = await supabase.rpc("open_registration_desk", {
      p_pin: nextPin,
    });
    setBusy(false);
    const payload = data as Partial<BadgeLookup> | null;
    if (error || !payload?.ok) {
      if (!fromSession) {
        setNotice(
          messageFor(error ? "error" : payload?.status === "locked" ? "locked" : "bad_pin")
        );
      }
      sessionStorage.removeItem(PIN_KEY);
      setUnlocked(false);
      return false;
    }
    pinRef.current = nextPin;
    sessionStorage.setItem(PIN_KEY, nextPin);
    setCounts({
      delegates_registered: payload.delegates_registered ?? 0,
      delegates_total: payload.delegates_total ?? 0,
      chairs_registered: payload.chairs_registered ?? 0,
      chairs_total: payload.chairs_total ?? 0,
    });
    setUnlocked(true);
    setNotice(null);
    return true;
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner?.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // The camera may already be stopped.
      }
    }
    try {
      scanner?.clear();
    } catch {
      // The viewfinder node may already be gone.
    }
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError(null);
    if (!document.getElementById("viewfinder")) return;
    const { Html5Qrcode } = await import("html5-qrcode");
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("viewfinder", { verbose: false });
    }
    if (scannerRef.current.isScanning) return;
    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 230, height: 230 } },
        (text) => {
          void lookup(text);
        },
        () => {}
      );
      setCameraOn(true);
    } catch {
      setCameraOn(false);
      setCameraError("The camera is unavailable. Type the badge code instead.");
    }
  }

  async function lookup(raw: string) {
    const parsed = parseBadgeCode(raw);
    if (!parsed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    await stopCamera();

    const supabase = createDeskClient();
    if (!supabase) {
      setNotice("The scanner is not connected to the roster yet.");
      busyRef.current = false;
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.rpc("register_badge", {
      p_pin: pinRef.current,
      p_code: parsed,
    });
    const payload = data as BadgeLookup | null;
    if (error || !payload) {
      setNotice(messageFor("error"));
      setResult(null);
    } else if (payload.status === "bad_pin" || payload.status === "locked") {
      sessionStorage.removeItem(PIN_KEY);
      setUnlocked(false);
      setResult(null);
      setNotice(messageFor(payload.status));
    } else if (payload.status === "not_found") {
      setResult(null);
      setNotice(messageFor("not_found"));
    } else {
      setResult(payload);
      setCounts({
        delegates_registered: payload.delegates_registered,
        delegates_total: payload.delegates_total,
        chairs_registered: payload.chairs_registered,
        chairs_total: payload.chairs_total,
      });
      setCode("");
    }
    busyRef.current = false;
    setBusy(false);
  }

  useEffect(() => {
    if (!unlocked || result || !resumeCamera.current) return;
    resumeCamera.current = false;
    void startCamera();
  }, [unlocked, result]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  if (!unlocked) {
    return (
      <form
        className="panel desk-gate"
        onSubmit={(event) => {
          event.preventDefault();
          void openDesk(pin.trim());
        }}
      >
        <label htmlFor="desk-pin">Desk code</label>
        <input
          id="desk-pin"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          autoComplete="off"
          inputMode="numeric"
          autoFocus
        />
        <div className="actions">
          <button className="button" type="submit" disabled={busy || pin.trim().length === 0}>
            Open the scanner
          </button>
        </div>
        {notice ? <p className="error">{notice}</p> : null}
      </form>
    );
  }

  const statusLine = result ? describeResult(result) : null;

  return (
    <div>
      <p className="tally">
        {counts.delegates_registered} of {counts.delegates_total} delegates registered
        {" · "}
        {counts.chairs_registered} of {counts.chairs_total} chairs registered
      </p>
      <div className="stage">
        <section>
          {result ? (
            <article className={`result ${result.status}`} aria-live="polite">
              <p className={`role ${result.role ?? "delegate"}`}>
                {result.role === "chair" ? "Chair" : "Delegate"}
              </p>
              <h2>{result.name ?? "Unassigned"}</h2>
              <p className="status">{statusLine}</p>
              <dl className="facts">
                <div>
                  <dt>Committee</dt>
                  <dd className="committee">{result.committee}</dd>
                </div>
                <div>
                  <dt>Allocation</dt>
                  <dd className="allocation">{result.allocation}</dd>
                </div>
              </dl>
              <div className="actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    resumeCamera.current = true;
                    setResult(null);
                    setNotice(null);
                  }}
                >
                  Scan the next badge
                </button>
              </div>
            </article>
          ) : (
            <>
              <div id="viewfinder" className="viewfinder" />
              {cameraError ? <p className="note">{cameraError}</p> : null}
              {!cameraOn ? (
                <div className="actions">
                  <button className="button secondary" type="button" onClick={() => void startCamera()}>
                    Use the camera
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
        <form
          className="panel manual"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(code);
          }}
        >
          <label htmlFor="badge-code">Badge code</label>
          <input
            id="badge-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="SEAMUN-2027-ECO-001"
          />
          <div className="actions">
            <button className="button" type="submit" disabled={busy || code.trim().length === 0}>
              Check this badge in
            </button>
          </div>
          <p className="note">Type the code if the badge will not scan.</p>
          {notice ? <p className="error">{notice}</p> : null}
        </form>
      </div>
    </div>
  );
}

function describeResult(result: BadgeLookup) {
  if (result.status === "unassigned") {
    return "No one is assigned to this seat yet, so it was not registered.";
  }
  if (result.status === "already_registered" && result.registered_at) {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(result.registered_at));
    return `Already registered at ${time}.`;
  }
  return "Registered just now.";
}
