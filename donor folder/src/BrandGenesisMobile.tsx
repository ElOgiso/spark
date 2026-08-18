import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, Play, Pause, Plus, X, Check,
  Volume2, Link2, RefreshCw, Upload, Mic, Shuffle,
  CheckCircle2, Send, AlertCircle, ZoomIn, ZoomOut,
  ChevronDown, ChevronUp, Zap, MessageSquare,
} from "lucide-react";
import mainLogo from "@/imports/MAIN_LOGO.png";
import chatLogo from "@/imports/CHAT_LOGO.png";

// ─── Logo components ───────────────────────────────────────────────────────────
// Animated main logo (entry frame hero)
function MainLogoAnimated({ size = 96 }: { size?: number }) {
  return (
    <div className="spark-mark-wrap" style={{ width: size, height: size, position: "relative", display: "inline-flex" }}>
      <div className="spark-bloom" style={{ width: size * 2.4, height: size * 2.4, left: -(size * 0.7), top: -(size * 0.7) }} />
      <div className="spark-p spark-p1" style={{ left: size * 0.22, top: size * 0.12 }} />
      <div className="spark-p spark-p2" style={{ right: size * 0.08, top: size * 0.2 }} />
      <div className="spark-p spark-p3" style={{ left: size * 0.08, bottom: size * 0.22 }} />
      <div className="spark-p spark-p4" style={{ right: size * 0.2, bottom: size * 0.1 }} />
      <img src={mainLogo} alt="Spark" className="spark-mark-svg"
        style={{ width: size, height: size, objectFit: "contain", position: "relative", zIndex: 2 }} />
    </div>
  );
}

// Static main logo (badges, small uses)
function MainLogo({ size = 24 }: { size?: number }) {
  return <img src={mainLogo} alt="Spark" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}

// Chat icon (white version, for ask field + reply bubbles)
function ChatLogo({ size = 20 }: { size?: number }) {
  return <img src={chatLogo} alt="Spark chat" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}

// ─── All styles ────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes spark-flicker {
    0%   { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    7%   { opacity:0.5; filter:brightness(2.4) drop-shadow(0 0 32px #FF88FF); }
    9%   { opacity:1; filter:brightness(2) drop-shadow(0 0 24px #F018FF); }
    12%  { opacity:0.75; filter:brightness(1.5) drop-shadow(0 0 16px #CC00CC); }
    15%  { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    60%  { opacity:1; filter:brightness(1) drop-shadow(0 0 12px #F018FF); }
    64%  { opacity:0.55; filter:brightness(2.2) drop-shadow(0 0 36px #FF88FF); }
    66%  { opacity:1; filter:brightness(2.6) drop-shadow(0 0 40px #FFAAFF); }
    69%  { opacity:0.8; filter:brightness(1.6) drop-shadow(0 0 22px #F018FF); }
    73%  { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
    100% { opacity:1; filter:brightness(1) drop-shadow(0 0 14px #F018FF); }
  }
  @keyframes spark-bloom-pulse {
    0%, 100% { opacity:0.2; transform:scale(1); }
    7%        { opacity:0.65; transform:scale(1.2); }
    15%       { opacity:0.2; transform:scale(1); }
    64%       { opacity:0.55; transform:scale(1.25); }
    73%       { opacity:0.2; transform:scale(1); }
  }
  @keyframes spark-p1 {
    0%,85%  { opacity:0; transform:translate(0,0) scale(0.4); }
    87%     { opacity:1; transform:translate(-9px,-13px) scale(1); }
    96%     { opacity:0; transform:translate(-20px,-27px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p2 {
    0%,60%  { opacity:0; transform:translate(0,0) scale(0.4); }
    62%     { opacity:1; transform:translate(11px,-11px) scale(1); }
    71%     { opacity:0; transform:translate(24px,-24px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p3 {
    0%,6%   { opacity:0; transform:translate(0,0) scale(0.4); }
    8%      { opacity:1; transform:translate(-13px,9px) scale(1); }
    17%     { opacity:0; transform:translate(-28px,20px) scale(0.2); }
    100%    { opacity:0; }
  }
  @keyframes spark-p4 {
    0%,63%  { opacity:0; transform:translate(0,0) scale(0.4); }
    65%     { opacity:1; transform:translate(9px,15px) scale(1); }
    75%     { opacity:0; transform:translate(20px,30px) scale(0.2); }
    100%    { opacity:0; }
  }
  .spark-mark-wrap { position:relative; display:inline-flex; align-items:center; justify-content:center; }
  .spark-bloom {
    position:absolute; border-radius:50%; pointer-events:none;
    background:radial-gradient(circle, rgba(240,24,255,0.35) 0%, rgba(168,85,247,0.12) 40%, transparent 70%);
    animation: spark-bloom-pulse 3.8s ease infinite;
  }
  .spark-mark-svg { animation: spark-flicker 3.8s ease infinite; }
  .spark-p {
    position:absolute; width:5px; height:5px; border-radius:50%;
    background:radial-gradient(circle,#FFAAFF,#F018FF); pointer-events:none; z-index:3;
  }
  .spark-p1 { animation: spark-p1 3.8s ease infinite; }
  .spark-p2 { animation: spark-p2 3.8s ease infinite; }
  .spark-p3 { animation: spark-p3 3.8s ease infinite; }
  .spark-p4 { animation: spark-p4 3.8s ease infinite; }

  @keyframes neon-border-flow {
    0%   { background-position:0% 50%; }
    50%  { background-position:100% 50%; }
    100% { background-position:0% 50%; }
  }
  @keyframes neon-glow-pulse {
    0%,100% { box-shadow:0 0 14px rgba(168,85,247,0.55),0 0 28px rgba(34,211,238,0.25),0 0 40px rgba(236,72,153,0.18); }
    50%      { box-shadow:0 0 24px rgba(168,85,247,0.9),0 0 48px rgba(34,211,238,0.45),0 0 64px rgba(236,72,153,0.32); }
  }
  .neon-ask-wrap {
    position:relative; padding:1.5px; border-radius:18px;
    background:linear-gradient(90deg,#a855f7,#22d3ee,#ec4899,#6366f1,#f59e0b,#a855f7);
    background-size:400% 400%;
    animation: neon-border-flow 2.6s ease infinite, neon-glow-pulse 2.6s ease infinite;
  }
  .neon-ask-inner {
    background:#080C14; border-radius:17px;
    display:flex; align-items:center; gap:10px; padding:12px 14px;
  }
  .neon-ask-inner input {
    flex:1; background:transparent; border:none; outline:none;
    font-size:13px; color:rgba(255,255,255,0.78);
  }
  .neon-ask-inner input::placeholder { color:rgba(255,255,255,0.28); }

  .neon-btn-wrap {
    padding:1.5px; border-radius:18px;
    background:linear-gradient(90deg,#a855f7,#22d3ee,#ec4899,#6366f1,#f59e0b,#a855f7);
    background-size:400% 400%;
    animation: neon-border-flow 2.6s ease infinite, neon-glow-pulse 2.6s ease infinite;
  }
  .neon-btn-inner {
    background:white; border-radius:17px; width:100%;
    padding:16px; font-size:15px; font-weight:800; color:#0B0F17;
    display:flex; align-items:center; justify-content:center; gap:8px;
    cursor:pointer; transition:background 0.15s;
  }
  .neon-btn-inner:active { background:#f0f0f0; }

  @keyframes genesis-in {
    from { opacity:0; transform:translateX(22px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes genesis-back {
    from { opacity:0; transform:translateX(-22px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes cursor-blink {
    0%,100% { opacity:1; }
    50%      { opacity:0; }
  }
  @keyframes orb-drift {
    0%,100% { transform:translate(0,0) scale(1); }
    33%      { transform:translate(12px,-8px) scale(1.04); }
    66%      { transform:translate(-8px,10px) scale(0.97); }
  }
  @keyframes chat-msg-in {
    from { opacity:0; transform:translateY(6px) scale(0.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes thinking-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.5; transform:scale(0.88); }
  }
  .chat-msg { animation: chat-msg-in 0.28s ease; }
  .no-bar { -ms-overflow-style:none; scrollbar-width:none; }
  .no-bar::-webkit-scrollbar { display:none; }

  /* ── Splash reel ── */
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
  @keyframes reel-scanline {
    from { background-position:0 0; }
    to   { background-position:0 4px; }
  }
  @keyframes reel-white-out {
    0%   { opacity:1; }
    100% { opacity:0; }
  }
  .reel-frame-content {
    animation: reel-zoom 600ms ease-out both;
  }
`;

// ─── Platform logos ────────────────────────────────────────────────────────────
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
  const id = useStableId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f9a825" /><stop offset="30%" stopColor="#f06292" />
          <stop offset="65%" stopColor="#ba68c8" /><stop offset="100%" stopColor="#5c6bc0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${id})`} />
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

// ─── ID helper ─────────────────────────────────────────────────────────────────
let _ctr = 0;
function useStableId() {
  const [id] = useState(() => `gi-${++_ctr}`);
  return id;
}

const PLATFORMS = [
  { id: "youtube",   name: "YouTube",   Logo: YouTubeLogo,   live: true },
  { id: "x",         name: "X",         Logo: XLogo,         live: true },
  { id: "instagram", name: "Instagram", Logo: InstagramLogo, live: false },
  { id: "tiktok",    name: "TikTok",    Logo: TikTokLogo,    live: false },
  { id: "facebook",  name: "Facebook",  Logo: FacebookLogo,  live: false },
  { id: "linkedin",  name: "LinkedIn",  Logo: LinkedInLogo,  live: false },
  { id: "threads",   name: "Threads",   Logo: ThreadsLogo,   live: false },
  { id: "pinterest", name: "Pinterest", Logo: PinterestLogo, live: false },
  { id: "snapchat",  name: "Snapchat",  Logo: SnapchatLogo,  live: false },
];

const PLATFORM_NICHE: Record<string, string> = {
  youtube: "Education", x: "Tech", instagram: "Lifestyle",
  tiktok: "Comedy", facebook: "Business", linkedin: "Business",
  threads: "Lifestyle", pinterest: "Fashion", snapchat: "Comedy",
};

const GENRES = [
  { id: "Realistic",    label: "Human / Realistic", desc: "Photoreal studio portrait",        img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=85&fit=crop&crop=face" },
  { id: "Cinematic",   label: "Cinematic",          desc: "Dramatic film-light portrait",     img: "https://images.unsplash.com/photo-1675726205553-4e348f24da2c?w=700&q=85&fit=crop&crop=top" },
  { id: "3D",          label: "3D",                 desc: "Stylized CGI character",           img: "https://images.unsplash.com/photo-1741894785509-d87c84bdc275?w=700&q=85&fit=crop" },
  { id: "Anime",       label: "Anime",              desc: "Vibrant anime key art",            img: "https://images.unsplash.com/photo-1576843789623-ba1d22102973?w=700&q=85&fit=crop" },
  { id: "Cartoon",     label: "Cartoon",            desc: "Bold illustrated character",       img: "https://images.unsplash.com/photo-1719198539292-e44add6d15c9?w=700&q=85&fit=crop" },
  { id: "Illustration",label: "Illustration",       desc: "Colorful editorial figure",        img: "https://images.unsplash.com/photo-1667419136229-ce2c6e127a43?w=700&q=85&fit=crop" },
  { id: "Comic",       label: "Comic",              desc: "Pop-art comic hero",               img: "https://images.unsplash.com/photo-1632837287299-04fcf768d376?w=700&q=85&fit=crop" },
  { id: "Clay",        label: "Clay / Stop-motion", desc: "Handcrafted clay figure",          img: "https://images.unsplash.com/photo-1657260630992-76a75351b0f4?w=700&q=85&fit=crop" },
  { id: "Pixel",       label: "Pixel",              desc: "Retro pixel-art character",        img: "https://images.unsplash.com/photo-1780193724876-7ca5083d1004?w=700&q=85&fit=crop" },
  { id: "Art",         label: "Art / Stylized",     desc: "Painterly fine-art portrait",      img: "https://images.unsplash.com/photo-1509117947687-5090307f5ee7?w=700&q=85&fit=crop" },
];

// ─── Hooks ─────────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 22, delay = 180) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed(""); setDone(false);
    const t = setTimeout(() => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv); setDone(true); }
      }, speed);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text]);
  return { displayed, done };
}

// ─── Story progress ────────────────────────────────────────────────────────────
function StoryProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: i < current ? "100%" : "0%", background: "linear-gradient(90deg,#a855f7,#F018FF)" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Director line ─────────────────────────────────────────────────────────────
function DirectorLine({ text, thinking = false }: { text: string; thinking?: boolean }) {
  const { displayed, done } = useTypewriter(text, 22, 180);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div style={{ animation: thinking ? "thinking-pulse 1s ease infinite" : undefined }}>
          <MainLogo size={18} />
        </div>
        <span className="text-[9px] text-white/28 uppercase tracking-[0.2em] font-semibold">Super Spark</span>
      </div>
      <p className="text-[17px] font-semibold text-white leading-snug tracking-tight min-h-[3em]">
        {displayed}
        {!done && <span className="inline-block w-[2px] h-[1.1em] bg-[#F018FF] ml-[2px] align-[-0.1em]" style={{ animation: "cursor-blink 0.9s step-end infinite" }} />}
      </p>
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onToggle, suggested }: { label: string; selected: boolean; onToggle: () => void; suggested?: boolean }) {
  return (
    <button onClick={onToggle}
      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-150 border relative ${
        selected ? "bg-purple-600/35 border-purple-400/70 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
          : "bg-white/5 border-white/10 text-white/55 hover:border-white/25"
      }`}>
      {label}
      {suggested && !selected && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F018FF] border border-[#0B0F17]" />}
    </button>
  );
}

// ─── Mode card ────────────────────────────────────────────────────────────────
function ModeCard({ label, desc, selected, onSelect }: { label: string; desc: string; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition-all duration-150 ${
        selected ? "bg-purple-600/20 border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.2)]" : "bg-white/4 border-white/10"
      }`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${selected ? "text-purple-100" : "text-white/80"}`}>{label}</span>
        {selected && <Check className="w-4 h-4 text-purple-400" />}
      </div>
      <p className="text-xs text-white/38 mt-1 leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── Persistent chat panel ─────────────────────────────────────────────────────
interface ChatMessage { id: number; role: "user" | "spark"; text: string; }

const SPARK_REPLIES: Record<number, string[]> = {
  1: ["Connect any account that's live — YouTube and X are ready now. The rest are coming soon.", "Once connected, I'll pull your handle and start building your identity layer."],
  2: ["Your brand name sets the tone for everything. Make it memorable.", "I'll auto-detect your niche from your connected account — you can always override it."],
  3: ["The character is your brand's face across every video. Pick a style you want to own forever.", "After generating, tap the sheet to zoom in and check the details."],
  4: ["Voice is identity. Choose the one that feels most like your brand.", "You can describe a custom voice in the field and I'll build it."],
  5: ["Paste any channel you want me to learn from. I'll extract what makes them work.", "Research sources are private — I use them to calibrate, not to copy."],
  6: ["Production mode sets how your content looks. Automation sets how much I do solo.", "You can change these any time from your dashboard."],
  7: ["Everything looks good. When you're ready, enter the dashboard.", "You can always come back and update any of these settings."],
};
const DEFAULT_REPLIES = ["Got it — I'll factor that in.", "Noted. Moving forward with that.", "Good call. I'll apply that across your brand setup."];

function getSparkReply(frame: number, msgIndex: number): string {
  const pool = SPARK_REPLIES[frame] || DEFAULT_REPLIES;
  return pool[msgIndex % pool.length];
}

interface ChatPanelProps {
  history: ChatMessage[];
  thinking: boolean;
  expanded: boolean;
  onToggle: () => void;
}
function ChatPanel({ history, thinking, expanded, onToggle }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, thinking, expanded]);

  if (history.length === 0 && !thinking) return null;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(8,12,20,0.92)" }}>
      {/* Header bar */}
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/4 transition-colors">
        <div className="flex items-center gap-2">
          <ChatLogo size={14} />
          <span className="text-[11px] text-white/45 font-medium">
            Super Spark · {history.length} message{history.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-white/35" /> : <ChevronUp className="w-3.5 h-3.5 text-white/35" />}
      </button>

      {/* Messages */}
      {expanded && (
        <div ref={scrollRef} className="no-bar px-4 pb-3 space-y-2.5 overflow-y-auto" style={{ maxHeight: 180 }}>
          {history.map(msg => (
            <div key={msg.id} className={`chat-msg flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "spark" && <ChatLogo size={16} />}
              <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-purple-600/30 border border-purple-500/30 text-white/90 rounded-br-sm"
                  : "bg-white/7 border border-white/10 text-white/72 rounded-tl-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="chat-msg flex items-center gap-2">
              <ChatLogo size={16} />
              <div className="bg-white/7 border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#F018FF]/60"
                    style={{ animation: `thinking-pulse 0.9s ease ${i * 0.18}s infinite` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ask field ─────────────────────────────────────────────────────────────────
function NeonAskField({ value, onChange, onSend, disabled }: {
  value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean;
}) {
  return (
    <div className="neon-ask-wrap">
      <div className="neon-ask-inner">
        <ChatLogo size={18} />
        <input value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !disabled && value.trim() && onSend()}
          placeholder="Ask Super Spark or type a custom answer…"
          disabled={disabled} />
        {value.trim() && !disabled && (
          <button onClick={onSend}>
            <Send className="w-3.5 h-3.5" style={{ color: "rgba(240,24,255,0.85)" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Genre carousel ────────────────────────────────────────────────────────────
function GenreCarousel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const scrollTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[idx] as HTMLElement;
    if (card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: "smooth" });
    setActiveIdx(idx);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i] as HTMLElement;
        const cc = el.children[closest] as HTMLElement;
        if (Math.abs(c.offsetLeft + c.clientWidth / 2 - center) < Math.abs(cc.offsetLeft + cc.clientWidth / 2 - center))
          closest = i;
      }
      setActiveIdx(closest);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-bar py-2"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {GENRES.map((g, i) => (
          <button key={g.id} onClick={() => { onSelect(g.id); scrollTo(i); }}
            className="flex-shrink-0 rounded-2xl overflow-hidden relative border-2 transition-all duration-200"
            style={{
              width: "72vw", maxWidth: 280, height: 300, scrollSnapAlign: "center",
              borderColor: selected === g.id ? "#F018FF" : "transparent",
              boxShadow: selected === g.id ? "0 0 24px rgba(240,24,255,0.5)" : "0 0 0 1px rgba(255,255,255,0.08)",
            }}>
            <img src={g.img} alt={g.label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.18) 55%,transparent 100%)",
            }} />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-base font-bold text-white">{g.label}</p>
              <p className="text-xs text-white/50 mt-0.5">{g.desc}</p>
            </div>
            {selected === g.id && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#F018FF" }}>
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {GENRES.map((_, i) => (
          <button key={i} onClick={() => scrollTo(i)} className="rounded-full transition-all duration-200"
            style={{ width: i === activeIdx ? 16 : 6, height: 6, background: i === activeIdx ? "#F018FF" : "rgba(255,255,255,0.2)" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Image viewer ─────────────────────────────────────────────────────────────
function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [lastDist, setLastDist] = useState<number | null>(null);
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      <button onClick={onClose}
        className="absolute right-4 w-9 h-9 rounded-full bg-white/12 flex items-center justify-center z-10"
        style={{ top: "max(16px,env(safe-area-inset-top,16px))" }}>
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="absolute left-4 flex flex-col gap-2 z-10" style={{ bottom: "max(96px,calc(env(safe-area-inset-bottom,0px)+80px))" }}>
        <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center"><ZoomIn className="w-4 h-4 text-white" /></button>
        <button onClick={() => setScale(s => Math.max(1, s - 0.5))} className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center"><ZoomOut className="w-4 h-4 text-white" /></button>
      </div>
      <div className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "pinch-zoom" }}
        onTouchStart={e => { if (e.touches.length === 2) setLastDist(dist(e.touches)); }}
        onTouchMove={e => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const d = dist(e.touches);
            if (lastDist !== null) setScale(s => Math.max(1, Math.min(5, s * (d / lastDist))));
            setLastDist(d);
          }
        }}
        onTouchEnd={() => setLastDist(null)}
        onWheel={e => { e.preventDefault(); setScale(s => Math.max(1, Math.min(5, s - e.deltaY * 0.003))); }}
        onDoubleClick={() => setScale(s => s > 1 ? 1 : 2.5)}>
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain select-none"
          style={{ transform: `scale(${scale})`, transition: lastDist ? "none" : "transform 0.2s ease" }}
          draggable={false} />
      </div>
      <p className="absolute text-[10px] text-white/25" style={{ bottom: "max(24px,calc(env(safe-area-inset-bottom,0px)+8px))" }}>
        Pinch or scroll to zoom · Double-tap to toggle
      </p>
    </div>
  );
}

// ─── Ambient orbs ─────────────────────────────────────────────────────────────
function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full opacity-[0.12]"
        style={{ width: 360, height: 360, background: "radial-gradient(circle,#F018FF,#a855f7,transparent 70%)", top: -80, left: -80, animation: "orb-drift 9s ease-in-out infinite" }} />
      <div className="absolute rounded-full opacity-[0.08]"
        style={{ width: 300, height: 300, background: "radial-gradient(circle,#22d3ee,transparent 70%)", bottom: 40, right: -60, animation: "orb-drift 12s ease-in-out infinite reverse" }} />
    </div>
  );
}

// ─── Genesis data ──────────────────────────────────────────────────────────────
interface GenesisData {
  connectedPlatforms: string[]; connectedHandles: Record<string, string>;
  brandName: string; niche: string; goal: string;
  characterGenre: string; characterSkin: string; characterHair: string;
  characterPersonality: string; characterGenerated: boolean;
  selectedVoice: string; researchSources: string[];
  productionMode: string; automationMode: string;
}
const DEFAULT_DATA: GenesisData = {
  connectedPlatforms: [], connectedHandles: {}, brandName: "", niche: "", goal: "",
  characterGenre: "", characterSkin: "", characterHair: "", characterPersonality: "",
  characterGenerated: false, selectedVoice: "", researchSources: [],
  productionMode: "Hybrid", automationMode: "Balanced",
};

const DIRECTORS: Record<number, string> = {
  1: "Connect the social accounts you want SPARK to manage. I'll use them for identity, publishing, and distribution.",
  2: "What should we call this brand — and what niche does SPARK own?",
  3: "Who is the host on camera? Lock a character SPARK can keep consistent forever.",
  4: "Choose the narrator voice for your content. This is your brand voice — not my chat voice.",
  5: "Paste channels or profiles SPARK should learn from. I'll start analysing as soon as you add them.",
  6: "How should SPARK produce — and how much should I decide without you?",
  7: "Your SPARK is ready. Enter when you are.",
};

// ─── Frame components ─────────────────────────────────────────────────────────
function FrameEntry({ onBegin }: { onBegin: () => void }) {
  const { displayed, done } = useTypewriter(
    "Welcome. I'm Super Spark, your executive creative director.\nLet's build the brand SPARK will run.", 24, 400
  );
  return (
    <div className="flex flex-col items-center justify-between h-full px-8 py-8 text-center overflow-hidden">
      <div />
      <div className="flex flex-col items-center gap-8">
        <MainLogoAnimated size={96} />
        <div className="space-y-3 max-w-xs">
          <p className="text-[9px] tracking-[0.25em] uppercase text-white/22 font-semibold">Super Spark</p>
          <p className="text-lg font-semibold text-white leading-snug whitespace-pre-line">
            {displayed}
            {!done && <span className="inline-block w-[2px] h-[1em] bg-[#F018FF] ml-[2px] align-[-0.05em]" style={{ animation: "cursor-blink 0.9s step-end infinite" }} />}
          </p>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={onBegin}
          className="w-full py-4 rounded-2xl bg-purple-600 text-white text-base font-semibold tracking-wide hover:bg-purple-500 active:scale-[0.98] transition-all shadow-[0_0_32px_rgba(168,85,247,0.4)]">
          Begin
        </button>
        <p className="text-xs text-white/22 leading-relaxed">
          Don't know what to do? Feel free to ask me. I'm Super Spark.
        </p>
      </div>
    </div>
  );
}

function FrameConnect({ data, onChange }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void }) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const connect = (id: string) => {
    if (data.connectedPlatforms.includes(id)) {
      const next = data.connectedPlatforms.filter(p => p !== id);
      const handles = { ...data.connectedHandles };
      delete handles[id];
      onChange({ connectedPlatforms: next, connectedHandles: handles });
      return;
    }
    setConnecting(id);
    setTimeout(() => {
      setConnecting(null);
      onChange({ connectedPlatforms: [...data.connectedPlatforms, id], connectedHandles: { ...data.connectedHandles, [id]: `@creator_${id}` } });
    }, 1600);
  };
  return (
    <div className="space-y-2.5">
      {PLATFORMS.map(({ id, name, Logo, live }) => {
        const connected = data.connectedPlatforms.includes(id);
        const isConnecting = connecting === id;
        return (
          <button key={id} onClick={() => live && connect(id)} disabled={!live || (!!connecting && connecting !== id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
              !live ? "bg-white/2 border-white/6 opacity-50 cursor-default"
                : connected ? "bg-purple-600/18 border-purple-500/50"
                : isConnecting ? "bg-white/6 border-white/18 animate-pulse"
                : "bg-white/4 border-white/10 hover:border-white/22"
            }`}>
            <div className="flex items-center gap-3.5">
              <Logo size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${connected ? "text-purple-100" : "text-white/82"}`}>{name}</p>
                  {!live && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/32 border border-white/10">Soon</span>}
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {connected ? `Connected · ${data.connectedHandles[id]}` : isConnecting ? "Connecting…" : live ? "Tap to connect" : "Available soon"}
                </p>
              </div>
              {connected && <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />}
              {isConnecting && <RefreshCw className="w-4 h-4 text-white/30 animate-spin flex-shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FrameBrand({ data, onChange, justEntered }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void; justEntered: boolean }) {
  const [detecting, setDetecting] = useState(false);
  const [detectedNiche, setDetectedNiche] = useState("");
  useEffect(() => {
    if (!justEntered) return;
    const first = data.connectedPlatforms[0];
    if (!first) return;
    if (!data.brandName && data.connectedHandles[first]) {
      const raw = data.connectedHandles[first].replace("@", "").replace("creator_", "");
      onChange({ brandName: raw.charAt(0).toUpperCase() + raw.slice(1) + " Studio" });
    }
    if (!data.niche) {
      setDetecting(true);
      setTimeout(() => {
        const suggested = PLATFORM_NICHE[first] || "Education";
        setDetectedNiche(suggested);
        onChange({ niche: suggested });
        setDetecting(false);
      }, 1200);
    }
  }, [justEntered]);

  const niches = ["AI", "Business", "Finance", "Fitness", "Fashion", "Beauty", "Comedy", "Education", "Tech", "Crypto", "Lifestyle", "Food", "Gaming", "Motivation", "News", "Travel", "Health", "Music", "Sports", "Other"];
  const goals = ["Growth", "Authority", "Sales", "Community"];
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Brand name</label>
        <input value={data.brandName} onChange={e => onChange({ brandName: e.target.value })}
          placeholder="Your channel or brand name"
          className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/22 outline-none focus:border-purple-500/55 transition-colors" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Niche</label>
          {detecting && <span className="text-[9px] text-[#F018FF] flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> AI detecting…</span>}
          {detectedNiche && !detecting && <span className="text-[9px] text-[#F018FF]">· AI suggested</span>}
        </div>
        {detectedNiche && <p className="text-[11px] text-white/28 -mt-1">Tap a different niche to override</p>}
        <div className="flex flex-wrap gap-2">
          {niches.map(n => <Chip key={n} label={n} selected={data.niche === n} suggested={n === detectedNiche && data.niche !== n} onToggle={() => onChange({ niche: data.niche === n ? "" : n })} />)}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Goal <span className="normal-case text-white/22">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {goals.map(g => <Chip key={g} label={g} selected={data.goal === g} onToggle={() => onChange({ goal: data.goal === g ? "" : g })} />)}
        </div>
      </div>
    </div>
  );
}

function FrameCharacter({ data, onChange }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void }) {
  const [generating, setGenerating] = useState(false);
  const [viewer, setViewer] = useState(false);
  const skins = ["Light", "Medium", "Tan", "Brown", "Dark"];
  const hairs = ["Black", "Brown", "Blonde", "Red", "Grey", "White"];
  const personalities = ["Bold", "Calm", "Energetic", "Intellectual", "Warm", "Authoritative"];
  const genreImg = GENRES.find(g => g.id === data.characterGenre)?.img || "";
  const generate = () => { if (!data.characterGenre) return; setGenerating(true); setTimeout(() => { setGenerating(false); onChange({ characterGenerated: true }); }, 2200); };
  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Genre — swipe to browse, tap to select</label>
          <GenreCarousel selected={data.characterGenre} onSelect={g => onChange({ characterGenre: g })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {([["Skin tone", "characterSkin", skins], ["Hair", "characterHair", hairs]] as [string, keyof GenesisData, string[]][]).map(([label, key, opts]) => (
            <div key={key} className="space-y-2">
              <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">{label}</label>
              <div className="flex flex-wrap gap-1.5">{opts.map(o => <Chip key={o} label={o} selected={data[key] === o} onToggle={() => onChange({ [key]: data[key] === o ? "" : o })} />)}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Personality</label>
          <div className="flex flex-wrap gap-2">{personalities.map(p => <Chip key={p} label={p} selected={data.characterPersonality === p} onToggle={() => onChange({ characterPersonality: data.characterPersonality === p ? "" : p })} />)}</div>
        </div>
        {!data.characterGenerated ? (
          <button onClick={generate} disabled={generating || !data.characterGenre}
            className="w-full py-3.5 rounded-xl border border-purple-500/40 text-purple-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-purple-600/15 disabled:opacity-35 disabled:cursor-not-allowed transition-all">
            {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating character sheet…</> : <><Shuffle className="w-4 h-4" /> Generate character sheet</>}
          </button>
        ) : (
          <button onClick={() => setViewer(true)} className="w-full rounded-2xl border border-purple-500/35 bg-purple-600/10 overflow-hidden active:scale-[0.98] transition-transform">
            <div className="relative h-40 overflow-hidden">
              <img src={genreImg} alt={data.characterGenre} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-sm text-white font-semibold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-2">
                  <ZoomIn className="w-4 h-4" /> View character sheet
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-purple-300 font-semibold">Generated · {data.characterGenre}</span>
              <button onClick={e => { e.stopPropagation(); generate(); }} className="text-[10px] text-white/35 flex items-center gap-1 hover:text-white/60">
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
          </button>
        )}
      </div>
      {viewer && genreImg && <ImageViewer src={genreImg} alt={data.characterGenre} onClose={() => setViewer(false)} />}
    </>
  );
}

function FrameVoice({ data, onChange }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const voices = [
    { id: "nova",  name: "Nova",  tag: "F", desc: "Confident, energetic — built for short-form",  col: "text-fuchsia-300" },
    { id: "echo",  name: "Echo",  tag: "M", desc: "Calm, authoritative — long-form clarity",       col: "text-indigo-300" },
    { id: "sage",  name: "Sage",  tag: "F", desc: "Warm, conversational — storytelling tone",      col: "text-purple-300" },
    { id: "atlas", name: "Atlas", tag: "M", desc: "Deep, dramatic — cinematic narration",           col: "text-blue-300" },
    { id: "drift", name: "Drift", tag: "M", desc: "Smooth, youthful — trend-native delivery",      col: "text-cyan-300" },
    { id: "zara",  name: "Zara",  tag: "F", desc: "Crisp, professional — B2B authority",           col: "text-rose-300" },
  ];
  const toggle = (id: string) => { setPlaying(p => p === id ? null : id); if (playing !== id) setTimeout(() => setPlaying(null), 2800); };
  return (
    <div className="space-y-2.5">
      {voices.map(v => (
        <div key={v.id} className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-all ${data.selectedVoice === v.id ? "bg-purple-600/20 border-purple-500/55" : "bg-white/4 border-white/10"}`}>
          <div className={`w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-xs font-bold ${v.col}`}>{v.tag}</div>
          <div className="flex items-center gap-[2px] flex-shrink-0 h-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`w-[2px] rounded-full ${data.selectedVoice === v.id ? "bg-purple-400" : "bg-white/20"}`} style={{ height: `${4 + (i % 4) * 2.5}px` }} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${data.selectedVoice === v.id ? "text-purple-100" : "text-white/80"}`}>{v.name}</p>
            <p className="text-[11px] text-white/32 truncate">{v.desc}</p>
          </div>
          <button onClick={() => toggle(v.id)} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center flex-shrink-0">
            {playing === v.id ? <Pause className="w-3.5 h-3.5 text-white/70" /> : <Play className="w-3.5 h-3.5 text-white/50" />}
          </button>
          <button onClick={() => onChange({ selectedVoice: v.id })}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${data.selectedVoice === v.id ? "bg-purple-500" : "bg-white/6 text-white/28 hover:bg-white/12"}`}>
            {data.selectedVoice === v.id ? <Check className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white/40" />}
          </button>
        </div>
      ))}
      <div className="rounded-2xl border border-dashed border-white/12 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center flex-shrink-0"><Mic className="w-4 h-4 text-white/28" /></div>
        <div><p className="text-xs text-white/38 font-medium">Design a custom voice</p><p className="text-[10px] text-white/20 mt-0.5">Describe it in the ask field below</p></div>
      </div>
    </div>
  );
}

function FrameSources({ data, onChange }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void }) {
  const [input, setInput] = useState("");
  const [statuses, setStatuses] = useState<Record<string, "syncing" | "ready">>({});
  const add = () => {
    const url = input.trim();
    if (!url || data.researchSources.includes(url)) return;
    onChange({ researchSources: [...data.researchSources, url] });
    setInput("");
    setStatuses(s => ({ ...s, [url]: "syncing" }));
    setTimeout(() => setStatuses(s => ({ ...s, [url]: "ready" })), 2000);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white/6 border border-white/12 rounded-xl px-3 py-3 focus-within:border-purple-500/50">
          <Link2 className="w-4 h-4 text-white/25 flex-shrink-0" />
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Paste a channel or video URL…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none" />
        </div>
        <button onClick={add} disabled={!input.trim()}
          className="w-11 h-11 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center disabled:opacity-30 flex-shrink-0">
          <Plus className="w-4 h-4 text-purple-300" />
        </button>
      </div>
      {data.researchSources.length === 0
        ? <div className="rounded-xl border border-dashed border-white/10 py-8 text-center"><p className="text-xs text-white/25">Add channels SPARK should learn from</p></div>
        : <div className="space-y-2">{data.researchSources.map(url => (
            <div key={url} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${statuses[url] === "ready" ? "bg-green-600/8 border-green-500/20" : "bg-white/4 border-white/10"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 truncate">{url}</p>
                <p className={`text-[10px] mt-0.5 ${statuses[url] === "ready" ? "text-green-400" : "text-white/25"}`}>{statuses[url] === "ready" ? "Ready" : "Syncing…"}</p>
              </div>
              {statuses[url] === "ready" ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 text-white/25 animate-spin flex-shrink-0" />}
              <button onClick={() => onChange({ researchSources: data.researchSources.filter(s => s !== url) })} className="w-6 h-6 rounded-full bg-white/6 flex items-center justify-center flex-shrink-0"><X className="w-3 h-3 text-white/38" /></button>
            </div>
          ))}</div>
      }
    </div>
  );
}

function FrameModes({ data, onChange }: { data: GenesisData; onChange: (d: Partial<GenesisData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Production</label>
        <div className="space-y-2">
          {[{ id: "Narrator", desc: "Voice + visuals — lean AI-narrated productions" }, { id: "Hybrid", desc: "Strong motion + host — mix of your footage and AI" }, { id: "Cinematic", desc: "Full storyboard and filmic depth — no camera required" }].map(m =>
            <ModeCard key={m.id} label={m.id} desc={m.desc} selected={data.productionMode === m.id} onSelect={() => onChange({ productionMode: m.id })} />)}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Automation</label>
        <div className="space-y-2">
          {[{ id: "Manual", desc: "You approve every action before SPARK proceeds" }, { id: "Balanced", desc: "SPARK drafts and publishes; you gate strategy decisions" }, { id: "Autonomous", desc: "SPARK runs within your brand rules — full delegation" }].map(m =>
            <ModeCard key={m.id} label={m.id} desc={m.desc} selected={data.automationMode === m.id} onSelect={() => onChange({ automationMode: m.id })} />)}
        </div>
      </div>
    </div>
  );
}

function FrameReady({ data }: { data: GenesisData }) {
  const connected = PLATFORMS.filter(p => data.connectedPlatforms.includes(p.id));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
      {[
        { label: "Brand",      value: data.brandName || "—" },
        { label: "Niche",      value: data.niche || "—" },
        { label: "Goal",       value: data.goal || "—" },
        { label: "Character",  value: data.characterGenerated ? `${data.characterGenre} · ${data.characterPersonality}` : data.characterGenre || "—" },
        { label: "Voice",      value: data.selectedVoice || "—" },
        { label: "Sources",    value: data.researchSources.length > 0 ? `${data.researchSources.length} channel${data.researchSources.length !== 1 ? "s" : ""}` : "None" },
        { label: "Production", value: data.productionMode },
        { label: "Automation", value: data.automationMode },
      ].map((row, i, arr) => (
        <div key={row.label} className={`flex items-center justify-between px-5 py-3.5 ${i < arr.length - 1 ? "border-b border-white/6" : ""}`}>
          <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">{row.label}</span>
          <span className={`text-sm font-medium ${row.value === "—" || row.value === "None" ? "text-white/22" : "text-white/82"}`}>{row.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/6">
        <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">Accounts</span>
        {connected.length > 0
          ? <div className="flex gap-1.5">{connected.map(({ id, Logo }) => <Logo key={id} size={20} />)}</div>
          : <span className="text-sm font-medium text-white/22">Not connected</span>}
      </div>
    </div>
  );
}

// ─── Legal flow ────────────────────────────────────────────────────────────────
const LEGAL_SCREENS = [
  { title: "Terms & Conditions", agree: "I Agree to the Terms & Conditions",
    body: `By using SPARK, you agree to these Terms in full. SPARK is an AI-powered creative operations platform. You grant SPARK the right to access, store, and process all content, media, and account data you connect or upload for the purpose of generating, scheduling, and distributing content on your behalf.\n\nYou confirm that all connected accounts belong to you or you have authority to connect them. You are responsible for any content published through SPARK. SPARK may suspend or terminate access for policy violations.\n\nThese Terms are governed by the laws applicable to your jurisdiction. Continued use constitutes acceptance of any updated Terms.` },
  { title: "Privacy & Data Policy", agree: "I Agree to the Privacy Policy",
    body: `SPARK collects data including account credentials, content metadata, analytics, audience data, uploaded media, and usage behaviour. This data is stored securely and used to operate, improve, and personalise the SPARK platform for you.\n\nSPARK may share aggregate or anonymised data with partners for platform research and improvement. SPARK does not sell your personally identifiable information to third parties.\n\nYou may request deletion of your data at any time by contacting SPARK support. By continuing, you consent to the collection and processing of your data as described.` },
  { title: "SPARK Usage Rights", agree: "I Understand and Agree",
    body: `YOU GRANT SPARK UNLIMITED, IRREVOCABLE, WORLDWIDE RIGHTS OVER ALL CONTENT, DATA, AND MEDIA CREATED, PROCESSED, OR PUBLISHED THROUGH THE PLATFORM.\n\nSPARK has the right to analyse, use, reproduce, distribute, and train AI models on any content, interaction, or output generated within the platform — with no time limit and no geographic restriction.\n\nSPARK may use your content, likeness (in AI-generated form), and brand assets to improve its systems, demonstrate platform capabilities, and build features for other users, in accordance with applicable law.\n\nThis grants SPARK full creative and operational authority over your connected accounts and content pipeline. You retain ownership of original content but license it to SPARK royalty-free for platform purposes.` },
];

function LegalFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const screen = LEGAL_SCREENS[step];
  const handleAgree = () => {
    if (step < LEGAL_SCREENS.length - 1) { setStep(s => s + 1); scrollRef.current?.scrollTo({ top: 0 }); }
    else onComplete();
  };
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#0B0F17", paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      <AmbientOrbs />
      <div className="relative z-10 flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <MainLogo size={22} />
          <div className="flex gap-1.5">{LEGAL_SCREENS.map((_, i) => <div key={i} className="h-[2.5px] w-8 rounded-full transition-all duration-300" style={{ background: i <= step ? "#F018FF" : "rgba(255,255,255,0.1)" }} />)}</div>
          <span className="text-[10px] text-white/28 ml-auto">{step + 1} of {LEGAL_SCREENS.length}</span>
        </div>
        <h2 className="text-xl font-bold text-white">{screen.title}</h2>
        <p className="text-[10px] text-white/28 mt-1 uppercase tracking-widest">Please read carefully</p>
      </div>
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto no-bar px-5 py-2">
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{screen.body}</p>
        </div>
        {step === 2 && <div className="mt-4 rounded-2xl border border-orange-500/25 bg-orange-500/8 px-5 py-4"><p className="text-xs text-orange-300/80 font-semibold leading-relaxed">⚠ This agreement grants SPARK broad rights over your data and content. By agreeing you confirm you have read and understood these terms.</p></div>}
        <div className="h-6" />
      </div>
      <div className="relative z-10 flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={handleAgree} className="w-full py-4 rounded-2xl bg-purple-600 text-white text-sm font-bold tracking-wide hover:bg-purple-500 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(168,85,247,0.35)]">
          {screen.agree}
        </button>
        <p className="text-[10px] text-white/18 text-center mt-2">Declining will exit the setup process.</p>
      </div>
    </div>
  );
}

// ─── Splash reel data ─────────────────────────────────────────────────────────
interface ReelFrame {
  dur: number; bg: string;
  platformId?: string; bgPhoto?: string;
  keyword?: string; isBlack?: boolean; isWhite?: boolean;
  isSpark?: boolean; isScatter?: boolean;
}

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

// fast → medium → slow → reveal pacing
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
  { dur: 7000, bg: "#000",     isSpark: true },
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

// ─── Splash reel component ─────────────────────────────────────────────────────
function SplashReel({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const run = (i: number) => {
      if (i >= REEL_SEQ.length) {
        setExiting(true);
        t = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, 650);
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
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{
        background: frame.bg,
        opacity: exiting ? 0 : 1,
        transition: exiting ? "opacity 0.65s ease" : "none",
      }}
    >
      {/* Scan-lines — only on content frames */}
      {!frame.isBlack && !frame.isWhite && (
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 20,
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.14) 3px,rgba(0,0,0,0.14) 4px)",
          animation: "reel-scanline 0.12s linear infinite",
        }} />
      )}

      {/* Photo background */}
      {hasPhoto && (
        <div key={`ph-${idx}`} className="reel-frame-content absolute inset-0">
          <img src={frame.bgPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.75 }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom,${frame.bg}88,${frame.bg}cc)` }} />
        </div>
      )}

      {/* Large centered logo (no photo) */}
      {logoLarge && (
        <div key={`lL-${idx}`} className="absolute inset-0 flex items-center justify-center" style={{ animation: "reel-logo-pop 320ms ease both" }}>
          <div style={{ filter: "drop-shadow(0 0 45px rgba(255,255,255,0.4))" }}>
            <PlatLogo size={168} />
          </div>
        </div>
      )}

      {/* Logo overlay on photo frame (corner) */}
      {logoOverPhoto && (
        <div key={`lP-${idx}`} className="absolute top-16 right-5" style={{ animation: "reel-logo-pop 260ms ease both" }}>
          <PlatLogo size={68} />
        </div>
      )}

      {/* Keyword */}
      {frame.keyword && !frame.isBlack && !frame.isWhite && (
        <div key={`kw-${idx}`} className="absolute bottom-28 inset-x-0 flex justify-center pointer-events-none" style={{ zIndex: 15 }}>
          <span style={{
            animation: "reel-keyword 350ms ease both",
            fontFamily: "monospace", fontWeight: 900, fontSize: 52,
            color: "rgba(255,255,255,0.88)", letterSpacing: "0.32em",
            textShadow: "0 0 36px rgba(240,24,255,0.7), 0 0 80px rgba(168,85,247,0.4)",
          }}>
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
              <div key={s.id} className="absolute"
                style={{
                  left: s.x, top: s.y,
                  animation: `reel-scatter-in 350ms ease ${i * 42}ms both`,
                  transform: `rotate(${s.rot}deg)`,
                  filter: "drop-shadow(0 0 18px rgba(255,255,255,0.25))",
                }}>
                <SLogo size={s.size} />
              </div>
            );
          })}
          {/* Center Spark logo in the scatter */}
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "reel-logo-pop 450ms 180ms ease both" }}>
            <img src={mainLogo} alt="Spark" style={{ width: 90, height: 90, objectFit: "contain", filter: "drop-shadow(0 0 32px #F018FF)" }} />
          </div>
        </div>
      )}

      {/* SPARK REVEAL */}
      {frame.isSpark && (
        <div key={`sp-${idx}`} className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <img
            src={mainLogo} alt="Spark"
            style={{
              width: 148, height: 148, objectFit: "contain",
              animation: "reel-spark-reveal 1.1s ease both",
            }}
          />
          <div style={{ animation: "reel-wordmark 500ms 650ms ease both", opacity: 0 }}>
            <span style={{
              fontFamily: "monospace", fontWeight: 900, fontSize: 38,
              color: "white", letterSpacing: "0.5em", paddingLeft: "0.5em",
              textShadow: "0 0 24px rgba(240,24,255,0.5)",
            }}>
              SPARK
            </span>
          </div>
        </div>
      )}

      {/* Vignette on content frames */}
      {!frame.isBlack && !frame.isWhite && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.55) 100%)",
          zIndex: 10,
        }} />
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
let _msgId = 0;

export function BrandGenesisMobile({ onComplete }: { onComplete: () => void }) {
  const [splashDone, setSplashDone] = useState(false);
  const [frame, setFrame] = useState(0);
  const [prevFrame, setPrevFrame] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [data, setData] = useState<GenesisData>(DEFAULT_DATA);
  const [askValue, setAskValue] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatThinking, setChatThinking] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [legalMode, setLegalMode] = useState(false);
  const [justEnteredFrame, setJustEnteredFrame] = useState(false);

  const update = (partial: Partial<GenesisData>) => setData(d => ({ ...d, ...partial }));

  const go = (next: number) => {
    setPrevFrame(frame);
    setAnimKey(k => k + 1);
    setFrame(next);
    setAskValue("");
    setJustEnteredFrame(true);
    setTimeout(() => setJustEnteredFrame(false), 100);
  };

  const sendChat = () => {
    if (!askValue.trim() || chatThinking) return;
    const msg = askValue.trim();
    setAskValue("");
    const userMsg: ChatMessage = { id: ++_msgId, role: "user", text: msg };
    setChatHistory(h => [...h, userMsg]);
    setChatExpanded(true);
    setChatThinking(true);
    const msgIndex = chatHistory.filter(m => m.role === "spark").length;
    setTimeout(() => {
      const reply: ChatMessage = { id: ++_msgId, role: "spark", text: getSparkReply(frame, msgIndex) };
      setChatHistory(h => [...h, reply]);
      setChatThinking(false);
    }, 1400);
  };

  const canContinue = () => frame !== 2 || (data.brandName.trim().length > 0 && data.niche.length > 0);
  const direction = frame > prevFrame ? "forward" : "back";
  const slideStyle: React.CSSProperties = { animation: `${direction === "forward" ? "genesis-in" : "genesis-back"} 220ms cubic-bezier(0.22,1,0.36,1) both` };

  const renderCanvas = () => {
    switch (frame) {
      case 1: return <FrameConnect data={data} onChange={update} />;
      case 2: return <FrameBrand data={data} onChange={update} justEntered={justEnteredFrame} />;
      case 3: return <FrameCharacter data={data} onChange={update} />;
      case 4: return <FrameVoice data={data} onChange={update} />;
      case 5: return <FrameSources data={data} onChange={update} />;
      case 6: return <FrameModes data={data} onChange={update} />;
      case 7: return <FrameReady data={data} />;
      default: return null;
    }
  };

  if (legalMode) return <LegalFlow onComplete={onComplete} />;

  return (
    <>
      <style>{STYLES}</style>
      {!splashDone && <SplashReel onDone={() => setSplashDone(true)} />}
      <div className="fixed inset-0 flex flex-col overflow-hidden"
        style={{ background: "#0B0F17", paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
        <AmbientOrbs />

        {/* Frame 0 */}
        {frame === 0 && (
          <div key="f0" style={slideStyle} className="relative z-10 flex-1 flex flex-col overflow-hidden">
            <FrameEntry onBegin={() => go(1)} />
          </div>
        )}

        {/* Frames 1–7 */}
        {frame >= 1 && (
          <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Top bar */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-3 pb-2">
              <button onClick={() => go(frame - 1)} className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 flex items-center justify-center flex-shrink-0">
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <StoryProgress total={7} current={frame} />
            </div>

            {/* Director */}
            <div key={`dir-${animKey}`} style={slideStyle} className="flex-shrink-0 px-6 pt-4 pb-2">
              <DirectorLine text={DIRECTORS[frame]} thinking={chatThinking} />
            </div>

            {/* Canvas */}
            <div key={`canvas-${animKey}`}
              style={{ ...slideStyle, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
              className="flex-1 overflow-y-auto no-bar px-6 py-3 min-h-0">
              {renderCanvas()}
              {/* Frame 7 button lives here, close to the summary card */}
              {frame === 7 && (
                <div className="flex justify-center mt-6 mb-2">
                  <div className="neon-btn-wrap" style={{ borderRadius: 50, display: "inline-flex" }}>
                    <button
                      className="neon-btn-inner"
                      onClick={() => setLegalMode(true)}
                      style={{ borderRadius: 50, padding: "12px 28px", fontSize: 14, fontWeight: 700, gap: 8 }}
                    >
                      <MainLogo size={16} />
                      View Spark
                    </button>
                  </div>
                </div>
              )}
              <div className="h-4" />
            </div>

            {/* Bottom zone */}
            <div className="flex-shrink-0 px-5 pt-3 pb-4 space-y-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0B0F17" }}>

              {frame < 7 ? (
                <>
                  {/* Persistent chat history panel */}
                  <ChatPanel
                    history={chatHistory}
                    thinking={chatThinking}
                    expanded={chatExpanded}
                    onToggle={() => setChatExpanded(e => !e)}
                  />

                  <p className="text-[11px] text-white/22 text-center leading-snug">
                    Don't know what to do? Feel free to ask me. I'm Super Spark.
                  </p>

                  <NeonAskField value={askValue} onChange={setAskValue} onSend={sendChat} disabled={chatThinking} />

                  <div className="space-y-1.5">
                    <button onClick={() => go(frame + 1)} disabled={!canContinue()}
                      className="w-full py-4 rounded-2xl bg-purple-600 text-white text-sm font-bold tracking-wide hover:bg-purple-500 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_24px_rgba(168,85,247,0.3)]">
                      Continue
                    </button>
                    {[1, 3, 4, 5].includes(frame) && (
                      <button onClick={() => go(frame + 1)} className="w-full py-2.5 text-xs text-white/28 hover:text-white/50 transition-colors text-center">
                        {frame === 1 ? "Continue without connecting" : "Skip"}
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
