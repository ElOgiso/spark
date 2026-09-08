/**
 * System-Wide Production Generation Guard for SPARK Media OS.
 * Enforces zero credit consumption and zero background generation when Production Generation is OFF.
 *
 * Source of truth: brand.settings.production_generation_enabled (cloud).
 * localStorage is a cache so offline/guards stay fast — hydrate overwrites it on login.
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

  /**
   * Apply cloud brand.settings truth into the localStorage cache.
   * Returns the resolved enabled flag. When cloud is undefined, keeps cache / default ON.
   */
  static applyCloudPreference(
    cloudEnabled: boolean | null | undefined,
    brandId?: string
  ): boolean {
    if (typeof cloudEnabled === "boolean") {
      this.setEnabled(cloudEnabled, brandId);
      return cloudEnabled;
    }
    return this.isEnabled(brandId);
  }

  static setEnabled(enabled: boolean, brandId?: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.STORAGE_KEY, String(enabled));
      if (brandId) {
        localStorage.setItem(`${this.STORAGE_KEY}_${brandId}`, String(enabled));
      }
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("spark-production-toggle-changed", { detail: { enabled, brandId } })
        );
      }
    } catch (err) {
      console.warn("[ProductionGenerationGuard] Storage update notice:", err);
    }
  }

  static assertAccessActive(actionName: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      const role = localStorage.getItem("spark_user_role");
      if (role === "admin") return; // Admins bypass access status checks

      const status = localStorage.getItem("spark_access_status");
      if (status === "pending_approval" || status === "banned" || status === "rejected") {
        throw new Error(
          `[SPARK Security Guard] Action "${actionName}" refused: Account access is "${status}". Waiting for executive administrator clearance.`
        );
      }
    } catch (err: any) {
      if (err?.message?.includes("[SPARK Security Guard]")) {
        throw err;
      }
    }
  }

  /** Super Spark chat is the only spend path allowed when Production Generation is OFF. */
  static isExemptCategory(category?: string | null): boolean {
    return category === "superSpark";
  }

  static assertEnabled(actionName: string, brandId?: string): void {
    this.assertSpendAllowed(actionName, undefined, brandId);
  }

  /**
   * Credit firewall. When Production is OFF, only category "superSpark" may spend.
   * All other ModelRouter categories, briefs, images, video, and research analysis throw.
   */
  static assertSpendAllowed(actionName: string, category?: string | null, brandId?: string): void {
    this.assertAccessActive(actionName);

    if (this.isExemptCategory(category)) return;

    if (!this.isEnabled(brandId)) {
      throw new Error(
        `[ProductionGenerationGuard] Action "${actionName}" blocked: Production Generation is currently OFF. Super Spark chat is the only allowed spend path.`
      );
    }
  }
}
