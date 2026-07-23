import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Zap,
  Sliders,
  CheckCircle2,
  Cpu,
  Brain,
  Video,
  BarChart3,
  Share2,
} from "lucide-react";

type DesktopLandingPageProps = {
  onEnterSpark: () => void;
};

export function DesktopLandingPage({ onEnterSpark }: DesktopLandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-blue-600 selection:text-white antialiased">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Spark</span>
          <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-0.5 rounded-full">
            Media OS
          </span>
        </div>

        <nav className="hidden md:flex items-center space-x-8 text-xs font-medium text-muted-foreground">
          <a href="#philosophy" className="hover:text-foreground transition-colors">Philosophy</a>
          <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
          <a href="#departments" className="hover:text-foreground transition-colors">Departments</a>
          <a href="#autonomy" className="hover:text-foreground transition-colors">Autonomy</a>
        </nav>

        <button
          type="button"
          onClick={onEnterSpark}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center space-x-2"
        >
          <span>Enter Spark</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-8 max-w-6xl mx-auto text-center space-y-8">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-950/40 border border-blue-500/30 text-xs text-blue-300"
        >
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>The World's First Creative Operating System</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight"
        >
          Not a generator. <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            A Creative Operating System.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Spark orchestrates specialized creative departments, executes autonomous multi-agent pipelines, and builds long-term brand memory across every production.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center space-x-4 pt-4"
        >
          <button
            type="button"
            onClick={onEnterSpark}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3.5 rounded-xl shadow-xl shadow-blue-600/25 active:scale-95 transition-all text-sm flex items-center space-x-2"
          >
            <span>Initialize Your Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#philosophy"
            className="bg-card border border-border hover:bg-card/80 text-foreground font-medium px-6 py-3.5 rounded-xl text-sm transition-all"
          >
            Explore Philosophy
          </a>
        </motion.div>
      </section>

      {/* Core Philosophy Section */}
      <section id="philosophy" className="py-20 px-8 border-t border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400">Core Philosophy</h2>
            <h3 className="text-3xl font-bold tracking-tight">Built on the Executive Director Paradigm</h3>
            <p className="text-xs text-muted-foreground">
              Traditional AI tools rely on static prompts and single-file generation. Spark operates like an executive director overseeing a full media company.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Brain className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold">Persistent Brand Memory</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spark remembers your brand voice, character parameters, niche preferences, and past performance analytics across every production.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold">Multi-Agent Orchestration</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Autonomous agents in Research, Storyboarding, Generation, Editing, and Publishing collaborate under unified executive policy controls.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold">Autonomous Production Engine</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                From identifying viral opportunities to scheduling cross-platform distribution, Spark powers your entire creator workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Operating System Architecture Section */}
      <section id="architecture" className="py-20 px-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400">Architecture</h2>
            <h3 className="text-3xl font-bold tracking-tight">The 6 Core Pipeline Engine Modules</h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Research Engine", desc: "Monitors trend velocity & viral opportunities", icon: Cpu },
              { name: "Creative Department", desc: "Generates script hooks & narrative arcs", icon: Brain },
              { name: "Production & Storyboard", desc: "Assembles visual scenes & character mesh", icon: Video },
              { name: "Editing Intelligence", desc: "Applies pacing & audio synthesis rules", icon: Layers },
              { name: "Publishing Channels", desc: "Schedules post distribution per platform", icon: Share2 },
              { name: "Analytics & Learning", desc: "Extracts retention metrics to refine memory", icon: BarChart3 },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <div key={mod.name} className="p-5 rounded-2xl bg-card/60 border border-border/80 flex items-start space-x-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{mod.name}</h4>
                    <p className="text-xs text-muted-foreground pt-0.5">{mod.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Executive Director Autonomy Section */}
      <section id="autonomy" className="py-20 px-8 border-t border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400">Autonomy</h2>
            <h3 className="text-3xl font-bold tracking-tight">Granular Operating Autonomy</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                <Sliders className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Manual Mode</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spark requests explicit user confirmation before every major creative, editing, or distribution decision.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-blue-500/40 bg-blue-950/10 space-y-2 relative">
              <span className="absolute top-4 right-4 text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">Recommended</span>
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                <Shield className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Balanced Mode</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spark creates scripts, storyboards, and edits independently, submitting finalized packages for fast approval.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Autonomous Mode</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spark acts as an autonomous media company, continuously researching trends, producing content, and scheduling posts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Placeholder */}
      <section className="py-20 px-8 border-t border-border/50">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400">Executive Endorsements</h2>
          <blockquote className="text-xl font-medium italic text-foreground max-w-2xl mx-auto leading-relaxed">
            "Spark fundamentally redefined our media output. We stopped fighting disjointed tools and started operating a cohesive AI studio."
          </blockquote>
          <p className="text-xs text-muted-foreground font-mono">— Creator Empire Studio Lead</p>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-20 px-8 border-t border-border/50 bg-gradient-to-b from-card/30 to-background text-center space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Ready to Initialize Your Creative OS?</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Set up your brand parameters, character visual mesh, and voice archetype in minutes.
        </p>
        <button
          type="button"
          onClick={onEnterSpark}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl shadow-2xl shadow-blue-600/30 active:scale-95 transition-all text-sm inline-flex items-center space-x-2"
        >
          <span>Launch Spark Studio</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 border-t border-border/50 text-center text-xs text-muted-foreground flex items-center justify-between max-w-6xl mx-auto">
        <span>© 2026 Spark Media OS. All rights reserved.</span>
        <div className="flex space-x-6">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Security</span>
        </div>
      </footer>
    </div>
  );
}
