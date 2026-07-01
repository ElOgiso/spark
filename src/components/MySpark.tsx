/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { Brand, Memory } from '../types';
import { Brain, User, Target, Save, CheckCircle, Trash2, Plus, Sparkles } from 'lucide-react';

interface MySparkProps {
  brand: Brand;
  memories: Memory[];
  onUpdateCharacter: (character: Brand['character']) => void;
  onAddMemory: (topic: string, fact: string) => void;
  onDeleteMemory: (id: string) => void;
}

export default function MySpark({
  brand,
  memories,
  onUpdateCharacter,
  onAddMemory,
  onDeleteMemory
}: MySparkProps) {
  // Local edit states
  const [charName, setCharName] = useState(brand.character.name);
  const [charRole, setCharRole] = useState(brand.character.role);
  const [targetAudience, setTargetAudience] = useState(brand.character.targetAudience);
  const [newMemoryTopic, setNewMemoryTopic] = useState('');
  const [newMemoryFact, setNewMemoryFact] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'niche' | 'brain'>('persona');

  const handleSaveCharacter = () => {
    onUpdateCharacter({
      ...brand.character,
      name: charName,
      role: charRole,
      targetAudience: targetAudience
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCreateMemory = (e: FormEvent) => {
    e.preventDefault();
    if (!newMemoryTopic || !newMemoryFact) return;
    onAddMemory(newMemoryTopic, newMemoryFact);
    setNewMemoryTopic('');
    setNewMemoryFact('');
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-myspark-tab">
      {/* Tab Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
          MY SPARK
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          The autonomous identity engine and memory parameters of <span className="text-amber-500 font-semibold">{brand.name}</span>.
        </p>
      </div>

      {/* Selector Subtabs */}
      <div className="flex border-b border-zinc-850">
        <button
          onClick={() => setActiveSubTab('persona')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold tracking-wider transition-all ${
            activeSubTab === 'persona'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <User className="h-4 w-4" />
          PERSONA GUIDES
        </button>
        <button
          onClick={() => setActiveSubTab('niche')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold tracking-wider transition-all ${
            activeSubTab === 'niche'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Target className="h-4 w-4" />
          CONTENT NICHE & PILLARS
        </button>
        <button
          onClick={() => setActiveSubTab('brain')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold tracking-wider transition-all ${
            activeSubTab === 'brain'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Brain className="h-4 w-4" />
          SYNTHESIZED MEMORY BRAIN
        </button>
      </div>

      {/* Main Subtab Contents */}
      <div className="grid gap-6">
        {activeSubTab === 'persona' && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left: Persona Inputs */}
            <div className="flex flex-col gap-5 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-8">
              <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display">CHARACTER PARAMETERS</h2>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 font-mono">CHARACTER NAME</label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 font-mono">CORE MISSION & ROLE</label>
                <textarea
                  value={charRole}
                  onChange={(e) => setCharRole(e.target.value)}
                  rows={3}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 font-mono">TARGET AUDIENCE DEMOGRAPHIC</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveCharacter}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold tracking-wider text-zinc-950 transition-all hover:bg-zinc-200 active:scale-98"
                >
                  <Save className="h-4 w-4" />
                  {isSaved ? 'SAVED IDENTITY BRAIN!' : 'UPDATE IDENTITY BRAIN'}
                </button>
              </div>
            </div>

            {/* Right: Read-only Tone & style guidelines */}
            <div className="flex flex-col gap-5 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-4">
              <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display">IDENTITY TONE RULES</h2>
              
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-500 font-mono">TONE OF VOICE</h3>
                <div className="flex flex-wrap gap-2">
                  {brand.character.toneOfVoice.map((tone, idx) => (
                    <span key={idx} className="rounded-lg bg-zinc-850 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-800">
                      {tone}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <h3 className="text-xs font-bold text-zinc-500 font-mono">VISUAL LANGUAGE DIRECTIVE</h3>
                <p className="text-xs text-zinc-400 leading-relaxed rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                  {brand.character.visualStyle}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'niche' && (
          <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display mb-4">BRAND DISCOVERY BOUNDS</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 font-mono">CORE TARGET TOPIC</h3>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">{brand.niche.topic}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 font-mono">INDUSTRY DIRECTORY</h3>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">{brand.niche.industry}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-zinc-500 font-mono mb-2.5">CONTENT PILLARS</h3>
                <div className="flex flex-col gap-2">
                  {brand.niche.pillars.map((pillar, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/10 text-xs font-mono font-bold text-amber-500">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300">{pillar}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'brain' && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Memory List (8 Cols) */}
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-8">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display">SAVED EMPIRICAL MEMORIES</h2>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 font-mono">
                  {memories.length} FACTS KNOWN
                </span>
              </div>

              {memories.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500 font-mono">No feedback memory nodes compiled yet.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {memories.map((mem) => (
                    <div key={mem.id} className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/30 p-3.5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                          <Brain className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div>
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400 font-mono uppercase">
                            {mem.topic}
                          </span>
                          <p className="mt-1.5 text-xs font-medium text-zinc-300 leading-relaxed">{mem.learnedFact}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-zinc-500 font-mono">
                            <span className="text-emerald-500 font-semibold">• Tested Hypothesis</span>
                            <span>•</span>
                            <span>Updated {new Date(mem.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="text-zinc-600 transition-colors hover:text-rose-400 p-1"
                        title="Delete memory cell"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Memory Injector (4 Cols) */}
            <form onSubmit={handleCreateMemory} className="flex flex-col gap-4 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm lg:col-span-4">
              <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display">INJECT DIRECTIVE RULE</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Manually bypass autonomous learning by hardcoding rules directly into the character script.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">CATEGORY / TOPIC</label>
                <input
                  type="text"
                  value={newMemoryTopic}
                  onChange={(e) => setNewMemoryTopic(e.target.value)}
                  placeholder="e.g. Vocabulary Filter, Visual Pacing"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 font-mono">HARD RULE FACT</label>
                <textarea
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  placeholder="e.g. Never use zoom-in cuts larger than 1.2x. Refuse any scripts mentioning 'revolution'."
                  rows={4}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-md transition-all hover:bg-amber-600 active:scale-98"
              >
                <Plus className="h-4 w-4" />
                INJECT FACT
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
