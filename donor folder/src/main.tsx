import React, { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress unhandled extension / web3 / MetaMask errors from interrupting application runtime
if (typeof window !== "undefined") {
  const isExtensionOrWalletError = (err: any): boolean => {
    if (!err) return false;
    let str = "";
    if (typeof err === "string") {
      str = err;
    } else {
      try {
        str = [
          err.message,
          err.stack,
          err.reason,
          err.name,
          err.code,
          err.description,
          typeof err === "object" ? JSON.stringify(err) : "",
          String(err),
        ]
          .filter(Boolean)
          .join(" ");
      } catch {
        str = String(err);
      }
    }

    const lower = str.toLowerCase();
    return (
      lower.includes("metamask") ||
      lower.includes("ethereum") ||
      lower.includes("wallet") ||
      lower.includes("web3") ||
      lower.includes("cannot redefine property") ||
      lower.includes("failed to connect") ||
      lower.includes("user rejected") ||
      lower.includes("rpc error") ||
      lower.includes("evm") ||
      lower.includes("restoring session")
    );
  };

  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    const joined = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (isExtensionOrWalletError(joined) || args.some((a) => isExtensionOrWalletError(a))) {
      console.warn("[Spark] Suppressed wallet/extension error:", joined);
      return;
    }
    origConsoleError.apply(console, args);
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isExtensionOrWalletError(event.reason) || isExtensionOrWalletError(event)) {
      console.warn("[Spark] Suppressed extension rejection:", event.reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);

  window.addEventListener("error", (event) => {
    if (
      isExtensionOrWalletError(event.error) ||
      isExtensionOrWalletError(event.message) ||
      isExtensionOrWalletError(event)
    ) {
      console.warn("[Spark] Suppressed extension error:", event.message);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);

  (window as any).__isExtensionOrWalletError = isExtensionOrWalletError;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isGuard = typeof window !== "undefined" && (window as any).__isExtensionOrWalletError;
    if (isGuard && isGuard(error)) {
      console.warn("[Spark ErrorBoundary] Ignored extension error:", error);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Spark ErrorBoundary] Caught exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07050E] text-purple-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#0F0A1A]/80 border border-purple-500/20 p-8 rounded-2xl shadow-xl backdrop-blur-xl">
            <h1 className="text-xl font-bold mb-3 text-purple-200">Something went wrong</h1>
            <p className="text-sm text-purple-300/70 mb-6">
              {this.state.error?.message || "An unexpected error occurred in Spark Media OS."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-medium"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
