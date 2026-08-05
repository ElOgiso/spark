import React from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button, GlassCard } from "./ds";

interface ConflictResolutionModalProps {
  activeDeviceName?: string;
  onTakeover: () => void;
  onDismiss: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  activeDeviceName = "Device B",
  onTakeover,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <GlassCard className="max-w-md w-full p-6 border-amber-500/40 relative text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold mb-2 text-white">
          Active Session Transferred
        </h3>

        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          Spark Media OS active executive session moved to another active device (
          <span className="text-white font-medium">{activeDeviceName}</span>).
          Spark maintains one Executive Director per brand across all devices.
        </p>

        <div className="space-y-2">
          <Button variant="accent" fullWidth icon={<RefreshCw className="w-4 h-4" />} onClick={onTakeover}>
            Resume Executive Session Here
          </Button>
          <Button variant="ghost" fullWidth onClick={onDismiss}>
            View Read-Only Snapshot
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
