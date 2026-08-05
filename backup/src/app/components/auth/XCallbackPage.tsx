import React, { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getBrandWorkspaceId,
  getXRedirectUri,
  saveConnectedAccountToken,
} from "../../services/socialIntegrationService";

export function XCallbackPage() {
  const [status, setStatus] = useState<"verifying" | "exchanging" | "saving" | "redirecting" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";

    if (!code) {
      setStatus("error");
      setErrorMsg("Authorization code not found in URL parameters.");
      return;
    }

    if (state && !state.startsWith("spark_oauth_")) {
      setStatus("error");
      setErrorMsg("CSRF validation failed: Invalid state parameter.");
      return;
    }

    setStatus("exchanging");
    const redirectUri = getXRedirectUri();
    const brandId = getBrandWorkspaceId();
    const codeVerifier =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("spark_x_pkce_verifier") || ""
        : "";

    if (!codeVerifier) {
      setStatus("error");
      setErrorMsg("Missing PKCE verifier. Restart X connect from Spark.");
      return;
    }

    fetch("/api/auth/x/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        state,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        workspace_id: brandId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Server failed to exchange X tokens (${res.status}): ${text}`
          );
        }
        return res.json();
      })
      .then((data) => {
        setStatus("saving");
        const profile = data.profile;
        const now = new Date().toISOString();
        const token = {
          platform: "Twitter/X",
          handle: profile.username || "Unknown",
          displayName: profile.displayName || "Unknown",
          avatar: profile.avatarUrl || "",
          channelId: profile.userId || "",
          verified: true,
          status: "Connected" as any,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
          scopes: (data.scope || "").split(" ").filter(Boolean),
          permissionsGranted: (data.scope || "").split(" ").filter(Boolean),
          connectedAt: now,
          lastSyncAt: now,
          brand_id: brandId || undefined,
        };
        saveConnectedAccountToken(token);

        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("spark_x_pkce_verifier");
        }

        setStatus("redirecting");
        setTimeout(() => {
          const oauthSource = localStorage.getItem("spark_oauth_trigger_source");
          if (oauthSource === "onboarding") {
            window.location.href = "/?state=resume_onboarding";
          } else {
            window.location.href = "/";
          }
        }, 1000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "An unexpected error occurred during X token exchange.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6">
        <div className="flex justify-center">
          {status === "error" ? (
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          ) : status === "redirecting" ? (
            <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 animate-bounce" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-accent-foreground animate-spin" />
              <div className="absolute w-6 h-6 rounded-full bg-cyan-600/20" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Twitter/X Connection</h2>
          <p className="text-sm text-muted-foreground">
            {status === "verifying" && "Verifying OAuth security signature..."}
            {status === "exchanging" && "Exchanging auth code with X API..."}
            {status === "saving" && "Saving account details & profile metadata..."}
            {status === "redirecting" && "Workspace sync complete! Redirecting..."}
            {status === "error" && "An error occurred during authentication."}
          </p>
        </div>

        {status === "error" && (
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/15 text-left">
            <p className="text-xs font-mono text-destructive leading-relaxed break-words">{errorMsg}</p>
          </div>
        )}

        {status === "error" && (
          <button
            onClick={() => {
              const oauthSource = localStorage.getItem("spark_oauth_trigger_source");
              if (oauthSource === "onboarding") {
                window.location.href = "/?state=resume_onboarding";
              } else {
                window.location.href = "/";
              }
            }}
            className="w-full py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Return to Spark
          </button>
        )}
      </div>
    </div>
  );
}
