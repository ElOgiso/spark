import React, { useState, useEffect, useRef } from "react";
import mainLogo from "@/imports/MAIN_LOGO.png";
import { MainLogoAnimated } from "../ui/SparkAnimatedLogo";

// ─── Keyframes & Styles from Donor ─────────────────────────────────────────────
const SPLASH_STYLES = `
  @keyframes reel-scanline {
    from { background-position:0 0; }
    to   { background-position:0 4px; }
  }
  @keyframes reel-zoom {
    from { transform:scale(1.07); }
    to   { transform:scale(1); }
  }
  @keyframes reel-logo-pop {
    0%   { transform:scale(0.55); opacity:0; }
    45%  { transform:scale(1.1);  opacity:1; }
    65%  { transform:scale(0.95); }
    100% { transform:scale(1);    opacity:1; }
  }
  @keyframes reel-keyword {
    0%   { opacity:0; transform:scale(0.8) translateY(8px); letter-spacing:0.5em; }
    22%  { opacity:1; transform:scale(1)   translateY(0);   letter-spacing:0.32em; }
    78%  { opacity:1; }
    100% { opacity:0; letter-spacing:0.4em; }
  }
  @keyframes reel-scatter-in {
    0%   { opacity:0; transform:scale(0.45); }
    55%  { opacity:1; transform:scale(1.08); }
    100% { opacity:1; transform:scale(1); }
  }
  @keyframes reel-spark-reveal {
    0%   { opacity:0; transform:scale(0.25); filter:brightness(0); }
    28%  { opacity:1; transform:scale(1.18); filter:brightness(4)  drop-shadow(0 0 70px #F018FF); }
    45%  { transform:scale(0.88);            filter:brightness(1.4) drop-shadow(0 0 30px #F018FF); }
    65%  { transform:scale(1.06);            filter:brightness(2.8) drop-shadow(0 0 55px #FF88FF); }
    82%  { transform:scale(0.97);            filter:brightness(1)   drop-shadow(0 0 22px #F018FF); }
    100% { opacity:1; transform:scale(1);    filter:brightness(1)   drop-shadow(0 0 18px #F018FF); }
  }
  @keyframes reel-wordmark {
    from { opacity:0; transform:translateY(14px) scale(0.9); letter-spacing:0.7em; }
    to   { opacity:1; transform:translateY(0)    scale(1);   letter-spacing:0.5em; }
  }
  .reel-frame-content {
    animation: reel-zoom 600ms ease-out both;
  }
`;

// ─── Platform Logos from Donor ────────────────────────────────────────────────
function YouTubeLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#FF0000" />
      <path d="M19.8 8.2s-.2-1.4-.8-2c-.76-.8-1.6-.8-2-.85C14.6 5.2 12 5.2 12 5.2s-2.6 0-5 .15c-.4.05-1.24.05-2 .85-.6.6-.8 2-.8 2S4 9.8 4 11.4v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.76.8 1.76.77 2.2.85C8.8 19 12 19 12 19s2.6 0 5-.17c.4-.05 1.24-.05 2-.85.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C20 9.8 19.8 8.2 19.8 8.2z" fill="white" />
      <path d="M10 15V9l6 3-6 3z" fill="#FF0000" />
    </svg>
  );
}

function XLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#000" />
      <path d="M17.75 4h-2.47l-3.28 4.24L8.52 4H3.5l5.75 7.78L3.5 20h2.47l3.64-4.7L13.48 20H18.5l-6.09-8.22L17.75 4z" fill="white" />
    </svg>
  );
}

function InstagramLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="spl-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f9a825" /><stop offset="30%" stopColor="#f06292" />
          <stop offset="65%" stopColor="#ba68c8" /><stop offset="100%" stopColor="#5c6bc0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#spl-ig-grad)" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="16.5" cy="7.5" r="0.85" fill="white" />
    </svg>
  );
}

function TikTokLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#010101" />
      <path d="M16.6 5.82s.18 2.37 2.4 3.04v2.3s-1.36.07-2.4-.62v5.46a4.86 4.86 0 1 1-4.86-4.86c.17 0 .33.01.5.03v2.35a2.53 2.53 0 1 0 1.74 2.4V5.82h2.62z" fill="white" />
    </svg>
  );
}

function FacebookLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path d="M15 8h-1.5C12.67 8 12 8.67 12 9.5V11h3l-.4 2.5H12V20h-2.5v-6.5H8V11h1.5V9.5C9.5 7.57 11.07 6 13 6H15v2z" fill="white" />
    </svg>
  );
}

function LinkedInLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#0077B5" />
      <rect x="5" y="9" width="3" height="10" fill="white" />
      <circle cx="6.5" cy="6.5" r="1.75" fill="white" />
      <path d="M10 9h3v1.35c.5-.85 1.5-1.5 3-1.5 2.5 0 4 1.5 4 4.5V19h-3v-5c0-1.5-.5-2.5-1.75-2.5-1.25 0-2.25 1-2.25 2.5V19h-3V9z" fill="white" />
    </svg>
  );
}

function ThreadsLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#101010" />
      <path d="M16.34 11.48a5.27 5.27 0 0 0-.38-.17c-.22-2.36-1.75-3.71-4.14-3.72-1.35 0-2.5.5-3.2 1.41l1.1.9c.52-.67 1.27-1.02 2.2-1.02 1.17 0 2 .57 2.34 1.6a7.5 7.5 0 0 0-1.75-.06c-1.96.1-3.22 1.18-3.14 2.78.04.83.46 1.54 1.19 2.01.62.4 1.41.6 2.23.55 1.08-.06 1.93-.46 2.52-1.17.45-.54.74-1.25.87-2.15a3.44 3.44 0 0 1 1.37 1.22c-.42 1.9-1.87 3.08-4.02 3.21a5.36 5.36 0 0 1-3.65-1.1C8.42 14.88 8 13.8 8 12.58c0-1.35.52-2.5 1.5-3.33" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="13.5" cy="11.8" r="1.1" fill="white" />
    </svg>
  );
}

function PinterestLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#E60023" />
      <path d="M12 4C7.58 4 4 7.58 4 12c0 3.35 2.04 6.23 5 7.46-.07-.6-.13-1.53.03-2.18.14-.6.95-4.02.95-4.02s-.24-.48-.24-1.2c0-1.12.65-1.96 1.46-1.96.69 0 1.02.52 1.02 1.14 0 .7-.44 1.74-.67 2.7-.19.8.4 1.46 1.18 1.46 1.42 0 2.37-1.82 2.37-3.97 0-1.64-1.1-2.87-3.1-2.87-2.26 0-3.67 1.69-3.67 3.58 0 .65.19 1.1.48 1.46.13.16.15.22.1.4l-.14.56c-.05.18-.2.25-.37.18-1.04-.43-1.52-1.58-1.52-2.88 0-2.14 1.8-4.72 5.38-4.72 2.88 0 4.79 2.08 4.79 4.32 0 2.97-1.65 5.18-4.08 5.18-.82 0-1.59-.44-1.85-.94l-.52 2c-.18.68-.52 1.37-.83 1.9.63.19 1.29.3 1.97.3 4.42 0 8-3.58 8-8s-3.58-8-8-8z" fill="white" />
    </svg>
  );
}

function SnapchatLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#FFFC00" />
      <path d="M12 4.5c2.12 0 3.96 1.4 4.32 3.6.04.22.05.45.05.68 0 .45-.04.86-.09 1.25.15.08.35.14.58.14.4 0 .72-.18.72-.18s-.12.56-.84.8c.2.12.52.2.9.22.08.01.14.08.13.16-.01.12-.1.3-.4.44-.1.05-.27.1-.48.16-.47.13-.82.54-.97.98-.05.13-.15.22-.28.22-.07 0-.15-.02-.24-.07a2.4 2.4 0 0 0-1.06-.26c-.36 0-.6.12-1.11.44-.47.29-.97.67-1.23.67s-.76-.38-1.23-.67c-.5-.32-.75-.44-1.11-.44-.38 0-.76.1-1.06.26-.09.05-.17.07-.24.07-.13 0-.23-.09-.28-.22-.15-.44-.5-.85-.97-.98-.2-.06-.38-.11-.48-.16-.3-.14-.39-.32-.4-.44a.14.14 0 0 1 .13-.16c.38-.02.7-.1.9-.22-.72-.24-.84-.8-.84-.8s.32.18.72.18c.23 0 .43-.06.58-.14-.05-.39-.09-.8-.09-1.25 0-.23.01-.46.05-.68C8.04 5.9 9.88 4.5 12 4.5z" fill="#101010" />
    </svg>
  );
}

const PLATFORMS = [
  { id: "youtube",   name: "YouTube",   Logo: YouTubeLogo },
  { id: "x",         name: "X",         Logo: XLogo },
  { id: "instagram", name: "Instagram", Logo: InstagramLogo },
  { id: "tiktok",    name: "TikTok",    Logo: TikTokLogo },
  { id: "facebook",  name: "Facebook",  Logo: FacebookLogo },
  { id: "linkedin",  name: "LinkedIn",  Logo: LinkedInLogo },
  { id: "threads",   name: "Threads",   Logo: ThreadsLogo },
  { id: "pinterest", name: "Pinterest", Logo: PinterestLogo },
  { id: "snapchat",  name: "Snapchat",  Logo: SnapchatLogo },
];

const GENRE_PHOTO_MAP: Record<string, string> = {
  Realistic:    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=85&fit=crop&crop=face",
  Cinematic:    "https://images.unsplash.com/photo-1675726205553-4e348f24da2c?w=800&q=85&fit=crop&crop=top",
  "3D":         "https://images.unsplash.com/photo-1741894785509-d87c84bdc275?w=800&q=85&fit=crop",
  Anime:        "https://images.unsplash.com/photo-1576843789623-ba1d22102973?w=800&q=85&fit=crop",
  Cartoon:      "https://images.unsplash.com/photo-1719198539292-e44add6d15c9?w=800&q=85&fit=crop",
  Illustration: "https://images.unsplash.com/photo-1667419136229-ce2c6e127a43?w=800&q=85&fit=crop",
  Comic:        "https://images.unsplash.com/photo-1632837287299-04fcf768d376?w=800&q=85&fit=crop",
  Clay:         "https://images.unsplash.com/photo-1657260630992-76a75351b0f4?w=800&q=85&fit=crop",
  Pixel:        "https://images.unsplash.com/photo-1780193724876-7ca5083d1004?w=800&q=85&fit=crop",
  Art:          "https://images.unsplash.com/photo-1509117947687-5090307f5ee7?w=800&q=85&fit=crop",
};

interface ReelFrame {
  dur: number;
  bg: string;
  platformId?: string;
  bgPhoto?: string;
  keyword?: string;
  isBlack?: boolean;
  isWhite?: boolean;
  isSpark?: boolean;
  isScatter?: boolean;
}

// Exact donor sequence with only the last hold screen modified from 7000ms -> 4000ms (4.0 seconds)
const REEL_SEQ: ReelFrame[] = [
  { dur: 80,   bg: "#000", isBlack: true },
  { dur: 180,  bg: "#cc0000",  platformId: "youtube",   keyword: "VIDEO" },
  { dur: 45,   bg: "#fff", isWhite: true },
  { dur: 190,  bg: "#6b21a8",  platformId: "instagram", bgPhoto: GENRE_PHOTO_MAP["Anime"] },
  { dur: 38,   bg: "#000", isBlack: true },
  { dur: 155,  bg: "#010101",  platformId: "tiktok",    bgPhoto: GENRE_PHOTO_MAP["3D"] },
  { dur: 38,   bg: "#fff", isWhite: true },
  { dur: 165,  bg: "#0a0a0a",  platformId: "x",         bgPhoto: GENRE_PHOTO_MAP["Comic"],        keyword: "CREATE" },
  { dur: 42,   bg: "#000", isBlack: true },
  { dur: 210,  bg: "#aa1500",  platformId: "youtube",   bgPhoto: GENRE_PHOTO_MAP["Realistic"] },
  { dur: 45,   bg: "#fff", isWhite: true },
  { dur: 185,  bg: "#2d1b69",  platformId: "instagram", bgPhoto: GENRE_PHOTO_MAP["Cinematic"] },
  { dur: 38,   bg: "#000", isBlack: true },
  { dur: 175,  bg: "#d45200",  platformId: "tiktok",    bgPhoto: GENRE_PHOTO_MAP["Cartoon"],      keyword: "PUBLISH" },
  { dur: 45,   bg: "#fff", isWhite: true },
  { dur: 245,  bg: "#0a1f4a",  platformId: "facebook",  bgPhoto: GENRE_PHOTO_MAP["Illustration"] },
  { dur: 58,   bg: "#000", isBlack: true },
  { dur: 275,  bg: "#e8d5c0",  platformId: "pinterest", bgPhoto: GENRE_PHOTO_MAP["Clay"] },
  { dur: 60,   bg: "#000", isBlack: true },
  { dur: 340,  bg: "#0a0614",  bgPhoto: GENRE_PHOTO_MAP["Pixel"],         keyword: "GROW" },
  { dur: 60,   bg: "#fff", isWhite: true },
  { dur: 420,  bg: "#1a2e0a",  platformId: "linkedin",  bgPhoto: GENRE_PHOTO_MAP["Art"],          keyword: "AUTOMATE" },
  { dur: 95,   bg: "#000", isBlack: true },
  { dur: 520,  bg: "#060606",  isScatter: true },
  { dur: 140,  bg: "#000", isBlack: true },
  { dur: 4000, bg: "#000",     isSpark: true }, // Exactly 4.0 seconds hold
];

const SCATTER_ITEMS = [
  { id: "youtube",   size: 82, x: "7%",  y: "11%", rot: -9 },
  { id: "x",         size: 66, x: "71%", y: "7%",  rot:  7 },
  { id: "instagram", size: 76, x: "39%", y: "19%", rot: -3 },
  { id: "tiktok",    size: 70, x: "11%", y: "44%", rot: 11 },
  { id: "facebook",  size: 62, x: "67%", y: "36%", rot: -6 },
  { id: "linkedin",  size: 66, x: "24%", y: "63%", rot:  8 },
  { id: "threads",   size: 72, x: "61%", y: "57%", rot: -5 },
  { id: "pinterest", size: 60, x: "14%", y: "79%", rot: -8 },
  { id: "snapchat",  size: 64, x: "54%", y: "76%", rot:  6 },
];

export interface SplashReelProps {
  onDone: () => void;
}

export function SplashReel({ onDone }: SplashReelProps) {
  const [idx, setIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const run = (i: number) => {
      if (i >= REEL_SEQ.length) {
        setExiting(true);
        t = setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }, 650);
        return;
      }
      setIdx(i);
      t = setTimeout(() => run(i + 1), REEL_SEQ[i].dur);
    };
    run(0);
    return () => clearTimeout(t);
  }, [onDone]);

  const frame = REEL_SEQ[idx];
  if (!frame) return null;

  const PlatLogo = frame.platformId ? PLATFORMS.find(p => p.id === frame.platformId)?.Logo : null;
  const hasPhoto = !!frame.bgPhoto && !frame.isBlack && !frame.isWhite;
  const logoLarge = PlatLogo && !hasPhoto && !frame.isScatter && !frame.isSpark && !frame.isBlack && !frame.isWhite;
  const logoOverPhoto = PlatLogo && hasPhoto;

  return (
    <>
      <style>{SPLASH_STYLES}</style>
      <div
        className="fixed inset-0 z-[300] overflow-hidden select-none"
        style={{
          background: frame.bg,
          opacity: exiting ? 0 : 1,
          transition: exiting ? "opacity 0.65s ease" : "none",
        }}
      >
        {/* Scan-lines — only on content frames */}
        {!frame.isBlack && !frame.isWhite && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 20,
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.14) 3px,rgba(0,0,0,0.14) 4px)",
              animation: "reel-scanline 0.12s linear infinite",
            }}
          />
        )}

        {/* Photo background */}
        {hasPhoto && (
          <div key={`ph-${idx}`} className="reel-frame-content absolute inset-0">
            <img
              src={frame.bgPhoto}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.75 }}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to bottom,${frame.bg}88,${frame.bg}cc)` }}
            />
          </div>
        )}

        {/* Large centered logo (no photo) */}
        {logoLarge && (
          <div
            key={`lL-${idx}`}
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "reel-logo-pop 320ms ease both" }}
          >
            <div style={{ filter: "drop-shadow(0 0 45px rgba(255,255,255,0.4))" }}>
              <PlatLogo size={168} />
            </div>
          </div>
        )}

        {/* Logo overlay on photo frame (corner) */}
        {logoOverPhoto && (
          <div
            key={`lP-${idx}`}
            className="absolute top-16 right-5"
            style={{ animation: "reel-logo-pop 260ms ease both" }}
          >
            <PlatLogo size={68} />
          </div>
        )}

        {/* Keyword */}
        {frame.keyword && !frame.isBlack && !frame.isWhite && (
          <div
            key={`kw-${idx}`}
            className="absolute bottom-28 inset-x-0 flex justify-center pointer-events-none"
            style={{ zIndex: 15 }}
          >
            <span
              style={{
                animation: "reel-keyword 350ms ease both",
                fontFamily: "monospace",
                fontWeight: 900,
                fontSize: 52,
                color: "rgba(255,255,255,0.88)",
                letterSpacing: "0.32em",
                textShadow:
                  "0 0 36px rgba(240,24,255,0.7), 0 0 80px rgba(168,85,247,0.4)",
              }}
            >
              {frame.keyword}
            </span>
          </div>
        )}

        {/* SCATTER — all platform logos */}
        {frame.isScatter && (
          <div key={`sc-${idx}`} className="absolute inset-0">
            {SCATTER_ITEMS.map((s, i) => {
              const SLogo = PLATFORMS.find(p => p.id === s.id)?.Logo;
              if (!SLogo) return null;
              return (
                <div
                  key={s.id}
                  className="absolute"
                  style={{
                    left: s.x,
                    top: s.y,
                    animation: `reel-scatter-in 350ms ease ${i * 42}ms both`,
                    transform: `rotate(${s.rot}deg)`,
                    filter: "drop-shadow(0 0 18px rgba(255,255,255,0.25))",
                  }}
                >
                  <SLogo size={s.size} />
                </div>
              );
            })}
            {/* Center Spark logo in the scatter */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: "reel-logo-pop 450ms 180ms ease both" }}
            >
              <MainLogoAnimated size={90} />
            </div>
          </div>
        )}

        {/* SPARK REVEAL */}
        {frame.isSpark && (
          <div
            key={`sp-${idx}`}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5"
          >
            <div style={{ animation: "reel-spark-reveal 1.1s ease both" }}>
              <MainLogoAnimated size={130} />
            </div>
            <div
              style={{
                animation: "reel-wordmark 500ms 650ms ease both",
                opacity: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 900,
                  fontSize: 38,
                  color: "white",
                  letterSpacing: "0.5em",
                  paddingLeft: "0.5em",
                  textShadow: "0 0 24px rgba(240,24,255,0.5)",
                }}
              >
                SPARK
              </span>
            </div>
          </div>
        )}

        {/* Vignette on content frames */}
        {!frame.isBlack && !frame.isWhite && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.55) 100%)",
              zIndex: 10,
            }}
          />
        )}
      </div>
    </>
  );
}
