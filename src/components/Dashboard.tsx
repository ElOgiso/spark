/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Brand, Production, ReviewItem } from '../types';
import { Play, Cpu, Sparkles, RefreshCw, Layers, ArrowRight, CheckCircle2, AlertCircle, Clock, Check } from 'lucide-react';

interface DashboardProps {
  brand: Brand;
  productions: Production[];
  pendingReviewCount: number;
  onUpdateModes: (productionMode: Brand['productionMode'], automationMode: Brand['automationMode']) => void;
  onNavigateToTab: (tab: 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more') => void;
  onTriggerAutonomousProduction: () => void;
}

export default function Dashboard({
  brand,
  productions,
  pendingReviewCount,
  onUpdateModes,
  onNavigateToTab,
  onTriggerAutonomousProduction
}: DashboardProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStep, setTriggerStep] = useState(0);
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggerProgress, setTriggerProgress] = useState(0);

  const steps = [
    { text: 'Accessing connected account search hooks...', speed: 1000 },
    { text: 'Analyzing viral trending patterns on TikTok...', speed: 1500 },
    { text: 'Identified opportunity: "o3 Reasoning Secrets" (+94 score)', speed: 1200 },
    { text: 'Developing character-paired Hook script...', speed: 1500 },
    { text: 'Synthesizing voiceover with Aria\'s warm cadence...', speed: 1300 },
    { text: 'Matching trending B-roll assets & text overlays...', speed: 1400 },
    { text: 'Completing multi-layer rendering & auto-checking...', speed: 1200 },
    { text: 'Render Complete! Saved to SPARK REVIEW Queue.', speed: 800 }
  ];

  const handleTriggerCycle = () => {
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerStep(0);
    setTriggerProgress(5);
    setTriggerMessage(steps[0].text);
  };

  useEffect(() => {
    if (!isTriggering) return;

    if (triggerStep < steps.length) {
      const timer = setTimeout(() => {
        const nextStep = triggerStep + 1;
        setTriggerStep(nextStep);
        setTriggerProgress(Math.floor((nextStep / steps.length) * 100));
        
        if (nextStep < steps.length) {
          setTriggerMessage(steps[nextStep].text);
        } else {
          setTriggerProgress(100);
          // Callback to add item to list
          onTriggerAutonomousProduction();
          setTimeout(() => {
            setIsTriggering(false);
            setTriggerStep(0);
            setTriggerProgress(0);
            setTriggerMessage('');
          }, 2500);
        }
      }, steps[triggerStep].speed);

      return () => clearTimeout(timer);
    }
  }, [isTriggering, triggerStep]);

  // Operational system actions mock
  const systemLogs = [
    { time: '10:14 AM', type: 'info', msg: 'System background check: Connected accounts validated' },
    { time: '09:42 AM', type: 'brain', msg: 'SPARK brain integrated 1 new hook engagement memory' },
    { time: '08:15 AM', type: 'publish', msg: 'Scheduled publish job for Instagram Reels compiled' },
    { time: 'Yesterday', type: 'success', msg: 'Publish Complete: "No-Code Workflow Build" gained 42.5k views' }
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-dashboard-tab">
      {/* Operating Header Summary */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
            SPARK COMMAND
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Control center for <span className="text-amber-500 font-semibold">{brand.name}</span>. Managing identity, trend opportunity discovery, and draft reviews.
          </p>
        </div>

        {/* Trigger Autonomous Cycle Button */}
        <div>
          <button
            onClick={handleTriggerCycle}
            disabled={isTriggering}
            className={`group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-xs font-bold tracking-wider text-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-[0.98] disabled:scale-100 disabled:opacity-80 sm:w-auto`}
            id="trigger-autonomous-cycle-btn"
          >
            {isTriggering ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 fill-zinc-950 transition-transform group-hover:rotate-12" />
            )}
            {isTriggering ? 'DISCOVERING OPPORTUNITY...' : 'TRIGGER DISCOVER & PRODUCE CYCLE'}
          </button>
        </div>
      </div>

      {/* Interactive Simulation Dashboard Indicator Overlay */}
      {isTriggering && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 backdrop-blur-sm animate-pulse-subtle">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-amber-500 animate-spin" />
                <span className="text-xs font-bold tracking-widest text-amber-500 font-mono">AUTONOMOUS OPERATING CYCLE IN PROGRESS</span>
              </div>
              <span className="text-xs font-bold text-amber-500 font-mono">{triggerProgress}%</span>
            </div>
            {/* ProgressBar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${triggerProgress}%` }}
              />
            </div>
            {/* Message */}
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <ArrowRight className="h-4 w-4 text-amber-500" />
              <span>{triggerMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Overview: Operating Modes & Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Production Mode Card */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
          <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-4">PRODUCTION MODE</h2>
          <div className="flex flex-col gap-2.5">
            {(['Auto-Pilot', 'Co-Pilot', 'Draft Only'] as Brand['productionMode'][]).map((mode) => (
              <button
                key={mode}
                onClick={() => onUpdateModes(mode, brand.automationMode)}
                className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                  brand.productionMode === mode
                    ? 'border-amber-500/40 bg-amber-500/5 text-amber-500'
                    : 'border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <div>
                  <div className="text-sm font-bold">{mode}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {mode === 'Auto-Pilot' && 'Completely hands-free discover, create & auto-publish.'}
                    {mode === 'Co-Pilot' && 'Discover & draft are automated. Posts wait in REVIEW.'}
                    {mode === 'Draft Only' && 'Generate initial raw ideas and transcripts only.'}
                  </div>
                </div>
                {brand.productionMode === mode && <Check className="h-4.5 w-4.5 text-amber-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Automation Mode Card */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
          <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-4">AUTOMATION DIRECTIVE</h2>
          <div className="flex flex-col gap-2.5">
            {(['Full', 'Approve Actions', 'Manual'] as Brand['automationMode'][]).map((mode) => (
              <button
                key={mode}
                onClick={() => onUpdateModes(brand.productionMode, mode)}
                className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                  brand.automationMode === mode
                    ? 'border-amber-500/40 bg-amber-500/5 text-amber-500'
                    : 'border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <div>
                  <div className="text-sm font-bold">
                    {mode === 'Full' && 'Full Autonomy'}
                    {mode === 'Approve Actions' && 'Approve Critical Actions'}
                    {mode === 'Manual' && 'Full Manual Controls'}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {mode === 'Full' && 'Publish immediately on successful quality verification.'}
                    {mode === 'Approve Actions' && 'Generate video then notify reviewer for publishing permission.'}
                    {mode === 'Manual' && 'Manual control of asset sourcing, hook picks, and pacing edits.'}
                  </div>
                </div>
                {brand.automationMode === mode && <Check className="h-4.5 w-4.5 text-amber-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Review Status Block */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm md:col-span-2 xl:col-span-1">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-2">REVIEW QUEUE STATUS</h2>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-bold tracking-tight text-zinc-100 font-display">
                {pendingReviewCount}
              </span>
              <span className="text-sm text-zinc-400 font-medium">productions pending</span>
            </div>
            <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
              SPARK renders and runs 11 automated quality checks on your videos before depositing them in the operational queue.
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('review')}
            className="group mt-6 flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5 text-xs font-bold tracking-wider text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-900"
          >
            <span>GO TO REVIEW STAGE</span>
            <ArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Bottom Section: Active Productions & System logs */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Active Production Pipeline (8 Cols) */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono">ACTIVE PRODUCTION METER</h2>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-bold text-amber-500 font-mono">
              {productions.length} IN PROGRESS
            </span>
          </div>

          {productions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-8 w-8 text-zinc-600 mb-2" />
              <div className="text-xs font-bold text-zinc-400">Pipeline Idle</div>
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                Click "Trigger Discover & Produce Cycle" above or initiate custom templates from Viral Sparks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {productions.map((prod) => (
                <div key={prod.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{prod.title}</div>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 font-mono capitalize">
                        <span>STAGE: <span className="text-amber-500">{prod.step.replace('_', ' ')}</span></span>
                        <span>•</span>
                        <span>EST. COMPLETION: {new Date(prod.estimatedCompletion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 font-mono">{prod.progress}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 mt-3">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300"
                      style={{ width: `${prod.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Logs (4 Cols) */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-4">
          <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-4">BACKGROUND INTELLIGENCE TRACK</h2>
          <div className="flex flex-col gap-3">
            {systemLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-zinc-600 font-mono whitespace-nowrap">{log.time}</span>
                <span className="text-zinc-400">
                  <span className={`font-semibold ${
                    log.type === 'brain' ? 'text-amber-500 font-mono' :
                    log.type === 'publish' ? 'text-violet-500 font-mono' :
                    log.type === 'success' ? 'text-emerald-500 font-mono' : 'text-zinc-500 font-mono'
                  }`}>
                    {log.type === 'brain' ? '[BRAIN] ' :
                     log.type === 'publish' ? '[JOB] ' :
                     log.type === 'success' ? '[PUB] ' : '[SYS] '}
                  </span>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
