/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tab } from '../types';
import { Zap, Brain, Flame, ClipboardCheck, Calendar, BarChart3, Settings } from 'lucide-react';

interface SidebarProps {
  currentTab: Tab;
  onSelectTab: (tab: Tab) => void;
  pendingReviewCount: number;
}

export default function Sidebar({ currentTab, onSelectTab, pendingReviewCount }: SidebarProps) {
  const navItems = [
    { id: 'spark' as Tab, label: 'SPARK', icon: Zap },
    { id: 'my-spark' as Tab, label: 'MY SPARK', icon: Brain },
    { id: 'viral-sparks' as Tab, label: 'VIRAL SPARKS', icon: Flame },
    { id: 'review' as Tab, label: 'REVIEW', icon: ClipboardCheck, badge: pendingReviewCount },
    { id: 'calendar' as Tab, label: 'CALENDAR', icon: Calendar },
    { id: 'analytics' as Tab, label: 'ANALYTICS', icon: BarChart3 },
    { id: 'more' as Tab, label: 'MORE', icon: Settings }
  ];

  return (
    <aside className="hidden h-[calc(100vh-4rem)] w-64 flex-col justify-between border-r border-zinc-800 bg-zinc-950/60 p-4 md:flex" id="spark-sidebar">
      <div className="flex flex-col gap-6">
        {/* Logo and Tagline */}
        <div className="px-2 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
              <Zap className="h-4 w-4 text-zinc-950 fill-zinc-950" />
            </div>
            <span className="text-xl font-bold tracking-widest text-zinc-100 font-display">SPARK</span>
            <span className="rounded bg-zinc-800 px-1 py-0.5 text-[8px] font-bold text-amber-500 font-mono">MEDIA OS</span>
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500 font-mono">Intelligent Media Operator</p>
        </div>

        {/* Navigation Rail */}
        <nav className="flex flex-col gap-1" id="desktop-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-amber-500 shadow-sm border border-zinc-800/80'
                    : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4.5 w-4.5 transition-colors ${isActive ? 'text-amber-500' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                  <span className="font-display tracking-wider text-[11px] font-bold">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/10 px-1 text-[10px] font-bold text-amber-500 border border-amber-500/20 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Meta Details */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>SYSTEM: SECURE</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="mt-1 text-[9px] text-zinc-600 leading-relaxed font-mono">
          v1.0.4-dev // Operational
        </p>
      </div>
    </aside>
  );
}
