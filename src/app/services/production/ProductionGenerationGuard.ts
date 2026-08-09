/**
 * System-Wide Production Generation Guard for SPARK Media OS.
 * Enforces zero credit consumption and zero background generation when Production Generation is OFF.
 */
export class ProductionGenerationGuard {
  private static STORAGE_KEY = "spark_production_generation_enabled";

  static isEnabled(brandId?: string): boolean {
    if (typeof localStorage === "undefined") return true;
    try {
      if (brandId) {
        const scoped = localStorage.getItem(`${this.STORAGE_KEY}_${brandId}`);
        if (scoped !== null) return scoped !== "false";
      }
      const val = localStorage.getItem(this.STORAGE_KEY);
      return val !== "false";
    } catch {
      return true;
    }
  }

  static setEnabled(enabled: boolean, brandId?: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.STORAGE_KEY, String(enabled));
      if (brandId) {
        localStorage.setItem(`${this.STORAGE_KEY}_${brandId}`, String(enabled));
      }
      window.dispatchEvent(
        new CustomEvent("spark-production-toggle-changed", { detail: { enabled, brandId } })
      );
    } catch (err) {
      console.warn("[ProductionGenerationGuard] Storage update notice:", err);
    }
  }

  static assertEnabled(actionName: string, brandId?: string): void {
    if (!this.isEnabled(brandId)) {
      throw new Error(
        `[ProductionGenerationGuard] Action "${actionName}" blocked: Production Generation is currently OFF. Planning and read-only mode active.`
      );
    }
  }
}
