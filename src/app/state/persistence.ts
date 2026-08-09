/**
 * Persistence helper for SPARK Media OS.
 * Serves as a local offline/performance cache for the workspace,
 * with Supabase as the source of truth for authenticated user data.
 */

const STORAGE_KEY = "spark_state_v1";

export function loadPersistedState<T>(brandId?: string): T | null {
  try {
    if (typeof window !== "undefined") {
      if (brandId) {
        const scoped = localStorage.getItem(`spark_state_${brandId}`);
        if (scoped) return JSON.parse(scoped) as T;
      }
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        return JSON.parse(serialized) as T;
      }
    }
  } catch (error) {
    console.error("Failed to load state from localStorage cache:", error);
  }
  return null;
}

export function savePersistedState<T>(state: T, brandId?: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (brandId) {
        localStorage.setItem(`spark_state_${brandId}`, JSON.stringify(state));
      }
    }
  } catch (error) {
    console.error("Failed to save state to localStorage cache:", error);
  }
}

export function clearPersistedState(brandId?: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      if (brandId) {
        localStorage.removeItem(`spark_state_${brandId}`);
      }
    }
  } catch (error) {
    console.error("Failed to clear state from localStorage cache:", error);
  }
}
