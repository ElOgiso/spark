import { motion } from "framer-motion";

export type SparkGuideState = "idle" | "thinking" | "speaking" | "scanning";

type SparkGuideProps = {
  state?: SparkGuideState;
  message?: string;
  subtitle?: string;
};

export function SparkGuide({ state = "speaking", message, subtitle }: SparkGuideProps) {
  return (
    <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
      {/* Abstraction container for AI avatar stream (Higgsfield / HeyGen / Tavus / LiveKit / xAI) */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Ambient Glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl"
          animate={{
            scale: state === "speaking" ? [1, 1.25, 1] : [1, 1.1, 1],
            opacity: state === "speaking" ? [0.4, 0.8, 0.4] : [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer Ring Mesh */}
        <motion.div
          className="absolute inset-0 rounded-full border border-blue-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner Core Executive Avatar Placeholder */}
        <motion.div
          className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-background via-card to-blue-950/80 border border-blue-400/40 shadow-lg shadow-blue-500/10 flex items-center justify-center overflow-hidden"
          animate={{
            scale: state === "scanning" ? [0.95, 1.05, 0.95] : 1,
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {state === "scanning" ? (
            <motion.div
              className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_8px_#3b82f6]"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-blue-400/60 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
            </div>
          )}
        </motion.div>

        {/* Live Audio Waveform Indicator */}
        {state === "speaking" && (
          <div className="absolute -bottom-2 flex items-center justify-center space-x-1">
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="w-1 bg-blue-400 rounded-full"
                animate={{ height: ["4px", "12px", "4px"] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Conversational Message & Subtitle Bubble */}
      {(message || subtitle) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-xs space-y-1"
        >
          {message && (
            <p className="text-base font-semibold text-foreground tracking-tight leading-snug">
              {message}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-normal">
              {subtitle}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
