/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Insight, Memory } from '../types';
import { BarChart3, TrendingUp, Lightbulb, Eye, Clock, Users, Brain, Info, CheckCircle } from 'lucide-react';

interface AnalyticsProps {
  insights: Insight[];
  memories: Memory[];
}

export default function Analytics({ insights, memories }: AnalyticsProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'hook' | 'pacing' | 'audio'>('all');

  const filteredInsights = selectedCategory === 'all'
    ? insights
    : insights.filter((ins) => ins.category === selectedCategory);

  const stats = [
    { label: 'CUMULATIVE VIEWS', value: '172,700', change: '+22.4%', up: true, icon: Eye },
    { label: 'AVG RETENTION TIME', value: '52.5s', change: '+8.6%', up: true, icon: Clock },
    { label: 'CONNECTED FOLLOWERS', value: '74,100', change: '+14.2%', up: true, icon: Users },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-analytics-tab">
      {/* Tab Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
          PERFORMANCE ANALYTICS
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Learn from results: metrics, platform engagement curves, and SPARK synthesized conclusions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-bold tracking-wider font-mono">{stat.label}</span>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold tracking-tight text-zinc-100 font-display">{stat.value}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                  stat.up ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Graph and Learn From Results */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Graph (7 Cols) */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono">RETENTION DECAY PROFILE</h2>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
              <span className="text-[10px] font-bold text-zinc-400 font-mono">SPARK INTEGRATION AVERAGE</span>
            </div>
          </div>

          {/* Premium custom drawing line vector graph */}
          <div className="relative h-60 w-full rounded-xl border border-zinc-950 bg-zinc-950/40 p-3">
            <svg viewBox="0 0 100 50" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="10" x2="100" y2="10" stroke="#18181b" strokeWidth="0.3" strokeDasharray="2" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#18181b" strokeWidth="0.3" strokeDasharray="2" />
              <line x1="0" y1="40" x2="100" y2="40" stroke="#18181b" strokeWidth="0.3" strokeDasharray="2" />
              
              {/* Fill Gradient Area */}
              <defs>
                <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 5 Q 12 10, 20 22 T 40 28 T 60 30 T 80 34 T 100 38 L 100 50 L 0 50 Z"
                fill="url(#chartGrad)"
              />
              {/* Smooth Spline Curve */}
              <path
                d="M 0 5 Q 12 10, 20 22 T 40 28 T 60 30 T 80 34 T 100 38"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Critical markers */}
              <circle cx="20" cy="22" r="1" fill="#f59e0b" />
              <circle cx="60" cy="30" r="1" fill="#f59e0b" />
            </svg>

            {/* Sub-labels on graph */}
            <div className="absolute bottom-1 left-2 text-[8px] font-bold text-zinc-600 font-mono">0s (HOOK)</div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-600 font-mono">30s (MIDPOINT)</div>
            <div className="absolute bottom-1 right-2 text-[8px] font-bold text-zinc-600 font-mono">60s (END)</div>
            
            <div className="absolute top-2 right-3 rounded border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-[9px] font-mono text-zinc-400">
              Hook Retention: <span className="text-emerald-500 font-semibold">78% kept</span>
            </div>
          </div>
          <p className="mt-3.5 text-[11px] text-zinc-500 leading-relaxed">
            The curve highlights audience decay. Dots display critical visual cuts triggered by SPARK to re-hook viewer retention.
          </p>
        </div>

        {/* Learn From Results / Insights (5 Cols) */}
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono">LEARN FROM RESULTS</h2>
            <div className="flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-500 font-mono">SPARK INSIGHTS</span>
            </div>
          </div>

          {/* Subtab filter */}
          <div className="flex flex-wrap gap-1.5 border-b border-zinc-850 pb-2">
            {['all', 'hook', 'pacing', 'audio'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as any)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  selectedCategory === cat
                    ? 'bg-zinc-800 text-amber-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
            {filteredInsights.map((ins) => (
              <div key={ins.id} className="rounded-xl border border-zinc-850 bg-zinc-950/40 p-3">
                <div className="flex items-start justify-between">
                  <div className="text-xs font-bold text-zinc-200">{ins.headline}</div>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500 font-mono whitespace-nowrap ml-1">
                    {ins.metricChange}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed">{ins.description}</p>
                <div className="mt-2 text-[9px] text-zinc-600 font-mono uppercase">
                  CATEGORY: {ins.category} • Synthesized {new Date(ins.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
