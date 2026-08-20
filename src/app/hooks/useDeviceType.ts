import { useState, useEffect } from "react";

export type DeviceType = "mobile" | "desktop";

export const MOBILE_BREAKPOINT = 768; // Standard breakpoint (Tailwind md)

export function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const isTouch =
    window.matchMedia("(pointer: coarse)").matches ||
    ("ontouchstart" in window) ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  if (isTouch && window.innerWidth < 1024) return "mobile";
  return window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => detectDevice());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const handleUpdate = () => {
      const nextType = detectDevice();
      setDeviceType((prev) => {
        const isTouch =
          typeof window !== "undefined" &&
          (window.matchMedia("(pointer: coarse)").matches ||
            "ontouchstart" in window ||
            (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
        // If already mobile on a touch device under 1024px width, lock mobile state during keyboard height resizes
        if (prev === "mobile" && isTouch && window.innerWidth < 1024) {
          return "mobile";
        }
        return prev !== nextType ? nextType : prev;
      });
    };

    // Initial sync
    handleUpdate();

    // Listen to media query changes
    if (mql.addEventListener) {
      mql.addEventListener("change", handleUpdate);
    } else if ((mql as any).addListener) {
      // Fallback for older Safari/WebKit
      (mql as any).addListener(handleUpdate);
    }

    // Also listen to window resize and orientation changes
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("orientationchange", handleUpdate);

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handleUpdate);
      } else if ((mql as any).removeListener) {
        (mql as any).removeListener(handleUpdate);
      }
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("orientationchange", handleUpdate);
    };
  }, []);

  return deviceType;
}

