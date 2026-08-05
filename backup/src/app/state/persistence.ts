/**
 * Persistence helper to abstract localStorage operations.
 * This ensures components and contexts do not directly manage storage complexity,
 * making it easy to swap this local storage layer with a database client (like Supabase) in the future.
 */

const STORAGE_KEY = "spark_state_v1";

export function loadPersistedState<T>(): T | null {
  try {
    if (typeof window !== "undefined") {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        return JSON.parse(serialized) as T;
      }
    }
  } catch (error) {
    console.error("Failed to load state from localStorage:", error);
  }
  return null;
}

export function savePersistedState<T>(state: T): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (error) {
    console.error("Failed to save state to localStorage:", error);
  }
}

export function clearPersistedState(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error("Failed to clear state from localStorage:", error);
  }
}
