/**
 * Deterministic content fingerprint helpers.
 * Fingerprint ≠ asset identity. Used for duplicate detection only.
 */

export function fingerprintFromBytes(bytes: Uint8Array | ArrayBuffer): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // FNV-1a 64-bit style hash as hex — deterministic, no crypto dependency
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < data.length; i++) {
    h ^= BigInt(data[i]);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return `fnv1a64:${h.toString(16).padStart(16, "0")}`;
}

export function fingerprintFromString(input: string): string {
  const enc = new TextEncoder().encode(input);
  return fingerprintFromBytes(enc);
}

export function fingerprintFromUrlAndMeta(params: {
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}): string {
  const parts = [
    params.url?.trim() || "",
    params.mimeType || "",
    params.width != null ? String(params.width) : "",
    params.height != null ? String(params.height) : "",
    params.durationSec != null ? String(params.durationSec) : "",
  ];
  return fingerprintFromString(parts.join("|"));
}
