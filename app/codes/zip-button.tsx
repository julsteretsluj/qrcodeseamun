"use client";

import { useState } from "react";
import { buildBadgeZip, zipFileName, type BadgeFileSource } from "@/lib/badge-files";

export function ZipButton({
  badges,
  label,
  zipLabel,
  variant = "button",
}: {
  badges: BadgeFileSource[];
  label: string;
  zipLabel: string;
  variant?: "button" | "secondary" | "link";
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const zip = await buildBadgeZip(badges);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = zipFileName(zipLabel);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const className =
    variant === "link" ? "link-button" : variant === "secondary" ? "button secondary" : "button";

  return (
    <button
      className={className}
      type="button"
      onClick={() => void download()}
      disabled={busy}
      data-zip-count={badges.length}
    >
      {busy ? "Preparing ZIP…" : failed ? "ZIP failed, try again" : label}
    </button>
  );
}
