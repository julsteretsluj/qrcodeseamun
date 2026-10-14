export type CameraProblem = "insecure" | "unsupported" | "denied" | "missing" | "busy" | "failed";

export const cameraMessages: Record<CameraProblem, string> = {
  insecure:
    "The camera only works over HTTPS. Open the desk from its https:// address, or type or photograph the badge code.",
  unsupported:
    "This browser cannot use the camera. Try Safari on iPhone or Chrome on Android, or take a photo of the badge.",
  denied:
    "Camera access is blocked. Allow the camera for this site in your browser settings, then tap Use the camera again.",
  missing: "No camera was found on this device. Take a photo of the badge or type its code.",
  busy: "Another app is using the camera. Close it, then tap Use the camera again.",
  failed: "The camera could not start. Take a photo of the badge or type its code.",
};

export function cameraSupportProblem(): CameraProblem | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  return null;
}

export function classifyCameraError(error: unknown): CameraProblem {
  const name =
    error && typeof error === "object" && "name" in error ? String((error as Error).name) : "";
  const text = `${name} ${String(error)}`;
  if (/NotAllowed|Permission|denied|Security/i.test(text)) return "denied";
  if (/NotFound|Overconstrained|DevicesNotFound|no camera|Requested device not found/i.test(text)) {
    return "missing";
  }
  if (/NotReadable|TrackStart|Could not start video source/i.test(text)) return "busy";
  return "failed";
}

export async function requestRearCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
  stream.getTracks().forEach((track) => track.stop());
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices
    .filter((device) => device.kind === "videoinput" && device.deviceId)
    .map((device, index) => ({
      id: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
  return { cameras, activeId };
}
