/** Renew private Spark URLs on hydration, including legacy public endpoint URLs.
 * Does not change durable paths, other providers, or write signed tokens to the DB.
 */
export async function refreshPrivateMedia<T>(
  value: T,
  projectUrl: string,
  sign: (path: string) => Promise<string | null>,
): Promise<T> {
  const origin = new URL(projectUrl).origin;
  const cache = new Map<string, Promise<string | null>>();
  const walk = async (item: any): Promise<any> => {
    if (typeof item === "string") {
      let path: string;
      try {
        const url = new URL(item);
        if (url.origin !== origin) return item;
        const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/Spark\/(.+)$/);
        if (!match) return item;
        path = decodeURIComponent(match[1]);
      } catch { return item; }
      if (!cache.has(path)) cache.set(path, sign(path).catch(() => null));
      // Missing/unauthorized media is unavailable, not a fabricated public URL.
      return await cache.get(path) || "";
    }
    if (Array.isArray(item)) return Promise.all(item.map(walk));
    if (item && typeof item === "object") {
      const entries = await Promise.all(Object.entries(item).map(async ([key, val]) => [key, await walk(val)]));
      return Object.fromEntries(entries);
    }
    return item;
  };
  return walk(value);
}
