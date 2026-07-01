import { useState, useEffect } from "react";

export type DeviceType = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768; // Match Tailwind's md breakpoint

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    return window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
  });

  useEffect(() => {
    const handleResize = () => {
      const newDeviceType =
        window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
      if (newDeviceType !== deviceType) {
        setDeviceType(newDeviceType);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [deviceType]);

  return deviceType;
}
