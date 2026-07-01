/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Brand, Account } from '../types';
import { ChevronDown, CheckCircle2, AlertCircle, Sparkles, User, LogOut, Check } from 'lucide-react';

interface HeaderProps {
  brands: Brand[];
  selectedBrand: Brand;
  onSelectBrand: (brand: Brand) => void;
  onNavigateToTab: (tab: 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more') => void;
  connectedAccounts: Account[];
  currentTab: string;
}

export default function Header({
  brands,
  selectedBrand,
  onSelectBrand,
  onNavigateToTab,
  connectedAccounts,
  currentTab
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur-md md:px-8" id="spark-app-header">
      {/* Brand Context / Selector */}
      <div className="relative flex items-center gap-3">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="group flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1.5 pr-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900"
          id="brand-selector-btn"
        >
          <img
            src={selectedBrand.avatarUrl}
            alt={selectedBrand.name}
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-zinc-700 transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 font-display">OPERATING BRAND</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-zinc-100">{selectedBrand.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-transform group-hover:translate-y-0.5" />
            </div>
          </div>
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-14 left-0 z-50 w-64 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl animate-fade-in" id="brand-selector-dropdown">
              <div className="px-3 py-2 text-xs font-semibold tracking-wider text-zinc-500 font-display">SWITCH ACTIVE BRAND</div>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => {
                    onSelectBrand(brand);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors ${
                    brand.id === selectedBrand.id
                      ? 'bg-zinc-800/80 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img src={brand.avatarUrl} alt={brand.name} className="h-7 w-7 rounded object-cover" />
                    <div>
                      <div className="text-xs font-bold">{brand.name}</div>
                      <div className="text-[10px] text-zinc-500">{brand.handle}</div>
                    </div>
                  </div>
                  {brand.id === selectedBrand.id && <Check className="h-4 w-4 text-amber-500" />}
                </button>
              ))}
              <div className="my-1 border-t border-zinc-800" />
              <button
                onClick={() => {
                  onNavigateToTab('my-spark');
                  setDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Configure active brand brain
              </button>
            </div>
          </>
        )}

        {/* Brand identity short link */}
        <button
          onClick={() => onNavigateToTab('my-spark')}
          className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide transition-all sm:flex ${
            currentTab === 'my-spark'
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
          title="Manage AI Personality & Memory Guide"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
          Brain Guide: <span className="text-zinc-200">{selectedBrand.character.name}</span>
        </button>
      </div>

      {/* Connection status and Profile */}
      <div className="flex items-center gap-4">
        {/* Connection status rail */}
        <div className="hidden items-center gap-3.5 rounded-xl border border-zinc-850 bg-zinc-900/40 px-3 py-1.5 lg:flex">
          <span className="text-[10px] font-bold tracking-wider text-zinc-500 font-mono">CHANNELS</span>
          {connectedAccounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-1.5"
              title={`${acc.username} (${acc.platform === 'tiktok' ? 'TikTok' : acc.platform === 'instagram_reels' ? 'Instagram Reels' : 'YouTube Shorts'})`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${acc.connected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-medium text-zinc-400 font-mono capitalize">
                {acc.platform.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>

        {/* User Account Controls */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            id="user-profile-btn"
          >
            <User className="h-4 w-4 text-zinc-400" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute top-11 right-0 z-50 w-56 rounded-xl border border-zinc-850 bg-zinc-900 p-1.5 shadow-2xl" id="user-profile-menu">
                <div className="px-3 py-2">
                  <div className="text-xs font-bold text-zinc-200">Maurice Ogiso</div>
                  <div className="text-[10px] text-zinc-500">mauriceogiso@gmail.com</div>
                </div>
                <div className="my-1 border-t border-zinc-800" />
                <button
                  onClick={() => {
                    onNavigateToTab('more');
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <User className="h-3.5 w-3.5" />
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    alert("This is a simulated demo of SPARK Media OS.");
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
