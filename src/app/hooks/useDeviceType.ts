import { useState, useEffect } from "react";

export type DeviceType = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768; // Match Tailwind's md breakpoint
const SESSION_DEVICE_KEY = "spark_shell_device_type";

function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "desktop";

  // Check stored session device preference first for session stability
  try {
    const stored = sessionStorage.getItem(SESSION_DEVICE_KEY);
    if (stored === "mobile" || stored === "desktop") {
      return stored;
    }
  } catch {}

  const isCoarsePointer = Boolean(
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );

  // If mobile touch device with viewport < 1024px, lock as mobile
  if (isCoarsePointer && window.innerWidth < 1024) {
    try {
      sessionStorage.setItem(SESSION_DEVICE_KEY, "mobile");
    } catch {}
    return "mobile";
  }

  const result: DeviceType = window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
  try {
    sessionStorage.setItem(SESSION_DEVICE_KEY, result);
  } catch {}
  return result;
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => detectDevice());

  useEffect(() => {
    let resizeTimer: any = null;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const isCoarsePointer = Boolean(
          (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
          (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
          /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        );

        // On mobile touch devices, don't flip shell due to address-bar/keyboard size variations
        if (isCoarsePointer && window.innerWidth < 1024) {
          return;
        }

        const newDeviceType: DeviceType =
          window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";

        setDeviceType((prev) => {
          if (prev !== newDeviceType) {
            try {
              sessionStorage.setItem(SESSION_DEVICE_KEY, newDeviceType);
            } catch {}
            return newDeviceType;
          }
          return prev;
        });
      }, 250);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return deviceType;
}
