import React, { useState } from "react";
import { Coins, AlertTriangle, Plus, Minus, X, Check } from "lucide-react";
import { Button } from "../../ui/button";

interface CreditAdjustmentModalProps {
  isOpen: boolean;
  user: { id: string; display_name?: string | null; email?: string | null; credit_balance?: number | null } | null;
  onClose: () => void;
  onConfirm: (delta: number, reason: string) => Promise<void>;
}

export function CreditAdjustmentModal({ isOpen, user, onClose, onConfirm }: CreditAdjustmentModalProps) {
  if (!isOpen || !user) return null;

  const [mode, setMode] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState<number>(50);
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBalance = Number(user.credit_balance ?? 0);
  const delta = mode === "add" ? amount : -amount;
  const projectedBalance = Math.max(0, currentBalance + delta);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please specify a reason for this credit adjustment.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(delta, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to adjust credits");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Adjust Video Credits</h2>
              <p className="text-xs text-white/50">{user.display_name || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Preview */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-xs">
          <div>
            <span className="text-white/40 text-[10px] uppercase font-mono block">Current Balance</span>
            <span className="text-base font-bold text-white font-mono">{currentBalance} credits</span>
          </div>
          <div>
            <span className="text-white/40 text-[10px] uppercase font-mono block">New Balance</span>
            <span className="text-base font-bold text-purple-300 font-mono">{projectedBalance} credits</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-white/[0.02] p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === "add" ? "bg-purple-600 text-white shadow-md shadow-purple-600/30" : "text-white/50 hover:text-white"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Grant Credits</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("subtract")}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === "subtract" ? "bg-red-600 text-white shadow-md shadow-red-600/30" : "text-white/50 hover:text-white"
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Deduct Credits</span>
            </button>
          </div>

          {/* Amount presets & input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Amount (Credits)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10000"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-1.5">
                {[25, 50, 100, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className="px-2.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-white/80 cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Audit Reason (Required)</label>
            <input
              type="text"
              placeholder="e.g. VIP Creator Grant / Monthly Quota / Bug Refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="default" size="sm" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500 text-white">
              {isSubmitting ? "Adjusting..." : "Confirm Adjustment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
