/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tab } from '../types';
import { Zap, Flame, ClipboardCheck, BarChart3, Settings } from 'lucide-react';

interface BottomNavProps {
  currentTab: Tab;
  onSelectTab: (tab: Tab) => void;
  pendingReviewCount: number;
}

export default function BottomNav({ currentTab, onSelectTab, pendingReviewCount }: BottomNavProps) {
  const mobileTabs = [
    { id: 'spark' as Tab, label: 'SPARK', icon: Zap },
    { id: 'viral-sparks' as Tab, label: 'VIRALS', icon: Flame },
    { id: 'review' as Tab, label: 'REVIEW', icon: ClipboardCheck, badge: pendingReviewCount },
    { id: 'analytics' as Tab, label: 'STATS', icon: BarChart3 },
    { id: 'more' as Tab, label: 'MORE', icon: Settings }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-850 bg-zinc-950/90 pb-safe px-2 py-1.5 backdrop-blur-lg md:hidden" id="mobile-bottom-nav">
      <div className="flex items-center justify-around">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id || (tab.id === 'more' && (currentTab === 'calendar' || currentTab === 'my-spark'));
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-1 px-3 text-center"
              style={{ minWidth: '64px', minHeight: '48px' }}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'text-amber-500 scale-110' : 'text-zinc-500'}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-zinc-950">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`mt-1 text-[9px] font-bold tracking-wider font-display ${isActive ? 'text-amber-500' : 'text-zinc-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
