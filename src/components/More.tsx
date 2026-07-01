/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { Account, Asset } from '../types';
import { Settings, Link, Check, Plus, AlertCircle, Trash2, Sliders, FolderOpen, Heart, HelpCircle } from 'lucide-react';

interface MoreProps {
  connectedAccounts: Account[];
  assets: Asset[];
  onConnectAccount: (platform: Account['platform'], username: string) => void;
  onDisconnectAccount: (id: string) => void;
  onNavigateToTab: (tab: 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more') => void;
}

export default function More({
  connectedAccounts,
  assets,
  onConnectAccount,
  onDisconnectAccount,
  onNavigateToTab
}: MoreProps) {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [platformToConnect, setPlatformToConnect] = useState<Account['platform']>('tiktok');
  const [usernameInput, setUsernameInput] = useState('');

  const handleConnectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!usernameInput) return;
    
    // Normalize handles
    const formattedUser = usernameInput.startsWith('@') ? usernameInput : `@${usernameInput}`;
    onConnectAccount(platformToConnect, formattedUser);
    setUsernameInput('');
    setShowConnectModal(false);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-more-tab">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
          SYSTEM CONSOLE & MORE
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage connected accounts, asset libraries, and system preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connected Accounts Section */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono">CONNECTED ACCOUNTS</h2>
              <button
                onClick={() => setShowConnectModal(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 font-mono"
              >
                <Plus className="h-3 w-3" />
                CONNECT CHANNEL
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {connectedAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${acc.connected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-zinc-600'}`} />
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{acc.username}</div>
                      <div className="text-[10px] text-zinc-500 font-mono capitalize">
                        {acc.platform.replace('_', ' ')} • {acc.followersCount.toLocaleString()} Followers
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onDisconnectAccount(acc.id)}
                    className="text-[10px] font-bold text-zinc-600 hover:text-rose-400 font-mono transition-colors"
                  >
                    DISCONNECT
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-[10px] text-zinc-500 leading-relaxed font-mono">
            * SPARK interacts with accounts locally by exporting production assets. No real-world OAuth authorization is binding in MVP mode.
          </div>
        </div>

        {/* Brand Assets directory Section */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
          <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-4">SYSTEM ASSETS DIRECTORY</h2>
          
          <div className="flex flex-col gap-3">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-zinc-300">{asset.name}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5">
                      Type: {asset.type.replace('_', ' ')} • Size: {asset.size}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-zinc-600 uppercase font-bold">READY</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System info license block */}
      <div className="rounded-2xl border border-zinc-850 bg-zinc-900/20 p-5 backdrop-blur-sm">
        <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono mb-3">SPARK OPERATING SPECIFICATION</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          SPARK is developed as an AI-native Media Operating System. In contrast to legacy AI prompts generators or content hubs, SPARK discovers structural trends organically, designs persona-paired templates, aggregates live feed performance diagnostics, and writes persistent lessons back to the operating brain directory automatically.
        </p>

        <div className="mt-5 border-t border-zinc-850/50 pt-4 flex flex-wrap gap-4 text-[10px] text-zinc-500 font-mono">
          <div>LICENSE STATUS: <span className="text-emerald-500 font-semibold">ACTIVE DEV SUITE</span></div>
          <div>•</div>
          <div>REGISTERED TO: <span className="text-zinc-400 font-medium">mauriceogiso@gmail.com</span></div>
          <div>•</div>
          <div>HOST URL: <span className="text-zinc-400 font-medium">ais-dev-...run.app</span></div>
        </div>
      </div>

      {/* Modal Overlay for Account Connection */}
      {showConnectModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowConnectModal(false)} />
          <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl animate-fade-in">
            <h3 className="text-sm font-bold tracking-wider text-zinc-200 font-display mb-3">CONNECT BRAND CHANNEL</h3>
            
            <form onSubmit={handleConnectSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">PLATFORM SELECT</label>
                <select
                  value={platformToConnect}
                  onChange={(e) => setPlatformToConnect(e.target.value as any)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                  <option value="instagram_reels">Instagram Reels</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">CHANNEL USERNAME / HANDLE</label>
                <input
                  type="text"
                  placeholder="e.g. mindfulness_tok"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-950/40 py-2.5 text-xs font-bold text-zinc-400 hover:bg-zinc-950"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-600 shadow-md"
                >
                  CONFIRM CONNECT
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
