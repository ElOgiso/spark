import { motion } from "framer-motion";

type SparkGuideState = "idle" | "thinking" | "speaking" | "scanning";

type SparkGuideProps = {
  state?: SparkGuideState;
  message?: string;
  subtitle?: string;
  className?: string;
};

export function SparkGuide({
  state = "speaking",
  message,
  subtitle,
  className = "",
}: SparkGuideProps) {
  return (
    <div className={`flex flex-col items-center text-center space-y-4 ${className}`}>
      {/* Provider-agnostic AI Avatar Sphere with Ambient Depth Light */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Glow Layer */}
        <motion.div
          animate={{
            scale: state === "speaking" ? [1, 1.15, 1] : state === "scanning" ? [1, 1.2, 1] : 1,
            opacity: state === "speaking" ? [0.4, 0.7, 0.4] : 0.4,
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600/30 via-purple-600/20 to-blue-400/30 blur-xl"
        />

        {/* Outer Orb Ring */}
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-blue-500/20 border-dashed"
        />

        {/* Inner Core Orb */}
        <motion.div
          animate={{
            scale: state === "thinking" ? [0.95, 1.05, 0.95] : [1, 1.04, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/25"
        >
          <div className="w-full h-full rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center overflow-hidden relative">
            {/* Ambient Animated Particles inside Orb */}
            <motion.div
              animate={{
                backgroundPosition: ["0% 0%", "100% 100%"],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-purple-500 to-transparent"
            />

            {/* Speaking / Audio Wave Indicators */}
            {state === "speaking" && (
              <div className="flex items-center space-x-1 z-10">
                {[0.4, 0.8, 0.5, 0.9, 0.6].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scaleY: [h, 1.2, h * 0.7, h],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut",
                    }}
                    className="w-1 h-5 bg-blue-400 rounded-full"
                  />
                ))}
              </div>
            )}

            {/* Scanning Wireframe Pulse */}
            {state === "scanning" && (
              <motion.div
                animate={{
                  translateY: ["-100%", "100%"],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-full h-1 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
              />
            )}

            {state === "idle" && (
              <div className="w-3 h-3 rounded-full bg-blue-400/80 shadow-[0_0_12px_#60a5fa]" />
            )}

            {state === "thinking" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full"
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Speech / Persona Header Bubble */}
      {(message || subtitle) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-xs space-y-1"
        >
          {message && (
            <p className="text-base font-semibold tracking-tight text-foreground/90 leading-snug">
              {message}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground font-normal leading-relaxed">
              {subtitle}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
