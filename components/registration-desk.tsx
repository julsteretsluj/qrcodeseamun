"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import {
  cameraMessages,
  cameraSupportProblem,
  classifyCameraError,
  requestRearCamera,
} from "@/lib/camera";
import { createDeskClient } from "@/lib/supabase/desk";
import { parseBadgeCode } from "@/lib/parse-code";
import type { BadgeLookup, DeskCounts } from "@/lib/types";

const PIN_KEY = "seamun-desk-pin";
const REPEAT_WINDOW_MS = 4000;

const emptyCounts: DeskCounts = {
  delegates_registered: 0,
  delegates_total: 0,
  chairs_registered: 0,
  chairs_total: 0,
};

type Camera = { id: string; label: string };

function messageFor(status: BadgeLookup["status"]) {
  if (status === "bad_pin") return "That desk code is not right.";
  if (status === "locked") {
    return "The desk is paused after too many wrong codes. Try again in a few minutes.";
  }
  if (status === "not_found") return "No delegate or chair allocation uses that code.";
  if (status === "error") return "The roster could not be reached. Try the code again.";
  return null;
}

async function createDecoder(elementId: string) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
  return new Html5Qrcode(elementId, {
    verbose: false,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    useBarCodeDetectorIfSupported: true,
  });
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
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const startToken = useRef(0);
  const pinRef = useRef("");
  const lastRead = useRef<{ code: string; at: number } | null>(null);
  const resumeCamera = useRef(false);
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (!saved) return;
    pinRef.current = saved;
    void openDesk(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const stopCamera = useCallback(async () => {
    startToken.current += 1;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // The scanner was not running yet or has already stopped.
      }
    }
    document.querySelectorAll<HTMLVideoElement>("#viewfinder video").forEach((video) => {
      const stream = video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    });
    try {
      scanner?.clear();
    } catch {
      // The viewfinder node may already be gone.
    }
    setCameraOn(false);
  }, []);

  async function startCamera(preferredId?: string) {
    setCameraError(null);
    const problem = cameraSupportProblem();
    if (problem) {
      setCameraError(cameraMessages[problem]);
      return;
    }
    if (!document.getElementById("viewfinder")) return;
    setCameraStarting(true);
    await stopCamera();
    const token = startToken.current;

    let targetId = preferredId ?? cameraId;
    try {
      if (cameras.length === 0) {
        const found = await requestRearCamera();
        if (found.cameras.length === 0) {
          setCameraError(cameraMessages.missing);
          setCameraStarting(false);
          return;
        }
        setCameras(found.cameras);
        targetId = targetId ?? found.activeId;
      }

      const scanner = await createDecoder("viewfinder");
      scannerRef.current = scanner;
      await scanner.start(
        targetId ? { deviceId: { exact: targetId } } : { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const side = Math.max(160, Math.floor(Math.min(width, height) * 0.7));
            return { width: side, height: side };
          },
        },
        (text) => {
          void handleRead(text);
        },
        () => {}
      );
      if (token !== startToken.current) {
        scannerRef.current = scanner;
        await stopCamera();
        return;
      }
      setCameraId(targetId ?? null);
      setCameraOn(true);
    } catch (error) {
      scannerRef.current = null;
      setCameraOn(false);
      setCameraError(cameraMessages[classifyCameraError(error)]);
    } finally {
      setCameraStarting(false);
    }
  }

  function switchCamera() {
    if (cameras.length < 2) return;
    const index = cameras.findIndex((camera) => camera.id === cameraId);
    const next = cameras[(index + 1) % cameras.length];
    void startCamera(next.id);
  }

  async function handleRead(raw: string) {
    const parsed = parseBadgeCode(raw);
    if (!parsed) return;
    const now = Date.now();
    const previous = lastRead.current;
    if (previous && previous.code === parsed && now - previous.at < REPEAT_WINDOW_MS) return;
    lastRead.current = { code: parsed, at: now };
    await lookup(parsed);
  }

  async function lookup(raw: string) {
    const parsed = parseBadgeCode(raw);
    if (!parsed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setPhotoError(null);
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

  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setNotice(null);
    await stopCamera();
    let decoder: Html5Qrcode | null = null;
    try {
      decoder = await createDecoder("photo-decoder");
      const text = await decoder.scanFile(file, false);
      lastRead.current = null;
      await handleRead(text);
    } catch {
      setPhotoError(
        "No QR code was found in that photo. Fill the frame with the code and try again."
      );
    } finally {
      try {
        decoder?.clear();
      } catch {
        // Nothing was rendered.
      }
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  useEffect(() => {
    if (!unlocked || result || !resumeCamera.current) return;
    resumeCamera.current = false;
    void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, result]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void stopCamera();
    };
    const onPageHide = () => void stopCamera();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      void stopCamera();
    };
  }, [stopCamera]);

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
        {notice ? (
          <p className="error" role="alert">
            {notice}
          </p>
        ) : null}
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
                    resumeCamera.current = cameras.length > 0;
                    lastRead.current = null;
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
              <div className="viewfinder-frame">
                <div id="viewfinder" className="viewfinder" />
                {!cameraOn ? (
                  <p className="viewfinder-hint">
                    {cameraStarting ? "Starting the camera…" : "Point the rear camera at a badge code."}
                  </p>
                ) : null}
              </div>
              {cameraError ? (
                <p className="error" role="alert">
                  {cameraError}
                </p>
              ) : null}
              <div className="actions">
                {!cameraOn ? (
                  <button
                    className="button"
                    type="button"
                    disabled={cameraStarting || busy}
                    onClick={() => void startCamera()}
                  >
                    Use the camera
                  </button>
                ) : (
                  <button className="button secondary" type="button" onClick={() => void stopCamera()}>
                    Stop the camera
                  </button>
                )}
                {cameraOn && cameras.length > 1 ? (
                  <button className="button secondary" type="button" onClick={switchCamera}>
                    Switch camera
                  </button>
                ) : null}
                <label className="button secondary file-button">
                  Scan from a photo
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy}
                    onChange={(event) => void scanPhoto(event.target.files?.[0])}
                  />
                </label>
              </div>
              {photoError ? (
                <p className="error" role="alert">
                  {photoError}
                </p>
              ) : null}
            </>
          )}
          <div id="photo-decoder" className="photo-decoder" aria-hidden="true" />
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
          <p className="note">Type the code or the six-character ID if the badge will not scan.</p>
          {notice ? (
            <p className="error" role="alert">
              {notice}
            </p>
          ) : null}
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
