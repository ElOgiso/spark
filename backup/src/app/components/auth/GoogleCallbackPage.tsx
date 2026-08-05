import React, { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getBrandWorkspaceId,
  getGoogleRedirectUri,
  saveConnectedAccountToken,
} from "../../services/socialIntegrationService";

export function GoogleCallbackPage() {
  const [status, setStatus] = useState<"verifying" | "exchanging" | "saving" | "redirecting" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    console.log("[GoogleCallbackPage] Mount started");
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";

    console.log("[GoogleCallbackPage] Query params detected:", {
      code: code ? "present (length: " + code.length + ")" : "absent",
      state: state ? `present (${state})` : "absent"
    });

    if (!code) {
      console.error("[GoogleCallbackPage] Error: code is missing");
      setStatus("error");
      setErrorMsg("Authorization code not found in URL parameters.");
      return;
    }

    if (state && !state.startsWith("spark_oauth_")) {
      console.warn("[GoogleCallbackPage] Warning: state validation bypassed/failed", state);
    }

    setStatus("exchanging");
    // Must match the redirect_uri used to start OAuth (registered in Google Console)
    const redirectUri = getGoogleRedirectUri();
    const brandId = getBrandWorkspaceId();

    console.log("[GoogleCallbackPage] Preparing backend POST with parameters:", {
      redirectUri,
      brandId
    });

    fetch("/api/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        state,
        redirect_uri: redirectUri,
        workspace_id: brandId,
      }),
    })
      .then(async (res) => {
        console.log(`[GoogleCallbackPage] POST response status: ${res.status}`);
        if (!res.ok) {
          const text = await res.text();
          console.error(`[GoogleCallbackPage] Token exchange failure response payload: ${text}`);
          // Keep JSON body so UI can show server `hint`
          throw new Error(text || `Token exchange failed (Status ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("[GoogleCallbackPage] Token exchange success. Profile received:", data.profile);
        setStatus("saving");
        const profile = data.profile || {};
        const now = new Date().toISOString();
        const token = {
          platform: "YouTube Shorts",
          handle: profile.username || "Unknown",
          displayName: profile.displayName || "Unknown",
          avatar: profile.avatarUrl || "",
          channelId: profile.channelId || "",
          verified: true,
          status: "Connected" as any,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          scopes: (data.scope || "").split(" ").filter(Boolean),
          permissionsGranted: (data.scope || "").split(" ").filter(Boolean),
          connectedAt: now,
          lastSyncAt: now,
          brand_id: brandId || undefined,
        };
        saveConnectedAccountToken(token);
        console.log("[GoogleCallbackPage] Saved token to storage.", {
          workspace_persisted: data.workspace_persisted,
          warning: data.warning,
        });

        setStatus("redirecting");
        setTimeout(() => {
          const oauthSource = localStorage.getItem("spark_oauth_trigger_source");
          console.log("[GoogleCallbackPage] Redirecting. Source was:", oauthSource);
          if (oauthSource === "onboarding") {
            window.location.href = "/?state=resume_onboarding";
          } else {
            window.location.href = "/";
          }
        }, 1000);
      })
      .catch((err) => {
        console.error("[GoogleCallbackPage] Flow execution stopped due to error:", err);
        setStatus("error");
        let msg = err.message || "An unexpected error occurred during Google token exchange.";
        // Surface server hint when present in thrown text
        try {
          const jsonMatch = msg.match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.hint) msg = `${parsed.error || "Connection failed"}\n\n${parsed.hint}`;
            else if (parsed.error) msg = parsed.error + (parsed.detail ? `\n${typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail)}` : "");
          }
        } catch {
          /* keep raw */
        }
        setErrorMsg(msg);
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
              <div className="absolute w-6 h-6 rounded-full bg-red-600/20" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">YouTube Shorts Connection</h2>
          <p className="text-sm text-muted-foreground">
            {status === "verifying" && "Verifying OAuth security signature..."}
            {status === "exchanging" && "Exchanging auth code with Google API..."}
            {status === "saving" && "Saving account details & channel profile..."}
            {status === "redirecting" && "Workspace sync complete! Redirecting..."}
            {status === "error" && "An error occurred during authentication."}
          </p>
        </div>

        {status === "error" && (
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/15 text-left">
            <p className="text-xs font-mono text-destructive leading-relaxed break-words whitespace-pre-wrap">{errorMsg}</p>
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
