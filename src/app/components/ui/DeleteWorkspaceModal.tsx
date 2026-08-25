import React, { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  brand: { id: string; name: string } | null;
  onClose: () => void;
  onConfirm: (brandId: string) => Promise<void>;
}

export function DeleteWorkspaceModal({
  isOpen,
  brand,
  onClose,
  onConfirm,
}: DeleteWorkspaceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !brand) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(brand.id);
      onClose();
    } catch (err) {
      console.warn("[DeleteWorkspaceModal] Deletion error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-workspace-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5 text-destructive">
            <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-workspace-title" className="text-sm font-semibold text-foreground">
                Delete Workspace
              </h3>
              <p className="text-[11px] text-muted-foreground">Permanent destruction of brand workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Content */}
        <div className="space-y-3">
          <p className="text-xs text-foreground/90 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-foreground underline decoration-destructive/50">{brand.name}</span>?
          </p>
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[11px] text-destructive leading-relaxed space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Irreversible Action
            </p>
            <p>
              This will permanently delete all productions, character profiles, visual keyframes, review cuts, and research sources associated with this workspace. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-xs font-semibold shadow-lg shadow-destructive/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Workspace</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
