import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

type DesktopCanvasProps = {
  step: string;
  characterOpt?: string;
};

export function DesktopCanvas({ step, characterOpt }: DesktopCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subtle executive particle grid animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth ?? 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight ?? 600);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle nodes
    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number }> = [];
    const particleCount = 45;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 1,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle wireframe grid
      ctx.strokeStyle = "rgba(59, 130, 246, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Render & update particles
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.fillStyle = `rgba(59, 130, 246, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Connect close particles
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(59, 130, 246, ${(1 - dist / 100) * 0.15})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-card/40 border border-border/60 rounded-3xl overflow-hidden backdrop-blur-xl flex flex-col items-center justify-center p-8 antialiased">
      {/* 2D/3D Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Central Ambient Glow */}
      <div className="absolute w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Dynamic Interactive Visual Mesh for current step */}
      <div className="relative z-10 text-center space-y-6 max-w-sm">
        {step === "character-scanning" ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-blue-950/60 border-2 border-blue-400/60 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
              <motion.div
                className="absolute inset-x-0 h-1 bg-blue-400 shadow-[0_0_12px_#3b82f6]"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="w-16 h-16 rounded-full border border-blue-400/40 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-blue-400/80 animate-ping" />
              </div>
            </div>
            <p className="text-xs font-mono text-blue-300 uppercase tracking-widest">
              Mapping Character Depth Mesh
            </p>
          </motion.div>
        ) : step === "initialization" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="w-28 h-28 mx-auto rounded-2xl bg-blue-950/40 border border-blue-500/40 flex items-center justify-center shadow-xl">
              <div className="w-12 h-12 rounded-xl border border-blue-400/60 animate-spin" />
            </div>
            <p className="text-xs font-mono text-blue-400 uppercase tracking-widest">
              Calibrating Executive Kernel
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-background via-card to-blue-950 border border-blue-500/30 flex items-center justify-center shadow-lg">
              <div className="w-10 h-10 rounded-full border border-blue-400/50 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse" />
              </div>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Executive Director Active
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer System Status Code */}
      <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
        <span>SPARK OS v1.0 • KERNEL</span>
        <span>CONFIDENCE: 98.4%</span>
      </div>
    </div>
  );
}
