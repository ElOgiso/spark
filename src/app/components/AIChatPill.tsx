import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AIChatPillProps {
  onClick: () => void;
  isMobile?: boolean;
}

const phrases = [
  "See what we can do today",
  "Ask me anything, I am Spark",
  "Need a hand?"
];

export function AIChatPill({ onClick, isMobile = false }: AIChatPillProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % phrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center gap-2 rounded-full border border-white/10 
        bg-white/5 backdrop-blur-md px-3.5 py-1.5 transition-all duration-300 
        hover:border-accent/40 hover:bg-white/10 active:scale-95 text-left select-none
        shadow-lg shadow-black/10 overflow-hidden cursor-pointer
        ${isMobile ? "text-xs px-2.5 py-1" : "text-sm"}
      `}
    >
      {/* Reflective shine effect */}
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shine" />

      {/* Zap icon with custom glow */}
      <div className="relative flex items-center justify-center text-accent-foreground">
        <span className="absolute inset-0 rounded-full bg-accent/20 blur-sm scale-150 animate-pulse" />
        <Zap className={`relative shrink-0 ${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
      </div>

      {/* Glassmorphic text with animation */}
      <div className={`relative flex items-center min-w-[170px] ${isMobile ? "min-w-[140px]" : "min-w-[185px]"} h-5 overflow-hidden`}>
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute left-0 w-full truncate font-medium text-foreground/90 group-hover:text-foreground tracking-wide leading-none"
          >
            {phrases[index]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* 3D Iridescent Soap Bubble Overlay */}
      <div className="absolute inset-0 pointer-events-none rounded-full overflow-hidden z-10">
        {/* Soft moving rainbow oil/soap film */}
        <div className="absolute inset-0 opacity-[0.16] bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_auto] animate-iridescent" />
        
        {/* Bubble reflection top curved highlight */}
        <div className="absolute top-[0.5px] inset-x-2 h-[38%] rounded-t-full bg-gradient-to-b from-white/35 to-transparent" />
        
        {/* Bubble bottom reflection glow */}
        <div className="absolute bottom-[0.5px] inset-x-3.5 h-[22%] rounded-b-full bg-gradient-to-t from-white/10 to-transparent" />
        
        {/* Inner glass edge shine */}
        <div className="absolute inset-0 rounded-full border border-white/20 shadow-inner" />
      </div>
    </button>
  );
}
