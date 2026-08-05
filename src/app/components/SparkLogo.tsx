import React from "react";

export interface SparkLogoProps {
  className?: string;
  size?: number | string;
  variant?: "main" | "superspark" | "auto";
}

/**
 * Official Spark Media OS Logos
 * - Image 1 (variant="main"): Main clean Spark outline star logo used on Navbar, Dashboard, and main UI.
 * - Image 2 (variant="superspark"): 3D vibrant magenta glossy star logo used on Login screen, Onboarding flow, and Super Spark.
 * NO casing box (no round or square container) - adapted cleanly to match environment.
 */
export const SparkLogo: React.FC<SparkLogoProps> = ({
  className = "w-8 h-8",
  size,
  variant = "main",
}) => {
  const style = size ? { width: size, height: size } : undefined;

  if (variant === "superspark") {
    // IMAGE 2: 3D Glossy Magenta/Purple Star Logo (Used for Login, Onboard Flow, and Super Spark)
    return (
      <svg
        viewBox="0 0 500 620"
        className={`${className} shrink-0 select-none overflow-visible`}
        style={style}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main 3D Magenta Fill Gradient */}
          <linearGradient id="supersparkBodyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FFA6FF" />
            <stop offset="25%" stopColor="#F52BFF" />
            <stop offset="60%" stopColor="#B800C9" />
            <stop offset="100%" stopColor="#670075" />
          </linearGradient>

          {/* Outer Glass Highlight Stroke */}
          <linearGradient id="supersparkStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#FF9EFF" />
            <stop offset="100%" stopColor="#7E008F" />
          </linearGradient>

          {/* Inner Gloss Sheen */}
          <linearGradient id="supersparkHighlightGrad" x1="10%" y1="10%" x2="60%" y2="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#FFCCFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F52BFF" stopOpacity="0" />
          </linearGradient>

          {/* Soft Outer Neon Glow */}
          <filter id="supersparkGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g filter="url(#supersparkGlowFilter)">
          {/* 1. Main 4-Point Curved Star Body */}
          <path
            d="M 450 15 
               C 340 180, 310 270, 395 365 
               C 275 345, 175 320, 25 320 
               C 170 300, 240 260, 160 590 
               C 220 390, 285 300, 450 15 Z"
            fill="url(#supersparkBodyGrad)"
            stroke="url(#supersparkStrokeGrad)"
            strokeWidth="6"
            strokeLinejoin="round"
          />

          {/* Specular Highlight Arc */}
          <path
            d="M 445 22 
               C 345 185, 315 272, 388 358 
               C 285 342, 195 322, 50 321 
               C 172 304, 235 268, 168 575 
               C 222 392, 288 302, 445 22 Z"
            fill="url(#supersparkHighlightGrad)"
            opacity="0.6"
          />

          {/* 2. Top-Left Satellite Flare */}
          <polygon
            points="138,122 201,222 170,188"
            fill="url(#supersparkBodyGrad)"
            stroke="url(#supersparkStrokeGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* 3. Right Satellite Flare */}
          <polygon
            points="358,295 470,296 462,310"
            fill="url(#supersparkBodyGrad)"
            stroke="url(#supersparkStrokeGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* 4. Bottom Satellite Flare */}
          <polygon
            points="262,410 304,518 280,475"
            fill="url(#supersparkBodyGrad)"
            stroke="url(#supersparkStrokeGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    );
  }

  // IMAGE 1: Clean Spark Main Logo (Used for Navbar, Dashboard, Main Spark UI)
  return (
    <svg
      viewBox="0 0 500 620"
      className={`${className} shrink-0 select-none text-foreground overflow-visible`}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        {/* 1. Main 4-Point Curved Star Body */}
        <path
          d="M 455 15 
             C 340 180, 310 270, 395 365 
             C 275 345, 175 320, 25 320 
             C 170 300, 240 260, 160 590 
             C 220 390, 285 300, 455 15 Z"
        />

        {/* 2. Top-Left Satellite Flare */}
        <polygon points="138,122 201,222 170,188" />

        {/* 3. Right Satellite Flare */}
        <polygon points="358,295 470,296 462,310" />

        {/* 4. Bottom Satellite Flare */}
        <polygon points="262,410 304,518 280,475" />
      </g>
    </svg>
  );
};
