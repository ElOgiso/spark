import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

export function OpenAILogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#10A37F" />
      <path
        d="M18.6 10.7a4.2 4.2 0 0 0-.4-3.5 4.3 4.3 0 0 0-4.1-2 4.4 4.4 0 0 0-2.8-1 4.2 4.2 0 0 0-4.1 3.2 4.3 4.3 0 0 0-2.7 2 4.3 4.3 0 0 0 .5 4.6 4.2 4.2 0 0 0 .4 3.5 4.3 4.3 0 0 0 4.1 2 4.4 4.4 0 0 0 2.8 1 4.2 4.2 0 0 0 4.1-3.2 4.3 4.3 0 0 0 2.7-2 4.3 4.3 0 0 0-.5-4.6zm-6.6 8.1c-.6 0-1.1-.2-1.6-.4l2-1.2c.2-.1.3-.4.3-.6v-2.8l2 1.2v2.4a3.1 3.1 0 0 1-2.7 1.4zm-4.7-2.3a3.1 3.1 0 0 1-.9-2.5l2 1.2c.2.1.5.1.7 0l2.4-1.4v2.3l-2.1 1.2a3.1 3.1 0 0 1-2.1-.8zm-1.8-6.1c.3-.5.7-.9 1.2-1.2v2.3c0 .2.1.5.3.6l2.4 1.4-2 1.2v-2.4c0-.7.4-1.4.1-1.9zm7.7-1.1l-2.4 1.4-2-1.2v-2.3a3.1 3.1 0 0 1 3.7.8l.7 1.3zm3 3.6l-2-1.2v-2.3a3.1 3.1 0 0 1 2.1.8c.6.6.9 1.4.9 2.2l-2 1.2c-.3-.2-.7-.5-1-.7zm-1.9 2.5l-2.4 1.4-2.4-1.4 2.4-1.4 2.4 1.4z"
        fill="white"
      />
    </svg>
  );
}

export function GeminiLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="35%" stopColor="#8E24AA" />
          <stop offset="70%" stopColor="#D81B60" />
          <stop offset="100%" stopColor="#FB8C00" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="#0D1117" />
      <path
        d="M12 3C12 7.97 7.97 12 3 12C7.97 12 12 16.03 12 21C12 16.03 16.03 12 21 12C16.03 12 12 7.97 12 3Z"
        fill="url(#gemini-grad)"
      />
      <circle cx="18" cy="6" r="1.5" fill="#FB8C00" />
    </svg>
  );
}

export function ClaudeLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#D97757" />
      <path
        d="M13.6 6.5h-3.2L6 17.5h3.2l1.1-3h3.4l1.1 3h3.2L13.6 6.5zm-2.5 5.8l1-2.9 1 2.9h-2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function GrokLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#000000" />
      <path
        d="M17.75 4h-2.47l-3.28 4.24L8.52 4H3.5l5.75 7.78L3.5 20h2.47l3.64-4.7L13.48 20H18.5l-6.09-8.22L17.75 4z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function ElevenLabsLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#18181B" />
      <rect x="7" y="6" width="3.5" height="12" rx="1.75" fill="#FFFFFF" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1.75" fill="#A855F7" />
    </svg>
  );
}

export function KlingLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#6366F1" />
      <circle cx="12" cy="12" r="4.5" stroke="#FFFFFF" strokeWidth="2" fill="none" />
      <polygon points="11,10 15,12 11,14" fill="#FFFFFF" />
    </svg>
  );
}

export function RunwayLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#06B6D4" />
      <path
        d="M7 6H13C15.2 6 17 7.8 17 10C17 12.2 15.2 14 13 14H10V18H7V6ZM10 9V11H13C13.6 11 14 10.6 14 10C14 9.4 13.6 9 13 9H10Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function LumaLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#F59E0B" />
      <circle cx="12" cy="12" r="3.5" fill="#FFFFFF" />
      <path d="M12 4V7M12 17V20M4 12H7M17 12H20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HiggsfieldLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#EC4899" />
      <path
        d="M12 5L13.8 10.2L19 12L13.8 13.8L12 19L10.2 13.8L5 12L10.2 10.2L12 5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function AutoSparkLogo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="spark-auto-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#spark-auto-grad)" />
      <path
        d="M12 4L13.5 9.5L19 11L13.5 12.5L12 18L10.5 12.5L5 11L10.5 9.5L12 4Z"
        fill="#FFFFFF"
      />
      <circle cx="17.5" cy="6.5" r="1.5" fill="#FDE047" />
    </svg>
  );
}

export function getProviderLogo(providerId?: string, size = 28, className = ""): React.ReactNode {
  switch (providerId) {
    case "openai":
      return <OpenAILogo size={size} className={className} />;
    case "gemini":
      return <GeminiLogo size={size} className={className} />;
    case "claude":
      return <ClaudeLogo size={size} className={className} />;
    case "grok":
      return <GrokLogo size={size} className={className} />;
    case "elevenlabs":
      return <ElevenLabsLogo size={size} className={className} />;
    case "kling":
      return <KlingLogo size={size} className={className} />;
    case "runway":
      return <RunwayLogo size={size} className={className} />;
    case "luma":
      return <LumaLogo size={size} className={className} />;
    case "higgsfield":
      return <HiggsfieldLogo size={size} className={className} />;
    case "auto":
    default:
      return <AutoSparkLogo size={size} className={className} />;
  }
}
