/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { ReviewItem, Audio } from '../types';
import { Play, Pause, Volume2, VolumeX, CheckCircle2, AlertCircle, RefreshCw, Send, Check, Trash2, Edit3, ArrowRight } from 'lucide-react';

interface ReviewProps {
  reviewItems: ReviewItem[];
  audios: Audio[];
  onApproveItem: (id: string, publishTime: string) => void;
  onRejectItem: (id: string) => void;
  onNavigateToTab: (tab: 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more') => void;
}

export default function Review({
  reviewItems,
  audios,
  onApproveItem,
  onRejectItem,
  onNavigateToTab
}: ReviewProps) {
  const pendingItems = reviewItems.filter((item) => item.status === 'pending');
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeItem = pendingItems[currentIndex];

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isApprovedMessage, setIsApprovedMessage] = useState(false);

  // Subtitle sync mock states
  const [subtitles, setSubtitles] = useState([
    { id: 1, text: 'ChatGPT o3 is out...', start: 0, end: 1.5, active: true },
    { id: 2, text: 'but 99% of programmers are using it completely wrong.', start: 1.5, end: 4.5, active: false },
    { id: 3, text: 'Here is the secret chain-of-thought bypass.', start: 4.5, end: 7.0, active: false }
  ]);
  const [activeSubtitle, setActiveSubtitle] = useState('ChatGPT o3 is out...');

  // Reset subtitle lists when active item changes
  useEffect(() => {
    if (activeItem) {
      setVideoTitle(activeItem.exportPackage.metadata.title);
      setVideoDesc(activeItem.description);
      // Generate some custom mock subtitle timeline
      setSubtitles([
        { id: 1, text: activeItem.hook, start: 0, end: 2.0, active: true },
        { id: 2, text: 'SPARK discovered this trend scoring 94% on organic triggers.', start: 2.0, end: 5.0, active: false },
        { id: 3, text: 'Tweak these instructions into your character guideline to scale.', start: 5.0, end: 8.0, active: false }
      ]);
      setActiveSubtitle(activeItem.hook);
    }
  }, [activeItem]);

  // Simulate progress playback and subtitles highlight
  useEffect(() => {
    if (!isPlaying || !activeItem) return;
    let timer = 0;
    const interval = setInterval(() => {
      timer += 0.5;
      if (timer > 8.0) timer = 0;

      setSubtitles((prev) =>
        prev.map((sub) => {
          const isActive = timer >= sub.start && timer < sub.end;
          if (isActive) {
            setActiveSubtitle(sub.text);
          }
          return { ...sub, active: isActive };
        })
      );
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, activeItem]);

  const handleEditSubtitle = (id: number, text: string) => {
    setSubtitles((prev) =>
      prev.map((sub) => {
        if (sub.id === id) {
          if (sub.active) setActiveSubtitle(text);
          return { ...sub, text };
        }
        return sub;
      })
    );
  };

  const handleRegenerate = () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      alert('Draft voices re-synthesized. Subtitle caption sync normalized successfully.');
    }, 1800);
  };

  const handleApprove = () => {
    if (!activeItem) return;
    setIsApprovedMessage(true);
    // Let's schedule it 2 hours from now
    const publishTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    setTimeout(() => {
      onApproveItem(activeItem.id, publishTime);
      setIsApprovedMessage(false);
      // If there are more items, stay. Else route to calendar
      if (pendingItems.length <= 1) {
        onNavigateToTab('calendar');
      } else {
        setCurrentIndex((prev) => Math.min(prev, pendingItems.length - 2));
      }
    }, 1200);
  };

  if (!activeItem) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-8rem)]" id="spark-review-empty">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4 animate-bounce" />
        <h1 className="text-xl font-bold text-zinc-200 font-display">REVIEW QUEUE COMPLETED</h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-sm">
          Everything has been vetted, approved, and scheduled. The Media Operating System is running on parameters.
        </p>
        <button
          onClick={() => onNavigateToTab('spark')}
          className="mt-6 flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-zinc-950 shadow-md transition-all hover:bg-amber-600 active:scale-98"
        >
          Return to Command Deck
          <ArrowRight className="h-4 w-4 text-zinc-950" />
        </button>
      </div>
    );
  }

  const audio = audios.find((a) => a.id === activeItem.audioId);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-review-tab">
      {/* Tab Header with Queue Indicator */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
            SPARK REVIEW
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Vetting voice pacing, video timeline synchronization, and compliance checks.
          </p>
        </div>

        {/* Carousel indicator selector tape */}
        <div className="flex items-center gap-1.5 self-start">
          <span className="text-xs font-bold text-zinc-500 font-mono pr-1">QUEUE TAPE:</span>
          {pendingItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(idx)}
              className={`h-7 min-w-7 rounded-lg text-xs font-bold transition-all border ${
                idx === currentIndex
                  ? 'bg-amber-500 border-amber-500 text-zinc-950'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main interactive booth split */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Col: Smartphone Mock & Caption Timeline (5 Cols) */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Smartphone canvas */}
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[36px] border-4 border-zinc-800 bg-zinc-950 shadow-2xl ring-1 ring-zinc-700/50">
            {/* Live Video placeholder with elegant stock overlay loop */}
            <div className="absolute inset-0 z-0 bg-zinc-900">
              <video
                src={activeItem.videoPreviewUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="h-full w-full object-cover opacity-80"
              />
            </div>

            {/* Video mock overlays */}
            <div className="absolute inset-0 z-10 flex flex-col justify-between p-4.5 bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/40">
              {/* Header */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span className="rounded bg-black/60 px-2 py-0.5 border border-zinc-800">PORTRAIT 9:16</span>
                <span className="font-semibold text-amber-500 shadow-sm animate-pulse">• PLAYING</span>
              </div>

              {/* Dynamic Captions overlay synced to playhead */}
              <div className="text-center px-2 py-4">
                <p className="inline-block bg-black/80 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-bold font-mono tracking-tight text-zinc-100 shadow-lg leading-snug animate-fade-in">
                  {activeSubtitle}
                </p>
              </div>

              {/* Player control HUD overlay */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-zinc-800 text-zinc-200 hover:bg-black/80"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-amber-500" />}
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-zinc-800 text-zinc-200 hover:bg-black/80"
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-zinc-500" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Caption Timeline Editor */}
          <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-4.5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-zinc-500 font-mono mb-3">SUBTITLES TIMELINE SYNC</h3>
            <div className="flex flex-col gap-2">
              {subtitles.map((sub) => (
                <div
                  key={sub.id}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                    sub.active
                      ? 'border-amber-500/30 bg-amber-500/[0.03]'
                      : 'border-zinc-800 bg-zinc-950/20'
                  }`}
                >
                  <span className="font-mono text-[9px] font-bold text-zinc-500 whitespace-nowrap">
                    {sub.start.toFixed(1)}s
                  </span>
                  <input
                    type="text"
                    value={sub.text}
                    onChange={(e) => handleEditSubtitle(sub.id, e.target.value)}
                    className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none border-b border-transparent focus:border-zinc-700 pb-0.5"
                  />
                  <Edit3 className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Subtitles, Metadata, Quality Checks & Actions (7 Cols) */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Metadata Card */}
          <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display mb-4">DRAFT METADATA GUIDE</h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">PUBLISH TITLE</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">PUBLISH CAPTION & HASHTAGS</label>
                <textarea
                  value={videoDesc}
                  onChange={(e) => setVideoDesc(e.target.value)}
                  rows={4}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* SPARK Checks & Audio Info */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Quality check checklist */}
            <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-zinc-500 font-mono mb-3">AUTONOMOUS QUALITY COMPLIANCE</h3>
              <div className="flex flex-col gap-2.5">
                {activeItem.qualityChecks.map((qc) => (
                  <div key={qc.id} className="flex items-start gap-2">
                    {qc.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-300 leading-tight">{qc.label}</div>
                      {qc.details && <p className="text-[9px] text-zinc-500 mt-0.5">{qc.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Profile card */}
            <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-500 font-mono mb-3.5">BACKGROUND AUDIO KEY</h3>
                {audio && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs font-bold text-zinc-200">{audio.title}</div>
                    <div className="text-[10px] text-zinc-500 mt-1">{audio.artist} • {audio.duration}s duration</div>
                    {audio.trendingRank && (
                      <span className="inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 font-mono mt-2">
                        TRENDING RANK #{audio.trendingRank}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-zinc-850/50">
                <div className="text-[10px] text-zinc-500 font-mono">EXPORT TYPE:</div>
                <div className="text-xs font-bold text-zinc-300 mt-0.5">MP4 Video + SRT Captions Track</div>
              </div>
            </div>
          </div>

          {/* Tactile Operations Actions */}
          <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-zinc-500 font-mono mb-3.5 font-display">OPERATIONAL COMMANDS</h3>
            
            {isApprovedMessage ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                <Check className="h-4 w-4 animate-bounce" />
                VETTED & DISPATCHED TO PUBLISH CALENDAR
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={handleApprove}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-bold text-zinc-950 shadow-md transition-all hover:scale-[1.01] active:scale-98 sm:col-span-1"
                >
                  <Check className="h-4 w-4 fill-zinc-950" />
                  APPROVE
                </button>

                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/40 py-3 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-900 active:scale-98"
                >
                  <RefreshCw className={`h-4 w-4 text-zinc-400 ${isRegenerating ? 'animate-spin' : ''}`} />
                  {isRegenerating ? 'RE-SYNCHING...' : 'RE-GENERATE VOICE'}
                </button>

                <button
                  onClick={() => onRejectItem(activeItem.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/10 py-3 text-xs font-bold text-zinc-500 transition-all hover:bg-zinc-900 hover:text-rose-400 hover:border-rose-950"
                >
                  <Trash2 className="h-4 w-4" />
                  REJECT & ARCHIVE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
