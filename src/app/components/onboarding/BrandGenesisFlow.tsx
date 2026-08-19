import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, Play, Pause, Plus, X, Check,
  Volume2, VolumeX, Link2, RefreshCw, Upload, Mic, Shuffle,
  CheckCircle2, Send, AlertCircle, ZoomIn, ZoomOut,
  ChevronDown, ChevronUp, Zap, MessageSquare,
} from "lucide-react";
import mainLogo from "@/imports/MAIN_LOGO.png";
import chatLogo from "@/imports/CHAT_LOGO.png";
import { useAuth } from "../../state/AuthContext";
import { useSpark } from "../../state/SparkContext";
import { socialConnectorFramework, getOAuthAuthorizationUrl } from "../../services/socialIntegrationService";
import {
  getElevenLabsVoices,
  previewElevenLabsVoice,
  designElevenLabsVoice,
  createDesignedElevenLabsVoice,
  ElevenLabsVoiceSummary,
  playVoicePersonaWebSpeech,
} from "../../services/runtime/providers/elevenLabsTTS";
import { ResearchSourceService } from "../../services/research/researchSourceService";
import { uploadCharacterSheetToStorage } from "../../backend/workspaceSync";
import {
  onboardDirectorVoiceService,
  FRAME_TO_SCRIPT_KEY,
  ONBOARD_SCRIPT_KEYS,
} from "../../services/onboarding/onboardDirectorVoiceService";
import type { ProductionMode, AutomationMode } from "../../domain/types";

// ─── Types & Interfaces ────────────────────────────────────────────────────────
export interface BrandGenesisData {
  brandName: string;
  creatorName?: string;
  niche: string;
  audience?: string;
  goal?: string;
  platforms: string[];
  tone?: string;
  vision?: string;
  visualStyle?: string;
  productionMode?: ProductionMode | string;
  automationMode?: AutomationMode | string;
  reviewRequired?: boolean;
  characterChoice?: "describe" | "upload" | "skip" | "generate";
  characterDescription?: string;
  characterSheetUrl?: string | null;
  characterImageUrl?: string | null;
  genre?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobe?: string;
  personality?: string;
  voiceProfile?: string;
  voiceId?: string;
  audioEnergy?: string;
  researchSources?: string[];
  connectedAccounts?: Array<{ platform: string; username: string; connected: boolean }>;
}

export interface BrandGenesisFlowProps {
  onComplete: (data: BrandGenesisData) => void;
}

// ─── Logo Components ───────────────────────────────────────────────────────────
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

function MainLogo({ size = 24 }: { size?: number }) {
  return <img src={mainLogo} alt="Spark" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}

function ChatLogo({ size = 20 }: { size?: number }) {
  return <img src={chatLogo} alt="Spark chat" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}

// ─── All Styles From Donor ─────────────────────────────────────────────────────
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
`;

// ─── Platform Logos ────────────────────────────────────────────────────────────
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
        <linearGradient id="bg-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f9a825" /><stop offset="30%" stopColor="#f06292" />
          <stop offset="65%" stopColor="#ba68c8" /><stop offset="100%" stopColor="#5c6bc0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#bg-ig-grad)" />
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
  { id: "youtube",   name: "YouTube",   Logo: YouTubeLogo,   live: true,  oauthKey: "YouTube Shorts" },
  { id: "x",         name: "X",         Logo: XLogo,         live: true,  oauthKey: "Twitter/X" },
  { id: "instagram", name: "Instagram", Logo: InstagramLogo, live: false, oauthKey: null },
  { id: "tiktok",    name: "TikTok",    Logo: TikTokLogo,    live: false, oauthKey: null },
  { id: "facebook",  name: "Facebook",  Logo: FacebookLogo,  live: false, oauthKey: null },
  { id: "linkedin",  name: "LinkedIn",  Logo: LinkedInLogo,  live: false, oauthKey: null },
  { id: "threads",   name: "Threads",   Logo: ThreadsLogo,   live: false, oauthKey: null },
  { id: "pinterest", name: "Pinterest", Logo: PinterestLogo, live: false, oauthKey: null },
  { id: "snapchat",  name: "Snapchat",  Logo: SnapchatLogo,  live: false, oauthKey: null },
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

// ─── Typewriter Hook ───────────────────────────────────────────────────────────
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

// ─── Story Progress ────────────────────────────────────────────────────────────
function StoryProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: i < current ? "100%" : "0%",
              background: "linear-gradient(90deg,#a855f7,#F018FF)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Director Line ─────────────────────────────────────────────────────────────
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

// ─── Chips & Cards ─────────────────────────────────────────────────────────────
function Chip({ label, selected, onToggle, suggested }: { label: string; selected: boolean; onToggle: () => void; suggested?: boolean }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-150 border relative ${
        selected ? "bg-purple-600/35 border-purple-400/70 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
          : "bg-white/5 border-white/10 text-white/55 hover:border-white/25"
      }`}
    >
      {label}
      {suggested && !selected && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F018FF] border border-[#0B0F17]" />}
    </button>
  );
}

function ModeCard({ label, desc, selected, onSelect }: { label: string; desc: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      type="button"
      className={`w-full rounded-2xl border px-5 py-4 text-left transition-all duration-150 ${
        selected ? "bg-purple-600/20 border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.2)]" : "bg-white/4 border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${selected ? "text-purple-100" : "text-white/80"}`}>{label}</span>
        {selected && <Check className="w-4 h-4 text-purple-400" />}
      </div>
      <p className="text-xs text-white/38 mt-1 leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── Persistent Chat Panel ─────────────────────────────────────────────────────
interface ChatMessage { id: number; role: "user" | "spark"; text: string; }

const FRAME_NAMES: Record<number, string> = {
  0: "Welcome & Introduction",
  1: "Connect Social Platforms",
  2: "Brand Name & Niche Strategy",
  3: "Host Character & Visual Style",
  4: "Narrator Voice & Cadence",
  5: "Research Sources & Calibration",
  6: "Production & Automation Modes",
  7: "Review & Launch",
};

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
      <button
        onClick={onToggle}
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/4 transition-colors"
      >
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
          {history.map((msg) => (
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
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#F018FF]/60"
                    style={{ animation: `thinking-pulse 0.9s ease ${i * 0.18}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Neon Ask Field ────────────────────────────────────────────────────────────
function NeonAskField({
  value,
  onChange,
  onSend,
  disabled,
  isMuted,
  onToggleMute,
  isSpeaking,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  isSpeaking?: boolean;
}) {
  return (
    <div className="neon-ask-wrap">
      <div className="neon-ask-inner">
        <ChatLogo size={18} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !disabled && value.trim() && onSend()}
          placeholder="Ask Super Spark or type a custom answer…"
          disabled={disabled}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-1.5 rounded-lg transition-all ${
              isMuted
                ? "text-white/25 hover:text-white/55 hover:bg-white/5"
                : isSpeaking
                ? "text-purple-300 animate-pulse bg-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                : "text-purple-300 hover:text-purple-200 hover:bg-white/5"
            }`}
            title={isMuted ? "Unmute guide voice" : "Mute guide voice"}
            aria-label={isMuted ? "Unmute guide voice" : "Mute guide voice"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {value.trim() && !disabled && (
            <button type="button" onClick={onSend} className="p-1 hover:opacity-80 transition-opacity">
              <Send className="w-3.5 h-3.5" style={{ color: "rgba(240,24,255,0.85)" }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Genre Carousel ────────────────────────────────────────────────────────────
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
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-bar py-2"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {GENRES.map((g, i) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { onSelect(g.id); scrollTo(i); }}
            className="flex-shrink-0 rounded-2xl overflow-hidden relative border-2 transition-all duration-200"
            style={{
              width: "72vw", maxWidth: 280, height: 280, scrollSnapAlign: "center",
              borderColor: selected === g.id ? "#F018FF" : "transparent",
              boxShadow: selected === g.id ? "0 0 24px rgba(240,24,255,0.5)" : "0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <img src={g.img} alt={g.label} className="absolute inset-0 w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.18) 55%,transparent 100%)",
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
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
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            className="rounded-full transition-all duration-200"
            style={{ width: i === activeIdx ? 16 : 6, height: 6, background: i === activeIdx ? "#F018FF" : "rgba(255,255,255,0.2)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Image Viewer Lightbox ─────────────────────────────────────────────────────
function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [lastDist, setLastDist] = useState<number | null>(null);
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}
    >
      <button
        onClick={onClose}
        type="button"
        className="absolute right-4 w-9 h-9 rounded-full bg-white/12 flex items-center justify-center z-10"
        style={{ top: "max(16px,env(safe-area-inset-top,16px))" }}
      >
        <X className="w-4 h-4 text-white" />
      </button>
      <div
        className="absolute left-4 flex flex-col gap-2 z-10"
        style={{ bottom: "max(96px,calc(env(safe-area-inset-bottom,0px)+80px))" }}
      >
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(5, s + 0.5))}
          className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center"
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(1, s - 0.5))}
          className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center"
        >
          <ZoomOut className="w-4 h-4 text-white" />
        </button>
      </div>
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "pinch-zoom" }}
        onTouchStart={(e) => { if (e.touches.length === 2) setLastDist(dist(e.touches)); }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const d = dist(e.touches);
            if (lastDist !== null) setScale((s) => Math.max(1, Math.min(5, s * (d / lastDist))));
            setLastDist(d);
          }
        }}
        onTouchEnd={() => setLastDist(null)}
        onWheel={(e) => { e.preventDefault(); setScale((s) => Math.max(1, Math.min(5, s - e.deltaY * 0.003))); }}
        onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2.5))}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none"
          style={{ transform: `scale(${scale})`, transition: lastDist ? "none" : "transform 0.2s ease" }}
          draggable={false}
        />
      </div>
      <p className="absolute text-[10px] text-white/25" style={{ bottom: "max(24px,calc(env(safe-area-inset-bottom,0px)+8px))" }}>
        Pinch or scroll to zoom · Double-tap to toggle
      </p>
    </div>
  );
}

// ─── Ambient Orbs ─────────────────────────────────────────────────────────────
function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full opacity-[0.12]"
        style={{
          width: 360, height: 360,
          background: "radial-gradient(circle,#F018FF,#a855f7,transparent 70%)",
          top: -80, left: -80,
          animation: "orb-drift 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full opacity-[0.08]"
        style={{
          width: 300, height: 300,
          background: "radial-gradient(circle,#22d3ee,transparent 70%)",
          bottom: 40, right: -60,
          animation: "orb-drift 12s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

// ─── Internal Genesis State ────────────────────────────────────────────────────
interface GenesisInternalState {
  connectedPlatforms: string[];
  connectedHandles: Record<string, string>;
  brandName: string;
  creatorName: string;
  niche: string;
  goal: string;
  characterGenre: string;
  characterSkin: string;
  characterHair: string;
  characterWardrobe: string;
  characterPersonality: string;
  characterDescription: string;
  characterSheetUrl: string | null;
  characterGenerated: boolean;
  selectedVoice: string;
  selectedVoiceId: string;
  researchSources: string[];
  productionMode: string;
  automationMode: string;
}

const DEFAULT_STATE: GenesisInternalState = {
  connectedPlatforms: [],
  connectedHandles: {},
  brandName: "",
  creatorName: "",
  niche: "",
  goal: "Growth",
  characterGenre: "Realistic",
  characterSkin: "Rich Brown",
  characterHair: "Short Crop",
  characterWardrobe: "Executive Tailored Suit",
  characterPersonality: "Confident",
  characterDescription: "",
  characterSheetUrl: null,
  characterGenerated: false,
  selectedVoice: "nova",
  selectedVoiceId: "21m00Tcm4TlvDq8ikWAM",
  researchSources: [],
  productionMode: "Hybrid",
  automationMode: "Balanced",
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

// ─── Frame Components ──────────────────────────────────────────────────────────
function FrameEntry({
  onBegin,
  isMuted,
  onToggleMute,
  isSpeaking,
}: {
  onBegin: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isSpeaking?: boolean;
}) {
  const { displayed, done } = useTypewriter(
    "Welcome. I'm Super Spark, your executive creative director.\nLet's build the brand SPARK will run.", 24, 400
  );
  return (
    <div className="relative flex flex-col items-center justify-between h-full px-8 py-8 text-center overflow-hidden">
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={onToggleMute}
          className={`p-2 rounded-full border transition-all ${
            isMuted
              ? "bg-white/4 border-white/8 text-white/28 hover:text-white/60"
              : isSpeaking
              ? "bg-purple-600/20 border-purple-500/50 text-purple-300 animate-pulse shadow-[0_0_12px_rgba(168,85,247,0.3)]"
              : "bg-white/8 border-white/12 text-purple-300 hover:text-purple-200"
          }`}
          title={isMuted ? "Unmute guide voice" : "Mute guide voice"}
          aria-label={isMuted ? "Unmute guide voice" : "Mute guide voice"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
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
        <button
          onClick={onBegin}
          type="button"
          className="w-full py-4 rounded-2xl bg-purple-600 text-white text-base font-semibold tracking-wide hover:bg-purple-500 active:scale-[0.98] transition-all shadow-[0_0_32px_rgba(168,85,247,0.4)]"
        >
          Begin
        </button>
        <p className="text-xs text-white/22 leading-relaxed">
          Don't know what to do? Feel free to ask me. I'm Super Spark.
        </p>
      </div>
    </div>
  );
}

function FrameConnect({
  data,
  onChange,
  onConnectReal,
  connectingPlatform,
  connectError,
}: {
  data: GenesisInternalState;
  onChange: (d: Partial<GenesisInternalState>) => void;
  onConnectReal: (platformId: string, oauthKey: string | null) => void;
  connectingPlatform: string | null;
  connectError: string | null;
}) {
  return (
    <div className="space-y-2.5">
      {connectError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{connectError}</span>
        </div>
      )}
      {PLATFORMS.map(({ id, name, Logo, live, oauthKey }) => {
        const connected = data.connectedPlatforms.includes(id);
        const isConnecting = connectingPlatform === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => live && onConnectReal(id, oauthKey)}
            disabled={!live || (!!connectingPlatform && connectingPlatform !== id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
              !live ? "bg-white/2 border-white/6 opacity-50 cursor-default"
                : connected ? "bg-purple-600/18 border-purple-500/50"
                : isConnecting ? "bg-white/6 border-white/18 animate-pulse"
                : "bg-white/4 border-white/10 hover:border-white/22"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Logo size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${connected ? "text-purple-100" : "text-white/82"}`}>{name}</p>
                  {!live && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/32 border border-white/10">Soon</span>}
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {connected ? `Connected · ${data.connectedHandles[id] || "Account linked"}` : isConnecting ? "Connecting…" : live ? "Tap to connect" : "Available soon in Accounts"}
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

function FrameBrand({ data, onChange, justEntered }: { data: GenesisInternalState; onChange: (d: Partial<GenesisInternalState>) => void; justEntered: boolean }) {
  const [detecting, setDetecting] = useState(false);
  const [detectedNiche, setDetectedNiche] = useState("");

  useEffect(() => {
    if (!justEntered) return;
    const first = data.connectedPlatforms[0];
    if (!first) return;
    if (!data.brandName && data.connectedHandles[first]) {
      const raw = data.connectedHandles[first].replace("@", "").replace("creator_", "");
      onChange({
        brandName: raw.charAt(0).toUpperCase() + raw.slice(1) + " Studio",
        creatorName: raw.charAt(0).toUpperCase() + raw.slice(1),
      });
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
        <input
          value={data.brandName}
          onChange={(e) => onChange({ brandName: e.target.value })}
          placeholder="Your channel or brand name"
          className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/22 outline-none focus:border-purple-500/55 transition-colors"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Niche</label>
          {detecting && <span className="text-[9px] text-[#F018FF] flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> AI detecting…</span>}
          {detectedNiche && !detecting && <span className="text-[9px] text-[#F018FF]">· AI suggested</span>}
        </div>
        {detectedNiche && <p className="text-[11px] text-white/28 -mt-1">Tap a different niche to override</p>}
        <div className="flex flex-wrap gap-2">
          {niches.map((n) => (
            <Chip
              key={n}
              label={n}
              selected={data.niche === n}
              suggested={n === detectedNiche && data.niche !== n}
              onToggle={() => onChange({ niche: data.niche === n ? "" : n })}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Goal <span className="normal-case text-white/22">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {goals.map((g) => (
            <Chip
              key={g}
              label={g}
              selected={data.goal === g}
              onToggle={() => onChange({ goal: data.goal === g ? "" : g })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FrameCharacter({
  data,
  onChange,
  onGenerateSheet,
  isGenerating,
  generateError,
}: {
  data: GenesisInternalState;
  onChange: (d: Partial<GenesisInternalState>) => void;
  onGenerateSheet: () => void;
  isGenerating: boolean;
  generateError: string | null;
}) {
  const [viewer, setViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const skins = ["Fair", "Medium", "Olive", "Rich Brown", "Deep Dark"];
  const hairs = ["Short Crop", "Textured Curls", "Braids / Locs", "Sleek Bob", "Long Waves", "Buzz Cut"];
  const personalities = ["Confident", "Warm & Engaging", "High Authority", "Energetic & Viral", "Playful & Witty", "Inquisitive"];
  const defaultGenreImg = GENRES.find((g) => g.id === data.characterGenre)?.img || GENRES[0].img;
  const activeImage = data.characterSheetUrl || defaultGenreImg;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const uri = ev.target?.result as string;
      if (uri) {
        onChange({ characterSheetUrl: uri, characterGenerated: true });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <div className="space-y-6">
        {generateError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{generateError}</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Genre — swipe to browse, tap to select</label>
          <GenreCarousel selected={data.characterGenre} onSelect={(g) => onChange({ characterGenre: g })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Skin Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {skins.map((s) => (
                <Chip key={s} label={s} selected={data.characterSkin === s} onToggle={() => onChange({ characterSkin: data.characterSkin === s ? "" : s })} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Hair</label>
            <div className="flex flex-wrap gap-1.5">
              {hairs.map((h) => (
                <Chip key={h} label={h} selected={data.characterHair === h} onToggle={() => onChange({ characterHair: data.characterHair === h ? "" : h })} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Personality</label>
          <div className="flex flex-wrap gap-2">
            {personalities.map((p) => (
              <Chip key={p} label={p} selected={data.characterPersonality === p} onToggle={() => onChange({ characterPersonality: data.characterPersonality === p ? "" : p })} />
            ))}
          </div>
        </div>

        {!data.characterGenerated && !data.characterSheetUrl ? (
          <div className="space-y-2">
            <button
              onClick={onGenerateSheet}
              type="button"
              disabled={isGenerating || !data.characterGenre}
              className="w-full py-3.5 rounded-xl border border-purple-500/40 text-purple-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-purple-600/15 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating master character sheet…</>
              ) : (
                <><Shuffle className="w-4 h-4" /> Generate Character Bible Sheet</>
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 text-xs text-white/40 hover:text-white/70 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Upload reference image
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setViewer(true)}
              type="button"
              className="w-full rounded-2xl border border-purple-500/35 bg-purple-600/10 overflow-hidden active:scale-[0.98] transition-transform text-left"
            >
              <div className="relative h-44 overflow-hidden bg-black/40">
                <img src={activeImage} alt={data.characterGenre} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-sm text-white font-semibold bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-2">
                    <ZoomIn className="w-4 h-4" /> View Character Sheet
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-purple-300 font-semibold">Production Model Sheet · {data.characterGenre}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGenerateSheet(); }}
                    className="text-[10px] text-white/40 flex items-center gap-1 hover:text-white/80"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="text-[10px] text-white/40 flex items-center gap-1 hover:text-white/80"
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
      {viewer && activeImage && <ImageViewer src={activeImage} alt={data.characterGenre} onClose={() => setViewer(false)} />}
    </>
  );
}

function FrameVoice({
  data,
  onChange,
  onPlayVoice,
  playingVoiceId,
  voicesList,
}: {
  data: GenesisInternalState;
  onChange: (d: Partial<GenesisInternalState>) => void;
  onPlayVoice: (voiceId: string) => void;
  playingVoiceId: string | null;
  voicesList: ElevenLabsVoiceSummary[];
}) {
  const fallbackVoices = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", tag: "F", desc: "Calm, narrative, high authority", col: "text-fuchsia-300" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", tag: "F", desc: "Confident, energetic, punchy delivery", col: "text-indigo-300" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", tag: "F", desc: "Warm, conversational, storytelling tone", col: "text-purple-300" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", tag: "M", desc: "Deep, smooth, cinematic authority", col: "text-blue-300" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", tag: "M", desc: "Crisp, executive, trend-native delivery", col: "text-cyan-300" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", tag: "M", desc: "Rich baritone, high trust & resonance", col: "text-rose-300" },
  ];

  const displayVoices = voicesList.length > 0
    ? voicesList.slice(0, 6).map((v, i) => ({
        id: v.voiceId,
        name: v.name,
        tag: (v.category || "Narrator").charAt(0).toUpperCase(),
        desc: v.description || "Production narrator voice",
        col: i % 2 === 0 ? "text-fuchsia-300" : "text-indigo-300",
      }))
    : fallbackVoices;

  return (
    <div className="space-y-2.5">
      {displayVoices.map((v) => (
        <div
          key={v.id}
          className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-all ${
            data.selectedVoiceId === v.id ? "bg-purple-600/20 border-purple-500/55" : "bg-white/4 border-white/10"
          }`}
        >
          <div className={`w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-xs font-bold ${v.col}`}>
            {v.tag}
          </div>
          <div className="flex items-center gap-[2px] flex-shrink-0 h-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`w-[2px] rounded-full transition-all ${data.selectedVoiceId === v.id ? "bg-purple-400" : "bg-white/20"}`}
                style={{
                  height: playingVoiceId === v.id ? `${6 + ((i * 3) % 12)}px` : `${4 + (i % 4) * 2.5}px`,
                }}
              />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${data.selectedVoiceId === v.id ? "text-purple-100" : "text-white/80"}`}>{v.name}</p>
            <p className="text-[11px] text-white/32 truncate">{v.desc}</p>
          </div>
          <button
            onClick={() => onPlayVoice(v.id)}
            type="button"
            className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center flex-shrink-0"
          >
            {playingVoiceId === v.id ? <Pause className="w-3.5 h-3.5 text-white/70" /> : <Play className="w-3.5 h-3.5 text-white/50" />}
          </button>
          <button
            onClick={() => onChange({ selectedVoice: v.name, selectedVoiceId: v.id })}
            type="button"
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              data.selectedVoiceId === v.id ? "bg-purple-500 text-white" : "bg-white/6 text-white/28 hover:bg-white/12"
            }`}
          >
            {data.selectedVoiceId === v.id ? <Check className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      ))}
      <div className="rounded-2xl border border-dashed border-white/12 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center flex-shrink-0">
          <Mic className="w-4 h-4 text-white/28" />
        </div>
        <div>
          <p className="text-xs text-white/38 font-medium">Design a custom voice</p>
          <p className="text-[10px] text-white/20 mt-0.5">Describe it in the Super Spark ask field below</p>
        </div>
      </div>
    </div>
  );
}

function FrameSources({
  data,
  onChange,
  onAddSource,
  syncStatuses,
}: {
  data: GenesisInternalState;
  onChange: (d: Partial<GenesisInternalState>) => void;
  onAddSource: (url: string) => void;
  syncStatuses: Record<string, "syncing" | "ready">;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const url = input.trim();
    if (!url || data.researchSources.includes(url)) return;
    onAddSource(url);
    setInput("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white/6 border border-white/12 rounded-xl px-3 py-3 focus-within:border-purple-500/50">
          <Link2 className="w-4 h-4 text-white/25 flex-shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Paste a channel or video URL…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none"
          />
        </div>
        <button
          onClick={add}
          type="button"
          disabled={!input.trim()}
          className="w-11 h-11 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center disabled:opacity-30 flex-shrink-0"
        >
          <Plus className="w-4 h-4 text-purple-300" />
        </button>
      </div>
      {data.researchSources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
          <p className="text-xs text-white/25">Add channels SPARK should learn from</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.researchSources.map((url) => {
            const isReady = syncStatuses[url] === "ready";
            return (
              <div
                key={url}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isReady ? "bg-green-600/8 border-green-500/20" : "bg-white/4 border-white/10"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 truncate">{url}</p>
                  <p className={`text-[10px] mt-0.5 ${isReady ? "text-green-400" : "text-white/25"}`}>
                    {isReady ? "Ready · Indexed" : "Syncing…"}
                  </p>
                </div>
                {isReady ? (
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-white/25 animate-spin flex-shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => onChange({ researchSources: data.researchSources.filter((s) => s !== url) })}
                  className="w-6 h-6 rounded-full bg-white/6 flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-3 h-3 text-white/38" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FrameModes({ data, onChange }: { data: GenesisInternalState; onChange: (d: Partial<GenesisInternalState>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Production</label>
        <div className="space-y-2">
          {[
            { id: "Narrator", desc: "Voice + visuals — lean AI-narrated productions" },
            { id: "Hybrid", desc: "Strong motion + host — mix of your footage and AI" },
            { id: "Cinematic", desc: "Full storyboard and filmic depth — no camera required" },
          ].map((m) => (
            <ModeCard
              key={m.id}
              label={m.id}
              desc={m.desc}
              selected={data.productionMode === m.id}
              onSelect={() => onChange({ productionMode: m.id })}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] text-white/38 uppercase tracking-widest font-semibold">Automation</label>
        <div className="space-y-2">
          {[
            { id: "Manual", desc: "You approve every action before SPARK proceeds" },
            { id: "Balanced", desc: "SPARK drafts and publishes; you gate strategy decisions" },
            { id: "Autonomous", desc: "SPARK runs within your brand rules — full delegation" },
          ].map((m) => (
            <ModeCard
              key={m.id}
              label={m.id}
              desc={m.desc}
              selected={data.automationMode === m.id}
              onSelect={() => onChange({ automationMode: m.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FrameReady({ data, onPreviewSheet }: { data: GenesisInternalState; onPreviewSheet: () => void }) {
  const connected = PLATFORMS.filter((p) => data.connectedPlatforms.includes(p.id));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
      {[
        { label: "Brand",      value: data.brandName || "—" },
        { label: "Niche",      value: data.niche || "—" },
        { label: "Goal",       value: data.goal || "—" },
        { label: "Character",  value: `${data.characterGenre} · ${data.characterPersonality}` },
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
      {data.characterSheetUrl && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/6">
          <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">Model Sheet</span>
          <button
            type="button"
            onClick={onPreviewSheet}
            className="text-xs text-purple-300 flex items-center gap-1.5 hover:text-purple-200"
          >
            <ZoomIn className="w-3.5 h-3.5" /> View Bible Grid
          </button>
        </div>
      )}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/6">
        <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">Accounts</span>
        {connected.length > 0 ? (
          <div className="flex gap-1.5">
            {connected.map(({ id, Logo }) => <Logo key={id} size={20} />)}
          </div>
        ) : (
          <span className="text-sm font-medium text-white/22">Not connected</span>
        )}
      </div>
    </div>
  );
}

// ─── Legal Flow ────────────────────────────────────────────────────────────────
const LEGAL_SCREENS = [
  {
    title: "Terms & Conditions",
    agree: "I Agree to the Terms & Conditions",
    body: `By using SPARK, you agree to these Terms in full. SPARK is an AI-powered creative operations platform. You grant SPARK the right to access, store, and process all content, media, and account data you connect or upload for the purpose of generating, scheduling, and distributing content on your behalf.\n\nYou confirm that all connected accounts belong to you or you have authority to connect them. You are responsible for any content published through SPARK. SPARK may suspend or terminate access for policy violations.\n\nThese Terms are governed by the laws applicable to your jurisdiction. Continued use constitutes acceptance of any updated Terms.`,
  },
  {
    title: "Privacy & Data Policy",
    agree: "I Agree to the Privacy Policy",
    body: `SPARK collects data including account credentials, content metadata, analytics, audience data, uploaded media, and usage behaviour. This data is stored securely and used to operate, improve, and personalise the SPARK platform for you.\n\nSPARK may share aggregate or anonymised data with partners for platform research and improvement. SPARK does not sell your personally identifiable information to third parties.\n\nYou may request deletion of your data at any time by contacting SPARK support. By continuing, you consent to the collection and processing of your data as described.`,
  },
  {
    title: "SPARK Usage Rights",
    agree: "I Understand and Agree",
    body: `YOU GRANT SPARK UNLIMITED, IRREVOCABLE, WORLDWIDE RIGHTS OVER ALL CONTENT, DATA, AND MEDIA CREATED, PROCESSED, OR PUBLISHED THROUGH THE PLATFORM.\n\nSPARK has the right to analyse, use, reproduce, distribute, and train AI models on any content, interaction, or output generated within the platform — with no time limit and no geographic restriction.\n\nSPARK may use your content, likeness (in AI-generated form), and brand assets to improve its systems, demonstrate platform capabilities, and build features for other users, in accordance with applicable law.\n\nThis grants SPARK full creative and operational authority over your connected accounts and content pipeline. You retain ownership of original content but license it to SPARK royalty-free for platform purposes.`,
  },
];

function LegalFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const screen = LEGAL_SCREENS[step];
  const handleAgree = () => {
    if (step < LEGAL_SCREENS.length - 1) {
      setStep((s) => s + 1);
      scrollRef.current?.scrollTo({ top: 0 });
    } else {
      onComplete();
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "#0B0F17",
        paddingTop: "env(safe-area-inset-top,0px)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
    >
      <AmbientOrbs />
      <div className="relative z-10 flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <MainLogo size={22} />
          <div className="flex gap-1.5">
            {LEGAL_SCREENS.map((_, i) => (
              <div
                key={i}
                className="h-[2.5px] w-8 rounded-full transition-all duration-300"
                style={{ background: i <= step ? "#F018FF" : "rgba(255,255,255,0.1)" }}
              />
            ))}
          </div>
          <span className="text-[10px] text-white/28 ml-auto">{step + 1} of {LEGAL_SCREENS.length}</span>
        </div>
        <h2 className="text-xl font-bold text-white">{screen.title}</h2>
        <p className="text-[10px] text-white/28 mt-1 uppercase tracking-widest">Please read carefully</p>
      </div>
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto no-bar px-5 py-2">
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{screen.body}</p>
        </div>
        {step === 2 && (
          <div className="mt-4 rounded-2xl border border-orange-500/25 bg-orange-500/8 px-5 py-4">
            <p className="text-xs text-orange-300/80 font-semibold leading-relaxed">
              ⚠ This agreement grants SPARK broad rights over your data and content. By agreeing you confirm you have read and understood these terms.
            </p>
          </div>
        )}
        <div className="h-6" />
      </div>
      <div className="relative z-10 flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={handleAgree}
          type="button"
          className="w-full py-4 rounded-2xl bg-purple-600 text-white text-sm font-bold tracking-wide hover:bg-purple-500 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(168,85,247,0.35)]"
        >
          {screen.agree}
        </button>
        <p className="text-[10px] text-white/18 text-center mt-2">Declining will exit the setup process.</p>
      </div>
    </div>
  );
}

// ─── Main Brand Genesis Component ──────────────────────────────────────────────
let _msgId = 0;

export function BrandGenesisFlow({ onComplete }: BrandGenesisFlowProps) {
  const auth = useAuth();
  const { initializeBrandGenesis } = useSpark();

  const [frame, setFrame] = useState(0);
  const [prevFrame, setPrevFrame] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [data, setData] = useState<GenesisInternalState>(DEFAULT_STATE);
  const [askValue, setAskValue] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatThinking, setChatThinking] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [legalMode, setLegalMode] = useState(false);
  const [justEnteredFrame, setJustEnteredFrame] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Real backend states
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [voicesList, setVoicesList] = useState<ElevenLabsVoiceSummary[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, "syncing" | "ready">>({});

  // Onboard Director Gemini Voice state
  const [voiceMuted, setVoiceMuted] = useState(() => onboardDirectorVoiceService.isMuted());
  const [voiceSpeaking, setVoiceSpeaking] = useState(() => onboardDirectorVoiceService.isSpeaking());

  const update = (partial: Partial<GenesisInternalState>) => setData((d) => ({ ...d, ...partial }));

  // Subscribe to onboard director voice updates & cleanup on unmount; warm up initial speech
  useEffect(() => {
    const unsubscribe = onboardDirectorVoiceService.subscribe((state) => {
      setVoiceMuted(state.isMuted);
      setVoiceSpeaking(state.isSpeaking);
    });

    // Preload first step director speech immediately on mount
    void onboardDirectorVoiceService.preload("Welcome. I'm Super Spark, your executive creative director. Let's build the brand SPARK will run.", ONBOARD_SCRIPT_KEYS.welcome_super_spark);
    if (DIRECTORS[1]) {
      void onboardDirectorVoiceService.preload(DIRECTORS[1], FRAME_TO_SCRIPT_KEY[1]);
    }

    return () => {
      unsubscribe();
      onboardDirectorVoiceService.stop();
    };
  }, []);

  // Auto-speak director lines when entering frames
  useEffect(() => {
    if (legalMode) {
      onboardDirectorVoiceService.stop();
      return;
    }

    if (frame === 0) {
      void onboardDirectorVoiceService.speak(
        "Welcome. I'm Super Spark, your executive creative director. Let's build the brand SPARK will run.",
        ONBOARD_SCRIPT_KEYS.welcome_super_spark
      );
    } else if (DIRECTORS[frame]) {
      void onboardDirectorVoiceService.speak(DIRECTORS[frame], FRAME_TO_SCRIPT_KEY[frame]);
      // Preload next step line
      if (DIRECTORS[frame + 1]) {
        void onboardDirectorVoiceService.preload(DIRECTORS[frame + 1], FRAME_TO_SCRIPT_KEY[frame + 1]);
      }
    }
  }, [frame, legalMode]);

  // Load ElevenLabs voices & restore OAuth state on mount
  useEffect(() => {
    void getElevenLabsVoices().then((res) => {
      if (res && res.voices && res.voices.length > 0) {
        setVoicesList(res.voices);
      }
    });

    // Check if brand already has a custom saved voice
    if (auth.brand?.id) {
      void import("../../backend/workspaceSync").then(({ hydrateWorkspace }) => {
        void hydrateWorkspace(auth.brand!.id).then((snap) => {
          if (snap?.character?.voice?.voiceId) {
            const savedVoice = snap.character.voice;
            const customVoiceSummary: ElevenLabsVoiceSummary = {
              voiceId: savedVoice.voiceId || "",
              name: savedVoice.name || "Custom Voice",
              category: "custom",
              description: savedVoice.description || "Custom brand narrator",
              accent: savedVoice.name,
              gender: "custom",
            };
            setVoicesList((prev) => [customVoiceSummary, ...prev.filter((v) => v.voiceId !== savedVoice.voiceId)]);
          }
        });
      });
    }

    if (typeof localStorage !== "undefined") {
      const savedState = localStorage.getItem("spark_onboarding_resume_state");
      const storedTokens = socialConnectorFramework.getStoredTokens();
      const connectedAccountsMap: Record<string, string> = {};
      let autoBrandName = "";
      let autoCreatorName = "";

      if (storedTokens && typeof storedTokens === "object") {
        Object.values(storedTokens).forEach((tok: any) => {
          if (tok && tok.platform) {
            const isYt = tok.platform.toLowerCase().includes("youtube");
            const pid = isYt ? "youtube" : "x";

            let realHandle = (tok.handle || tok.accountHandle || "").trim();
            if (realHandle === "@connected" || realHandle === "connected") {
              realHandle = "";
            }
            if (!realHandle && tok.displayName) {
              realHandle = `@${tok.displayName.replace(/\s+/g, "").toLowerCase()}`;
            }
            if (realHandle && !realHandle.startsWith("@")) {
              realHandle = `@${realHandle}`;
            }

            if (realHandle) {
              connectedAccountsMap[pid] = realHandle;
            }

            if (!autoCreatorName && (tok.displayName || realHandle)) {
              autoCreatorName = tok.displayName || realHandle.replace(/^@/, "");
            }
            if (!autoBrandName && (tok.displayName || realHandle)) {
              autoBrandName = tok.displayName || realHandle.replace(/^@/, "");
            }
          }
        });
      }

      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setData((prev) => ({
            ...prev,
            ...parsed,
            brandName: parsed.brandName || prev.brandName || autoBrandName,
            creatorName: parsed.creatorName || prev.creatorName || autoCreatorName,
            connectedPlatforms: Array.from(new Set([...(parsed.connectedPlatforms || []), ...Object.keys(connectedAccountsMap)])),
            connectedHandles: { ...(parsed.connectedHandles || {}), ...connectedAccountsMap },
          }));
          setFrame(2); // advance to Frame 2 after OAuth
        } catch (e) {
          console.warn("[BrandGenesisFlow] Restore state notice:", e);
        } finally {
          localStorage.removeItem("spark_onboarding_resume_state");
        }
      } else if (Object.keys(connectedAccountsMap).length > 0) {
        setData((prev) => ({
          ...prev,
          brandName: prev.brandName || autoBrandName,
          creatorName: prev.creatorName || autoCreatorName,
          connectedPlatforms: Array.from(new Set([...prev.connectedPlatforms, ...Object.keys(connectedAccountsMap)])),
          connectedHandles: { ...prev.connectedHandles, ...connectedAccountsMap },
        }));
      }
    }
  }, []);

  const go = (next: number) => {
    setPrevFrame(frame);
    setAnimKey((k) => k + 1);
    setFrame(next);
    setAskValue("");
    setJustEnteredFrame(true);
    setTimeout(() => setJustEnteredFrame(false), 100);
  };

  // Real Social Connection Handler
  const handleConnectReal = async (platformId: string, oauthKey: string | null) => {
    setConnectError(null);
    if (data.connectedPlatforms.includes(platformId)) {
      const next = data.connectedPlatforms.filter((p) => p !== platformId);
      const handles = { ...data.connectedHandles };
      delete handles[platformId];
      update({ connectedPlatforms: next, connectedHandles: handles });
      return;
    }

    if (!oauthKey) return;

    setConnectingPlatform(platformId);

    const timeout = setTimeout(() => {
      setConnectingPlatform(null);
      setConnectError("Connection timed out. You can retry or skip.");
    }, 10000);

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("spark_onboarding_resume_state", JSON.stringify(data));
      }
      const authUrl = getOAuthAuthorizationUrl(
        oauthKey as "YouTube Shorts" | "Twitter/X"
      );
      clearTimeout(timeout);
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setConnectingPlatform(null);
        setConnectError("Could not initiate authorization for " + platformId);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      setConnectingPlatform(null);
      setConnectError(err?.message || "Connection failed. Please retry.");
    }
  };

  // Real Character Generation Handler
  const handleGenerateSheet = async () => {
    setIsGeneratingSheet(true);
    setGenerateError(null);

    const prompt = `Production Character Design Bible Reference Sheet for "${data.creatorName || "Lead Host"}" representing brand "${data.brandName || "SPARK"}", niche: "${data.niche}".
Visual Style / Genre: ${data.characterGenre || "Realistic"}.
Skin Tone: ${data.characterSkin || "Rich Brown"}.
Hair Style: ${data.characterHair || "Short Crop"}.
Signature Wardrobe: ${data.characterWardrobe || "Executive Tailored Suit"}.
Personality & Emotion: ${data.characterPersonality || "Confident"}.
Director Notes & Persona: ${data.characterDescription || "Executive host in modern high-contrast studio setting"}.

LAYOUT & COMPOSITION (One unified master model sheet / production bible grid):
1. TOP TITLE BLOCK: "${data.creatorName || "Lead Host"}" - Production Model Bible, Style: ${data.characterGenre || "Realistic"}, Core Aesthetic Guidelines.
2. FULL-BODY TURNAROUND MODEL ROW: 4 distinct full-body views (Full Front Standing Pose, 3/4 Dynamic Angle, Side Profile, and Back View) in matching signature wardrobe (${data.characterWardrobe || "Executive Tailored Suit"}) under neutral key studio lighting.
3. EXPRESSION PALETTE GRID: 4 to 6 facial emotion crops (${data.characterPersonality || "Confident"}: Confident, Explaining/Directing, Warm/Smiling, Inquisitive/Thoughtful, Intense Hook).
4. COLOR PALETTE SWATCH STRIP: 5 exact hex color swatches defining wardrobe accents, skin tone, hair tint, and set tone.
5. DETAILS & PROPS: Detailed close-up of signature microphone / accessory / wristwear and fabric texture.

AESTHETICS: Masterclass character turnaround sheet, ultra-crisp studio lighting, high consistency, professional animation and visual development standard, photorealistic 8k detail, clear reference layout.`;

    try {
      const { ModelRouter } = await import("../../services/runtime/modelRouter");
      const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
        prompt,
        capability: "Image Generation",
      });

      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        let finalUrl = imgUrl;
        if (auth.brand?.id) {
          try {
            finalUrl = await uploadCharacterSheetToStorage(auth.brand.id, imgUrl);
          } catch (e) {
            console.warn("[BrandGenesisFlow] Storage upload notice:", e);
          }
        }
        update({
          characterSheetUrl: finalUrl,
          characterGenerated: true,
        });
      } else {
        setGenerateError("Character sheet generation returned no image. Please retry.");
      }
    } catch (err: any) {
      console.warn("[BrandGenesisFlow] Character sheet generation notice:", err);
      setGenerateError(err?.message || "Character generation failed. You can retry or upload a reference image.");
    } finally {
      setIsGeneratingSheet(false);
    }
  };

  // Real ElevenLabs Audio Sample Play Handler
  const handlePlayVoice = async (voiceId: string) => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      } catch {}
      setPreviewAudio(null);
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceId);

    try {
      const voiceObj = voicesList.find((v) => v.voiceId === voiceId);
      const voiceName = voiceObj?.name || "Rachel";
      const sampleText = `Welcome to SPARK. I'm ${voiceName}, your brand narrator for high-retention content.`;

      let audioUrl = voiceObj?.previewUrl;
      if (!audioUrl) {
        audioUrl = (await previewElevenLabsVoice(voiceId, sampleText)) || undefined;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        setPreviewAudio(audio);

        audio.onended = () => {
          setPlayingVoiceId(null);
          setPreviewAudio(null);
        };
        audio.onerror = () => {
          console.warn("[BrandGenesisFlow] ElevenLabs audio preview playback error");
          setPreviewAudio(null);
          setPlayingVoiceId(null);
        };

        await audio.play().catch((playErr) => {
          console.warn("[BrandGenesisFlow] Audio autoplay policy notice:", playErr);
          setPreviewAudio(null);
          setPlayingVoiceId(null);
        });
      } else {
        console.warn("[BrandGenesisFlow] ElevenLabs preview audio unavailable for voice ID:", voiceId);
        setPlayingVoiceId(null);
      }
    } catch (err) {
      console.error("[BrandGenesisFlow] handlePlayVoice error:", err);
      setPlayingVoiceId(null);
      setPreviewAudio(null);
    }
  };

  // Real Research Source Registration
  const handleAddSource = async (url: string) => {
    update({ researchSources: [...data.researchSources, url] });
    setSyncStatuses((s) => ({ ...s, [url]: "syncing" }));
    try {
      await ResearchSourceService.registerAndExtract(url, auth.brand?.id, []);
      setSyncStatuses((s) => ({ ...s, [url]: "ready" }));
    } catch {
      setSyncStatuses((s) => ({ ...s, [url]: "ready" }));
    }
  };

  // Super Spark Interactive Chat
  const sendChat = async () => {
    if (!askValue.trim() || chatThinking) return;
    const msg = askValue.trim();
    setAskValue("");
    const userMsg: ChatMessage = { id: ++_msgId, role: "user", text: msg };
    setChatHistory((h) => [...h, userMsg]);
    setChatExpanded(true);
    setChatThinking(true);

    // If user describes a custom voice on frame 4
    if (frame === 4 && (msg.toLowerCase().includes("voice") || msg.toLowerCase().includes("sound") || msg.toLowerCase().includes("narrator") || msg.toLowerCase().includes("tone") || msg.toLowerCase().includes("accent"))) {
      try {
        const preview = await designElevenLabsVoice({
          description: msg,
          sampleText: "Welcome to our channel. Here is how we build high performance media.",
        });
        if (preview && preview.previews && preview.previews.length > 0) {
          const first = preview.previews[0];
          const created = await createDesignedElevenLabsVoice({
            voiceName: "Custom " + (data.brandName || "Voice"),
            voiceDescription: msg,
            generatedVoiceId: first.generated_voice_id,
          });
          const customVoiceId = created?.voice_id || first.generated_voice_id;
          if (customVoiceId) {
            const customVoiceObj = {
              voiceId: customVoiceId,
              name: "Custom " + (data.brandName || "Voice"),
              category: "custom",
              description: msg,
              previewUrl: first.previewUrl,
              accent: "Custom Designed",
              gender: "custom",
            };
            setVoicesList((prev) => [customVoiceObj, ...prev.filter((v) => v.voiceId !== customVoiceId)]);
            update({
              selectedVoice: customVoiceObj.name,
              selectedVoiceId: customVoiceId,
            });
            if (auth.brand?.id) {
              void import("../../backend/workspaceSync").then(({ persistCharacterUpdate }) => {
                void persistCharacterUpdate(auth.brand!.id, {
                  name: data.creatorName || "Lead Host",
                  role: "Lead Host",
                  style: `${data.characterGenre || "Realistic"} — representing ${data.brandName || "SPARK"}`,
                  avatarUrl: data.characterSheetUrl || null,
                  imageUrl: data.characterSheetUrl || null,
                  characterSheetUrl: data.characterSheetUrl || null,
                  traits: ["Visionary", "Charismatic", "Authority"],
                  voice: {
                    name: customVoiceObj.name,
                    language: "English",
                    tone: "Custom",
                    locked: true,
                    voiceId: customVoiceId,
                    description: msg,
                  },
                });
              });
            }
          }
        }
      } catch (e) {
        console.warn("[BrandGenesisFlow] Voice design notice:", e);
      }
    }

    try {
      const { generateOnboardAssistantResponse } = await import("../../services/geminiService");
      const replyText = await generateOnboardAssistantResponse({
        prompt: msg,
        stepName: FRAME_NAMES[frame] || `Step ${frame}`,
        stepNumber: frame,
        brandData: {
          brandName: data.brandName,
          creatorName: data.creatorName,
          niche: data.niche,
          goal: data.goal,
          characterGenre: data.characterGenre,
          selectedVoice: data.selectedVoice,
          connectedPlatforms: data.connectedPlatforms,
        },
        history: chatHistory.map((m) => ({ role: m.role, text: m.text })),
      });

      const reply: ChatMessage = { id: ++_msgId, role: "spark", text: replyText };
      setChatHistory((h) => [...h, reply]);
      setChatThinking(false);
      void onboardDirectorVoiceService.speak(replyText);
    } catch (chatErr) {
      console.warn("[BrandGenesisFlow] Live Chat generation error:", chatErr);
      const fallbackText = getSparkReply(frame, chatHistory.filter((m) => m.role === "spark").length);
      const reply: ChatMessage = { id: ++_msgId, role: "spark", text: fallbackText };
      setChatHistory((h) => [...h, reply]);
      setChatThinking(false);
      void onboardDirectorVoiceService.speak(fallbackText);
    }
  };

  // Final Completion Handler
  const handleFinalCompletion = async () => {
    const connectedAccounts = data.connectedPlatforms.map((pid) => {
      const realHandle = data.connectedHandles[pid] || (pid === "youtube" ? "@youtube" : "@x");
      return {
        platform: pid === "youtube" ? "YouTube Shorts" : pid === "x" ? "Twitter/X" : pid,
        username: realHandle,
        connected: true,
      };
    });

    const prodModeMapped: ProductionMode =
      data.productionMode === "Cinematic" ? "deep" : data.productionMode === "Narrator" ? "express" : "standard";
    const autoModeMapped: AutomationMode =
      data.automationMode === "Manual" ? "manual" : data.automationMode === "Autonomous" ? "autonomous" : "balanced";

    const genesisData: BrandGenesisData = {
      brandName: data.brandName || "Spark Studio",
      creatorName: data.creatorName || data.brandName || "Creator",
      niche: data.niche || "Creator Economy",
      goal: data.goal || "Growth",
      platforms: data.connectedPlatforms,
      productionMode: prodModeMapped,
      automationMode: autoModeMapped,
      characterChoice: data.characterSheetUrl ? "describe" : "skip",
      characterDescription: data.characterDescription,
      characterSheetUrl: data.characterSheetUrl,
      characterImageUrl: data.characterSheetUrl,
      genre: data.characterGenre,
      skinTone: data.characterSkin,
      hairStyle: data.characterHair,
      wardrobe: data.characterWardrobe,
      personality: data.characterPersonality,
      voiceProfile: data.selectedVoice,
      voiceId: data.selectedVoiceId,
      researchSources: data.researchSources,
      connectedAccounts,
    };

    try {
      await initializeBrandGenesis(genesisData);
      await auth.markOnboardingComplete(auth.brand?.id);
    } catch (persistErr) {
      console.warn("[BrandGenesisFlow] Cloud completion persist notice:", persistErr);
    }
    onComplete(genesisData);
  };

  const canContinue = () => frame !== 2 || (data.brandName.trim().length > 0 && data.niche.length > 0);
  const direction = frame > prevFrame ? "forward" : "back";
  const slideStyle: React.CSSProperties = {
    animation: `${direction === "forward" ? "genesis-in" : "genesis-back"} 220ms cubic-bezier(0.22,1,0.36,1) both`,
  };

  const renderCanvas = () => {
    switch (frame) {
      case 1:
        return (
          <FrameConnect
            data={data}
            onChange={update}
            onConnectReal={handleConnectReal}
            connectingPlatform={connectingPlatform}
            connectError={connectError}
          />
        );
      case 2:
        return <FrameBrand data={data} onChange={update} justEntered={justEnteredFrame} />;
      case 3:
        return (
          <FrameCharacter
            data={data}
            onChange={update}
            onGenerateSheet={handleGenerateSheet}
            isGenerating={isGeneratingSheet}
            generateError={generateError}
          />
        );
      case 4:
        return (
          <FrameVoice
            data={data}
            onChange={update}
            onPlayVoice={handlePlayVoice}
            playingVoiceId={playingVoiceId}
            voicesList={voicesList}
          />
        );
      case 5:
        return (
          <FrameSources
            data={data}
            onChange={update}
            onAddSource={handleAddSource}
            syncStatuses={syncStatuses}
          />
        );
      case 6:
        return <FrameModes data={data} onChange={update} />;
      case 7:
        return <FrameReady data={data} onPreviewSheet={() => setViewerOpen(true)} />;
      default:
        return null;
    }
  };

  if (legalMode) return <LegalFlow onComplete={handleFinalCompletion} />;

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none"
        style={{
          background: "#0B0F17",
          paddingTop: "env(safe-area-inset-top,0px)",
          paddingBottom: "env(safe-area-inset-bottom,0px)",
        }}
      >
        <AmbientOrbs />

        {/* Max-width container for desktop elegance and 100% mobile viewport */}
        <div className="relative z-10 w-full max-w-lg h-full flex flex-col overflow-hidden">
          {/* Frame 0 */}
          {frame === 0 && (
            <div key="f0" style={slideStyle} className="relative z-10 flex-1 flex flex-col overflow-hidden">
              <FrameEntry
                onBegin={() => go(1)}
                isMuted={voiceMuted}
                onToggleMute={() => onboardDirectorVoiceService.toggleMute()}
                isSpeaking={voiceSpeaking}
              />
            </div>
          )}

          {/* Frames 1–7 */}
          {frame >= 1 && (
            <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top bar */}
              <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-3 pb-2">
                <button
                  onClick={() => go(frame - 1)}
                  type="button"
                  className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 flex items-center justify-center flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4 text-white/60" />
                </button>
                <StoryProgress total={7} current={frame} />
              </div>

              {/* Director */}
              <div key={`dir-${animKey}`} style={slideStyle} className="flex-shrink-0 px-6 pt-4 pb-2">
                <DirectorLine text={DIRECTORS[frame]} thinking={chatThinking} />
              </div>

              {/* Canvas */}
              <div
                key={`canvas-${animKey}`}
                style={{ ...slideStyle, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                className="flex-1 overflow-y-auto no-bar px-6 py-3 min-h-0"
              >
                {renderCanvas()}
                {/* Frame 7 button */}
                {frame === 7 && (
                  <div className="flex justify-center mt-6 mb-2">
                    <div className="neon-btn-wrap" style={{ borderRadius: 50, display: "inline-flex" }}>
                      <button
                        type="button"
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
              <div
                className="flex-shrink-0 px-5 pt-3 pb-4 space-y-2.5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0B0F17" }}
              >
                {frame < 7 ? (
                  <>
                    {/* Persistent chat history panel */}
                    <ChatPanel
                      history={chatHistory}
                      thinking={chatThinking}
                      expanded={chatExpanded}
                      onToggle={() => setChatExpanded((e) => !e)}
                    />

                    <p className="text-[11px] text-white/22 text-center leading-snug">
                      Don't know what to do? Feel free to ask me. I'm Super Spark.
                    </p>

                    <NeonAskField
                      value={askValue}
                      onChange={setAskValue}
                      onSend={sendChat}
                      disabled={chatThinking}
                      isMuted={voiceMuted}
                      onToggleMute={() => onboardDirectorVoiceService.toggleMute()}
                      isSpeaking={voiceSpeaking}
                    />

                    <div className="space-y-1.5">
                      <button
                        onClick={() => {
                          if (frame === 1) {
                            const firstPlatform = data.connectedPlatforms[0];
                            let nextBrand = data.brandName;
                            let nextCreator = data.creatorName;
                            if (firstPlatform && data.connectedHandles[firstPlatform]) {
                              const handleClean = data.connectedHandles[firstPlatform].replace(/^@/, "");
                              if (!nextCreator) nextCreator = handleClean;
                              if (!nextBrand) nextBrand = handleClean.toLowerCase().endsWith("media") || handleClean.toLowerCase().endsWith("studio") ? handleClean : `${handleClean} Studio`;
                            }
                            if (nextBrand !== data.brandName || nextCreator !== data.creatorName) {
                              update({ brandName: nextBrand, creatorName: nextCreator });
                            }
                          }
                          go(frame + 1);
                        }}
                        type="button"
                        disabled={!canContinue()}
                        className="w-full py-4 rounded-2xl bg-purple-600 text-white text-sm font-bold tracking-wide hover:bg-purple-500 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_24px_rgba(168,85,247,0.3)]"
                      >
                        Continue
                      </button>
                      {[1, 3, 4, 5].includes(frame) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (frame === 1) {
                              const firstPlatform = data.connectedPlatforms[0];
                              let nextBrand = data.brandName;
                              let nextCreator = data.creatorName;
                              if (firstPlatform && data.connectedHandles[firstPlatform]) {
                                const handleClean = data.connectedHandles[firstPlatform].replace(/^@/, "");
                                if (!nextCreator) nextCreator = handleClean;
                                if (!nextBrand) nextBrand = handleClean.toLowerCase().endsWith("media") || handleClean.toLowerCase().endsWith("studio") ? handleClean : `${handleClean} Studio`;
                              }
                              if (nextBrand !== data.brandName || nextCreator !== data.creatorName) {
                                update({ brandName: nextBrand, creatorName: nextCreator });
                              }
                            }
                            go(frame + 1);
                          }}
                          className="w-full py-2.5 text-xs text-white/28 hover:text-white/50 transition-colors text-center"
                        >
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
      </div>
      {viewerOpen && data.characterSheetUrl && (
        <ImageViewer
          src={data.characterSheetUrl}
          alt={data.characterGenre}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
