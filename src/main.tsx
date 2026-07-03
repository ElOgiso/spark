import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

// Register Service Worker for PWA (offline & push support)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Spark Service Worker registered with scope:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("New version of Spark is available; reloading in background...");
                // Dispatch a custom event to notify the app of updates
                window.dispatchEvent(new CustomEvent("pwa-update-available"));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("Spark Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
