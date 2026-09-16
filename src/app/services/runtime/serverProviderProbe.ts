/**
 * Server-side provider availability probe & cache.
 * Avoids treating server-only keyed providers (like Higgsfield) as unavailable in the browser.
 */

let serverProviderCache: Record<string, boolean> = {};
let probePromise: Promise<Record<string, boolean>> | null = null;

export function isServerProviderAvailable(providerId: string): boolean {
  if (typeof serverProviderCache[providerId] === "boolean") {
    return serverProviderCache[providerId];
  }
  return false;
}

export function setServerProviderAvailable(providerId: string, available: boolean): void {
  serverProviderCache[providerId] = available;
}

export function clearServerProviderCache(): void {
  serverProviderCache = {};
  probePromise = null;
}

export function getServerProviderCache(): Record<string, boolean> {
  return { ...serverProviderCache };
}

export async function probeServerProviders(): Promise<Record<string, boolean>> {
  if (probePromise) return probePromise;
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return serverProviderCache;
  }

  probePromise = (async () => {
    try {
      const res = await fetch("/api/runtime/execute", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.providers === "object") {
          serverProviderCache = { ...serverProviderCache, ...data.providers };
        }
      }
    } catch (err) {
      // Non-fatal probe failure (e.g. offline / mock test)
      console.warn("[serverProviderProbe] notice:", err);
    }
    return serverProviderCache;
  })();

  return probePromise;
}

// Automatically probe on browser startup
if (typeof window !== "undefined") {
  probeServerProviders().catch(() => {});
}
