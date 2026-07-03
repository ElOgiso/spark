import { useState } from "react";
import { Button } from "../ds";
import { useAuth } from "../../state/AuthContext";

type AuthMode = "sign-in" | "sign-up";

export function AuthPanel() {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    if (mode === "sign-in") {
      await auth.signIn(email, password);
    } else {
      await auth.signUp(email, password);
    }

    setMessage(auth.error ?? "Authentication request completed.");
  };

  const checkSession = async () => {
    await auth.refreshSession();
    setMessage(auth.isAuthenticated ? "Session restored." : "No active session.");
  };

  const endSession = async () => {
    await auth.signOut();
    setMessage("Signed out.");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Spark Account</p>
        <p className="text-xs text-muted-foreground">
          {auth.isAuthenticated
            ? `Signed in as ${auth.currentUser?.email ?? "Spark user"}.`
            : "Auth is available when a Spark Supabase project is configured."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-xs"
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-xs"
          onClick={() => setMode("sign-up")}
        >
          Sign up
        </button>
      </div>

      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        disabled={!auth.isConfigured}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        disabled={!auth.isConfigured}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={password}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="text-xs"
          disabled={!auth.isConfigured || auth.loading}
          onClick={submit}
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={checkSession}>
          Restore session
        </button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={endSession}>
          Sign out
        </button>
      </div>

      {!auth.isConfigured && (
        <p className="text-xs text-muted-foreground">
          Add Supabase env variables and set VITE_USE_SUPABASE=true to enable auth.
        </p>
      )}
      {(message || auth.error) && <p className="text-xs text-muted-foreground">{message ?? auth.error}</p>}
    </div>
  );
}
