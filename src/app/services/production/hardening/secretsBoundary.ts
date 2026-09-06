/**
 * Secret / client-boundary helpers for production hardening checks.
 */

const SECRET_KEY =
  /(api[_-]?key|secret|token|password|credential|service[_-]?role|private[_-]?key|authorization|bearer)/i;

const CLIENT_PATH =
  /(^|\/)(src\/app\/(components|pages|hooks|ui)|src\/components|public)\//i;

export function looksLikeSecretKey(name: string): boolean {
  return SECRET_KEY.test(name);
}

export function isLikelyClientPath(filePath: string): boolean {
  return CLIENT_PATH.test(filePath.replace(/\\/g, "/"));
}

export function findForbiddenClientSecretKeys(
  config: Record<string, unknown>,
  opts?: { allowPublicPrefixes?: string[] }
): string[] {
  const allow = opts?.allowPublicPrefixes || ["VITE_PUBLIC_", "NEXT_PUBLIC_", "PUBLIC_"];
  const offenders: string[] = [];
  for (const key of Object.keys(config)) {
    if (!looksLikeSecretKey(key)) continue;
    if (allow.some((p) => key.startsWith(p))) continue;
    if (/anon|publishable/i.test(key) && !/service.?role|secret/i.test(key)) continue;
    offenders.push(key);
  }
  return offenders;
}

export function scrubSecrets<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (looksLikeSecretKey(k)) continue;
    if (typeof v === "string" && looksLikeSecretKey(v)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function assertNoClientSecrets(params: {
  filePath: string;
  exportedEnvKeys: string[];
}): { ok: boolean; offenders: string[] } {
  if (!isLikelyClientPath(params.filePath)) return { ok: true, offenders: [] };
  const offenders = params.exportedEnvKeys.filter(
    (k) => looksLikeSecretKey(k) && !/PUBLIC|ANON|PUBLISHABLE/i.test(k)
  );
  return { ok: offenders.length === 0, offenders };
}
