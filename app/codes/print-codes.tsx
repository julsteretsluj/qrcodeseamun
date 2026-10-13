"use client";

export function PrintCodes() {
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      Print badge codes
    </button>
  );
}
