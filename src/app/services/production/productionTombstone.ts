/**
 * Local tombstones so hydrate cannot resurrect a production / review the user just deleted
 * while the cloud cascade is in flight (or briefly after it lands).
 */
const STORAGE_KEY = "spark_production_tombstones";
const TTL_MS = 24 * 60 * 60 * 1000;

type TombstoneMap = Record<string, number>;

function readMap(): TombstoneMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TombstoneMap;
  } catch {
    return {};
  }
}

function writeMap(map: TombstoneMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function prune(map: TombstoneMap): TombstoneMap {
  const now = Date.now();
  const next: TombstoneMap = {};
  for (const [id, until] of Object.entries(map)) {
    if (typeof until === "number" && until > now && id) next[id] = until;
  }
  return next;
}

export function recordProductionTombstone(...ids: Array<string | undefined | null>): void {
  const map = prune(readMap());
  const until = Date.now() + TTL_MS;
  for (const id of ids) {
    if (id && typeof id === "string") map[id] = until;
  }
  writeMap(map);
}

export function clearProductionTombstones(...ids: Array<string | undefined | null>): void {
  const map = prune(readMap());
  for (const id of ids) {
    if (id) delete map[id];
  }
  writeMap(map);
}

export function isProductionTombstoned(id?: string | null): boolean {
  if (!id) return false;
  const map = prune(readMap());
  writeMap(map);
  const until = map[id];
  return typeof until === "number" && until > Date.now();
}

export function filterTombstonedProductions<T extends { id?: string }>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((p) => !isProductionTombstoned(p?.id));
}

export function filterTombstonedReviews<T extends { id?: string; productionId?: string }>(
  items: T[] | undefined | null
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((r) => !isProductionTombstoned(r?.id) && !isProductionTombstoned(r?.productionId));
}
