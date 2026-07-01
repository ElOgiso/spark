/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Spark, Audio } from '../types';
import { Flame, Sparkles, Zap, ArrowRight, TrendingUp, Volume2, CheckCircle } from 'lucide-react';

interface ViralSparksProps {
  sparks: Spark[];
  audios: Audio[];
  onInitiateProduction: (spark: Spark) => void;
  onNavigateToTab: (tab: 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more') => void;
}

export default function ViralSparks({
  sparks,
  audios,
  onInitiateProduction,
  onNavigateToTab
}: ViralSparksProps) {
  const [justProducedId, setJustProducedId] = useState<string | null>(null);

  const handleCreateProduction = (spark: Spark) => {
    onInitiateProduction(spark);
    setJustProducedId(spark.id);
    setTimeout(() => {
      setJustProducedId(null);
      onNavigateToTab('spark'); // Navigate to command page to see the progress!
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-viralsparks-tab">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
          VIRAL SPARKS
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Opportunity Intelligence: trending topics, hooks, and audio formats scored for viral capability.
        </p>
      </div>

      {/* Grid of sparks */}
      <div className="grid gap-6 md:grid-cols-2">
        {sparks.length === 0 ? (
          <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-12 text-center text-zinc-500 font-mono md:col-span-2">
            No trending sparks discovered today. Run a discovery cycle from the dashboard!
          </div>
        ) : (
          sparks.map((spark) => {
            const audio = audios.find((a) => a.id === spark.suggestedAudioId);
            const isHot = spark.viralScore >= 90;
            return (
              <div
                key={spark.id}
                className={`relative flex flex-col justify-between rounded-2xl border bg-zinc-905 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 ${
                  spark.status === 'producing'
                    ? 'border-amber-500/30 bg-amber-500/[0.02]'
                    : isHot
                    ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-900/20'
                }`}
              >
                {/* Hot Tag badge */}
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-400 font-mono">
                    ID: {spark.id.toUpperCase()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {isHot && (
                      <span className="flex items-center gap-0.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-500 font-mono">
                        <Flame className="h-2.5 w-2.5 fill-rose-500 animate-pulse" />
                        CRITICAL MASS
                      </span>
                    )}
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                      isHot ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {spark.viralScore}% VIRAL ENGAGEMENT PROBABILITY
                    </span>
                  </div>
                </div>

                {/* Main Spark Concept details */}
                <div className="my-4">
                  <h3 className="text-base font-bold text-zinc-100 font-display leading-snug">
                    {spark.title}
                  </h3>
                  {/* Hook preview */}
                  <div className="mt-3 rounded-xl border border-zinc-850/50 bg-zinc-950/60 p-3.5 text-xs text-zinc-300 italic leading-relaxed">
                    <span className="not-italic text-[10px] font-extrabold tracking-wider text-amber-500 font-mono block mb-1">AUTOMATED HOOK:</span>
                    "{spark.hook}"
                  </div>
                </div>

                {/* Meta details & Suggestive audio */}
                <div className="border-t border-zinc-850/50 pt-3.5">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-[11px] text-zinc-500">
                    <div>
                      <span className="font-mono block">SOURCE TRIGGER:</span>
                      <span className="text-zinc-400 font-medium">{spark.sourceTrend}</span>
                    </div>

                    {audio && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-zinc-950/40 px-2 py-1 border border-zinc-900">
                        <Volume2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-mono truncate max-w-[120px]">
                          {audio.title} • rank #{audio.trendingRank}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Operational actions */}
                  <div className="mt-5">
                    {justProducedId === spark.id ? (
                      <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        DISPATCHING RENDER ENGINE...
                      </div>
                    ) : spark.status === 'producing' ? (
                      <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-400 border border-zinc-700">
                        <Zap className="h-4 w-4 text-amber-500 animate-pulse" />
                        DISPATCHED TO METER PIPELINE
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCreateProduction(spark)}
                        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-bold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-98"
                      >
                        <Sparkles className="h-4 w-4 fill-zinc-950" />
                        INITIATE PRODUCTION CO-PILOT
                        <ArrowRight className="h-4 w-4 text-zinc-950 transition-transform group-hover:translate-x-1" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
