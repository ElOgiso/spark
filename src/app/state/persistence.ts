/**
 * Persistence helper for SPARK Media OS.
 * Serves as a local offline/performance cache for the workspace,
 * with Supabase as the source of truth for authenticated user data.
 */

const STORAGE_KEY_PREFIX = "spark_state_";

export function loadPersistedState<T>(userId?: string, brandId?: string): T | null {
  try {
    if (typeof window !== "undefined") {
      if (userId && brandId) {
        const scoped = localStorage.getItem(`spark_state_${userId}_${brandId}`);
        if (scoped) return JSON.parse(scoped) as T;
      }
      if (brandId) {
        const scoped = localStorage.getItem(`spark_state_${brandId}`);
        if (scoped) return JSON.parse(scoped) as T;
      }
    }
  } catch (error) {
    console.error("Failed to load state from localStorage cache:", error);
  }
  return null;
}

export function savePersistedState<T>(state: T, userId?: string, brandId?: string): void {
  try {
    if (typeof window !== "undefined") {
      if (userId && brandId) {
        localStorage.setItem(`spark_state_${userId}_${brandId}`, JSON.stringify(state));
      }
      if (brandId) {
        localStorage.setItem(`spark_state_${brandId}`, JSON.stringify(state));
      }
    }
  } catch (error) {
    console.error("Failed to save state to localStorage cache:", error);
  }
}

export function clearPersistedState(): void {
  try {
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("spark_state_") || key.startsWith("spark_current_") || key === "spark_state_v1")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error("Failed to clear state from localStorage cache:", error);
  }
}
