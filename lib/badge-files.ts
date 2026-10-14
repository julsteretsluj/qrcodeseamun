import QRCode from "qrcode";
import type { RosterBadge } from "@/lib/types";

export type BadgeFileSource = Pick<RosterBadge, "placard_code" | "committee" | "allocation">;

const QR_OPTIONS = {
  margin: 2,
  width: 600,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#1D1D1F", light: "#FFFFFF" },
};

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function badgeFileName(badge: BadgeFileSource) {
  return `${slug(badge.committee)}_${slug(badge.allocation)}_${badge.placard_code}.png`;
}

export function zipFileName(label: string) {
  return `SEAMUN-2027_${slug(label)}_badge-codes.zip`;
}

export function badgeDataUrl(placardCode: string) {
  return QRCode.toDataURL(placardCode, QR_OPTIONS);
}

function dataUrlBytes(dataUrl: string) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildBadgeZip(badges: BadgeFileSource[]) {
  const { zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const badge of badges) {
    files[badgeFileName(badge)] = dataUrlBytes(await badgeDataUrl(badge.placard_code));
  }
  return zipSync(files, { level: 0 });
}
