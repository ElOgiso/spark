import React, { useState } from "react";
import { Ticket, AlertTriangle, X } from "lucide-react";
import { Button } from "../../ui/button";

interface CreateCouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { code: string; amount: number; max_redemptions: number; expires_at?: string | null }) => Promise<void>;
}

export function CreateCouponModal({ isOpen, onClose, onConfirm }: CreateCouponModalProps) {
  if (!isOpen) return null;

  const [code, setCode] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [maxRedemptions, setMaxRedemptions] = useState<number>(50);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please specify a coupon code.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (maxRedemptions <= 0) {
      setError("Max redemptions must be greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm({
        code: code.trim().toUpperCase(),
        amount,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create coupon");
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
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Create Coupon Code</h2>
              <p className="text-xs text-white/50">VIP & Promotional Access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Coupon Code</label>
            <input
              type="text"
              placeholder="e.g. SPARK_VIP_2026"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono uppercase tracking-wider focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Credits Amount</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Max Redemptions</label>
              <input
                type="number"
                min="1"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Expiration Date (Optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

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
            <Button type="submit" variant="default" size="sm" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500 text-white">
              {isSubmitting ? "Creating..." : "Create Coupon"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
