import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "../../ui/button";

interface DeleteUserModalProps {
  isOpen: boolean;
  user: { id: string; display_name?: string | null; email?: string | null } | null;
  onClose: () => void;
  onConfirm: (userId: string, email: string) => Promise<void>;
}

export function DeleteUserModal({ isOpen, user, onClose, onConfirm }: DeleteUserModalProps) {
  if (!isOpen || !user) return null;

  const userEmail = user.email || "";
  const [typedEmail, setTypedEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMatch = typedEmail.trim().toLowerCase() === userEmail.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch && userEmail) {
      setError("Please enter the exact user email to confirm deletion.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id, userEmail);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] border border-destructive/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center text-destructive">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-destructive">Delete Creator Account</h2>
              <p className="text-xs text-white/50">{user.display_name || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-red-200/90 space-y-1 leading-relaxed">
          <p className="font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Permanent Destruction Warning</span>
          </p>
          <p>
            This action will delete the user profile and permanently cascade all workspaces, characters, voices, and productions owned by this account. Cannot be undone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {userEmail && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">
                Type <span className="font-mono text-destructive font-semibold">{userEmail}</span> to confirm:
              </label>
              <input
                type="text"
                placeholder={userEmail}
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-destructive"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={isSubmitting || (userEmail ? !isMatch : false)}
              className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 disabled:opacity-40 text-white font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-destructive/20 active:scale-95"
            >
              {isSubmitting ? "Deleting Account..." : "Permanently Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
