import React from "react";
import mainLogo from "@/imports/MAIN_LOGO.png";

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
`;

export function MainLogoAnimated({ size = 80, className = "" }: { size?: number; className?: string }) {
  return (
    <>
      <style>{STYLES}</style>
      <div className={`spark-mark-wrap ${className}`} style={{ width: size, height: size, position: "relative", display: "inline-flex" }}>
        <div className="spark-bloom" style={{ width: size * 2.4, height: size * 2.4, left: -(size * 0.7), top: -(size * 0.7) }} />
        <div className="spark-p spark-p1" style={{ left: size * 0.22, top: size * 0.12 }} />
        <div className="spark-p spark-p2" style={{ right: size * 0.08, top: size * 0.2 }} />
        <div className="spark-p spark-p3" style={{ left: size * 0.08, bottom: size * 0.22 }} />
        <div className="spark-p spark-p4" style={{ right: size * 0.2, bottom: size * 0.1 }} />
        <img
          src={mainLogo}
          alt="Spark"
          className="spark-mark-svg"
          style={{ width: size, height: size, objectFit: "contain", position: "relative", zIndex: 2 }}
        />
      </div>
    </>
  );
}
