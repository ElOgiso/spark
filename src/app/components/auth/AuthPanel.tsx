import { useState } from "react";
import {
  getCurrentUser,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "../../backend/authService";
import { isSupabaseConfigured } from "../../backend/supabaseClient";

type AuthMode = "sign-in" | "sign-up";

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  const submit = async () => {
    setMessage(null);
    const result =
      mode === "sign-in"
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

    setMessage(result.error ?? "Authentication request completed.");
  };

  const checkSession = async () => {
    const result = await getCurrentUser();
    setMessage(result.data ? "Session restored." : result.error ?? "No active session.");
  };

  const endSession = async () => {
    const result = await signOut();
    setMessage(result.error ?? "Signed out.");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Spark Account</p>
        <p className="text-xs text-muted-foreground">
          Auth is prepared for a later phase and does not block the app.
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
        disabled={!configured}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        disabled={!configured}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={password}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
          disabled={!configured}
          onClick={submit}
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={checkSession}>
          Restore session
        </button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={endSession}>
          Sign out
        </button>
      </div>

      {!configured && (
        <p className="text-xs text-muted-foreground">
          Add Supabase env variables and set VITE_USE_SUPABASE=true to enable auth.
        </p>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
