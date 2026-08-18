import { useState, useEffect } from "react";
import { BrandGenesisMobile } from "./BrandGenesisMobile";
import {
  Zap, Brain, TrendingUp, CheckSquare, Calendar, BarChart3,
  MoreHorizontal, LogOut, Settings, Eye, DollarSign, Video,
  Tv, Clapperboard, ArrowRight, Flame, AlertCircle, CheckCircle2,
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, Star, Play, Clock,
  Users, Target, Lightbulb, Shield, Layers, RefreshCw, Filter,
  Plus, X, Check, Inbox, Activity, PieChart,
  Key, Cpu, Palette, HelpCircle, FileText, Link, CreditCard,
} from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_BRAND = { name: "CreatorOS Studio", handle: "@creatorosstudio" };

const MOCK_PRODUCTIONS = [
  { id: "p1", title: "10 Productivity Hacks That Changed My Life", status: "Ready for Review", score: 94 },
  { id: "p2", title: "Why AI Will Replace 90% of Content Jobs", status: "Drafting", score: 87 },
  { id: "p3", title: "The Algorithm Secret Nobody Talks About", status: "Approved", score: 91 },
  { id: "p4", title: "Morning Routine of a 7-Figure Creator", status: "Scheduled", score: 88 },
  { id: "p5", title: "How I Gained 100K Followers in 30 Days", status: "Published", score: 96 },
];

const MOCK_VIRAL_SPARKS = [
  { id: "v1", title: "AI Tools Every Creator Must Use in 2025", score: 97, format: "Short-form", window: "24h", risk: "Low", platform: "TikTok / Reels" },
  { id: "v2", title: "Silent Quitting Side Hustle Trend Analysis", score: 91, format: "Long-form", window: "48h", risk: "Low", platform: "YouTube" },
  { id: "v3", title: "Gen Z vs Millennial Content Strategy", score: 88, format: "Short-form", window: "72h", risk: "Medium", platform: "All Platforms" },
];

const MOCK_REVIEWS = [
  { id: "r1", title: "10 Productivity Hacks That Changed My Life", status: "Pending Review", platform: "TikTok" },
  { id: "r2", title: "The Algorithm Secret Nobody Talks About", status: "Approved", platform: "YouTube" },
];

const MOCK_ACCOUNTS = [
  { id: "a1", platform: "tiktok", username: "@creatorosstudio", followers: 84200, connected: true },
  { id: "a2", platform: "youtube_shorts", username: "CreatorOS Studio", followers: 31500, connected: true },
  { id: "a3", platform: "instagram_reels", username: "@creatorosstudio", followers: 22100, connected: false },
];

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { name: "Spark", icon: Zap, path: "/" },
  { name: "My Spark", icon: Brain, path: "/my-spark" },
  { name: "Viral Sparks", icon: TrendingUp, path: "/viral-sparks" },
  { name: "Review", icon: CheckSquare, path: "/review" },
  { name: "Calendar", icon: Calendar, path: "/calendar" },
  { name: "Analytics", icon: BarChart3, path: "/analytics" },
  { name: "More", icon: MoreHorizontal, path: "/more" },
];

function SparkLogoMark({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M18 2L6 18h10l-2 12 14-16H18L18 2z" fill="url(#sg)" />
    </svg>
  );
}

function Navigation({ currentPath, onNavigate }: { currentPath: string; onNavigate: (p: string) => void }) {
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/review") return currentPath.startsWith("/review");
    if (path === "/more") return currentPath.startsWith("/more");
    return currentPath === path;
  };

  return (
    <nav className="w-56 h-screen bg-nav-background border-r border-border flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <SparkLogoMark className="w-8 h-8 flex-shrink-0" />
          <h1 className="text-lg font-bold text-foreground tracking-tight">Spark</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">Media Operating System</p>
      </div>

      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.name}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                active
                  ? "bg-accent/20 text-nav-active font-semibold"
                  : "text-nav-foreground hover:bg-nav-hover hover:text-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-accent" : ""}`} />
              <span className="text-sm">{item.name}</span>
              {active && <div className="ml-auto w-1 h-4 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border/50 relative">
        <button
          onClick={() => setProfileOpen((p) => !p)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-nav-hover transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-200 text-xs font-bold border border-purple-500/30 flex-shrink-0">
            CS
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Creator Studio</p>
            <p className="text-[10px] text-muted-foreground truncate">Pro Plan · Active</p>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        {profileOpen && (
          <div className="absolute bottom-16 left-3 right-3 bg-popover border border-border rounded-xl p-2 shadow-2xl z-50 space-y-1">
            <button
              onClick={() => { setProfileOpen(false); onNavigate("/more"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-nav-hover text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

function TopBar({ pageName, onNavigate }: { pageName: string; onNavigate: (p: string) => void }) {
  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-shrink-0 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{pageName}</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground w-52">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Search anything…</span>
        </div>
        <button className="relative p-2 rounded-lg hover:bg-nav-hover transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>
        <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-200">
          CS
        </div>
      </div>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  title, value, subtitle, icon, onClick,
}: {
  title: string; value: string; subtitle: string;
  icon: React.ReactNode; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/40 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{title}</span>
        <span className="text-muted-foreground group-hover:text-accent transition-colors">{icon}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </button>
  );
}

// ─── SparkHome ────────────────────────────────────────────────────────────────

function SparkHome({ onNavigate }: { onNavigate: (p: string) => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  const pendingReviews = MOCK_REVIEWS.filter((r) => r.status === "Pending Review");
  const approvedCount = MOCK_PRODUCTIONS.filter((p) => p.status === "Approved").length;

  const pipeline = [
    { stage: "Drafting", count: MOCK_PRODUCTIONS.filter(p => p.status === "Drafting").length, color: "text-muted-foreground", bar: "bg-muted-foreground/40", path: "/review" },
    { stage: "Ready", count: MOCK_PRODUCTIONS.filter(p => p.status === "Ready for Review").length, color: "text-warning", bar: "bg-warning", path: "/review" },
    { stage: "Approved", count: approvedCount, color: "text-success", bar: "bg-success", path: "/review" },
    { stage: "Scheduled", count: MOCK_PRODUCTIONS.filter(p => p.status === "Scheduled").length, color: "text-accent-foreground", bar: "bg-accent", path: "/calendar" },
    { stage: "Published", count: MOCK_PRODUCTIONS.filter(p => p.status === "Published").length, color: "text-muted-foreground", bar: "bg-muted-foreground/40", path: "/analytics" },
  ];

  const metrics = [
    { title: "Monthly Views", value: "284K", icon: <Eye className="w-3.5 h-3.5" />, subtitle: "Live views", path: "/analytics" },
    { title: "Revenue", value: "$3,840", icon: <DollarSign className="w-3.5 h-3.5" />, subtitle: "Est. this month", path: "/analytics" },
    { title: "Growth Rate", value: "+18.4%", icon: <TrendingUp className="w-3.5 h-3.5" />, subtitle: "vs last month", path: "/analytics" },
    { title: "Published", value: "12", icon: <Video className="w-3.5 h-3.5" />, subtitle: "This month", path: "/analytics" },
    { title: "Accounts", value: "3", icon: <Tv className="w-3.5 h-3.5" />, subtitle: "Connected", path: "/more/accounts" },
    { title: "Productions", value: String(MOCK_PRODUCTIONS.length), icon: <Clapperboard className="w-3.5 h-3.5" />, subtitle: "Active", path: "/review" },
  ];

  return (
    <>
      <TopBar pageName="Spark" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">

          {/* Command Briefing */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-8 pt-7 pb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-2xl font-medium">{greeting}, Creator Studio</h1>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-xs text-accent-foreground font-medium hover:bg-accent/25 transition-colors">
                    <Zap className="w-3 h-3" />
                    Ask Spark AI
                  </button>
                </div>
                <div className="flex items-center gap-x-3 gap-y-2 flex-wrap mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    Spark Active
                  </span>
                  <span className="text-xs bg-accent/15 px-2.5 py-1 rounded-full border border-accent/20 text-accent-foreground">
                    💡 <span className="font-medium">Discovered:</span> {MOCK_VIRAL_SPARKS.length} opportunities
                  </span>
                  <span className="text-xs bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20 text-warning">
                    ⚠️ <span className="font-medium">Attention:</span> {pendingReviews.length} reviews waiting
                  </span>
                  <span className="text-xs bg-success/10 px-2.5 py-1 rounded-full border border-success/25 text-success">
                    ✓ <span className="font-medium">Ready:</span> {approvedCount} ready
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{today}</p>
                <button
                  onClick={() => onNavigate("/my-spark")}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <Brain className="w-3.5 h-3.5" />
                  {MOCK_BRAND.name}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Priority items */}
            <div className="border-t border-border/60">
              {pendingReviews.length > 0 && (
                <div className="flex items-center gap-5 px-8 py-4 border-l-[3px] border-l-warning bg-warning/5 border-b border-border/40">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-warning mb-0.5">{pendingReviews.length} creative review{pendingReviews.length !== 1 ? "s" : ""} waiting</p>
                    <p className="text-sm text-muted-foreground truncate">"{pendingReviews[0].title}" · Awaiting your approval</p>
                  </div>
                  <button
                    onClick={() => onNavigate("/review")}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-background/60 hover:bg-background border border-border/60 text-sm font-medium transition-all"
                  >
                    Review Now <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-5 px-8 py-4 border-l-[3px] border-l-destructive bg-destructive/5">
                <Flame className="w-4 h-4 text-destructive flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-destructive mb-0.5">{MOCK_VIRAL_SPARKS.length} opportunities detected</p>
                  <p className="text-sm text-muted-foreground truncate">"{MOCK_VIRAL_SPARKS[0].title}" · Ready for production</p>
                </div>
                <button
                  onClick={() => onNavigate("/viral-sparks")}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-background/60 hover:bg-background border border-border/60 text-sm font-medium transition-all"
                >
                  Create Production <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Strategic Briefing */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Executive Strategic Briefing</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Why Spark Recommends Acting Now</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your connected channels show 284K monthly views with 18.4% growth. Current viral windows on AI Tools and Creator Economy content are peaking — producing in the next 24–48 hours maximizes reach potential. Engagement signals indicate your audience is most active Wed–Fri 6–9 PM.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Expected Outcome", value: "High engagement velocity — 40–60% above baseline", icon: Target, color: "text-success" },
                  { label: "Confidence Level", value: "High — 84%", icon: Shield, color: "text-accent" },
                  { label: "Risk Assessment", value: "Low — brand-aligned content", icon: CheckCircle2, color: "text-warning" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted/20 border border-border/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      <span className={`text-xs font-medium uppercase tracking-wide ${item.color}`}>{item.label}</span>
                    </div>
                    <p className="text-sm text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Production Pipeline */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Production Pipeline</h2>
              <button onClick={() => onNavigate("/review")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card px-6 py-4">
              <div className="flex items-center gap-0">
                {pipeline.map((stage, i) => (
                  <button key={stage.stage} onClick={() => onNavigate(stage.path)} className="flex-1 group">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-full h-1 rounded-full ${stage.bar}`} />
                      <span className={`text-2xl font-medium ${stage.color} group-hover:scale-110 transition-transform`}>{stage.count}</span>
                      <span className="text-xs text-muted-foreground">{stage.stage}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Hot Viral Sparks */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hot Viral Sparks</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Spark found these opportunities for your brand today</p>
              </div>
              <button onClick={() => onNavigate("/viral-sparks")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                All opportunities <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {MOCK_VIRAL_SPARKS.map((spark) => (
                <div key={spark.id} className="rounded-xl border border-border bg-card p-5 hover:border-accent/40 hover:shadow-xl hover:shadow-black/10 transition-all duration-200 group flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-warning" />
                      <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">{spark.window} window</span>
                    </div>
                    <span className={`text-sm font-semibold ${spark.score >= 92 ? "text-success" : "text-warning"}`}>{spark.score}%</span>
                  </div>
                  <h3 className="text-sm font-medium leading-snug mb-2 flex-1">{spark.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{spark.platform}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground">{spark.format}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${spark.risk === "Low" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{spark.risk} risk</span>
                  </div>
                  <button
                    onClick={() => onNavigate("/viral-sparks")}
                    className="w-full py-2.5 rounded-lg bg-accent/20 hover:bg-accent/40 text-sm font-medium transition-all flex items-center justify-center gap-2 group-hover:bg-foreground group-hover:text-background"
                  >
                    <Zap className="w-3.5 h-3.5" /> Create Production
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Spark Intelligence */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spark Intelligence</h2>
              <p className="text-xs text-muted-foreground">Generated 6:00 AM · Refreshed 12m ago</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  {
                    type: "Top Opportunities", color: "text-success", bg: "bg-success/10", border: "border-success/20",
                    items: ["AI Tools trend peaking — 97% match with your niche", "Creator economy content up 34% engagement this week", "3 topics awaiting production before window closes"],
                  },
                  {
                    type: "Audience Signal", color: "text-accent-foreground", bg: "bg-accent/10", border: "border-accent/30",
                    items: ["Peak engagement Wed–Fri 6–9 PM in your timezone", "Short-form (60–90s) outperforming long-form 2.1×", "Tutorial hooks driving 40% higher retention rate"],
                  },
                  {
                    type: "Needs Attention", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20",
                    items: ["1 creative review pending — 24h SLA approaching", "Instagram Reels account not connected", "Captions missing on last 2 published videos"],
                  },
                  {
                    type: "Recommended Actions", color: "text-foreground", bg: "bg-muted/20", border: "border-border/50",
                    items: ["Produce AI Tools video before 24h window closes", "Connect Instagram Reels to expand distribution", "Review and approve pending creative"],
                  },
                ].map((section) => (
                  <div key={section.type} className={`rounded-xl border p-5 ${section.bg} ${section.border}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${section.color}`}>{section.type}</p>
                    <div className="space-y-2.5">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Performance Metrics */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Performance Overview</h2>
              <button onClick={() => onNavigate("/analytics")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                View Analytics <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {metrics.map((m) => (
                <MetricCard key={m.title} title={m.title} value={m.value} subtitle={m.subtitle} icon={m.icon} onClick={() => onNavigate(m.path)} />
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Recent Activity</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-4">
                {[
                  { icon: CheckCircle2, color: "text-success", title: "Production Published", desc: '"How I Gained 100K Followers in 30 Days" · TikTok · 12.4K views', time: "2h ago" },
                  { icon: AlertCircle, color: "text-warning", title: "Review Requested", desc: '"10 Productivity Hacks That Changed My Life" · Awaiting approval', time: "4h ago" },
                  { icon: Flame, color: "text-destructive", title: "Opportunity Detected", desc: '"AI Tools Every Creator Must Use in 2025" · 97% viral score', time: "6h ago" },
                  { icon: Play, color: "text-accent-foreground", title: "Production Approved", desc: '"The Algorithm Secret Nobody Talks About" · Scheduled for Friday', time: "1d ago" },
                  { icon: RefreshCw, color: "text-muted-foreground", title: "Intelligence Refresh", desc: "Daily Spark briefing updated · 3 new opportunities indexed", time: "1d ago" },
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 mt-0.5 ${a.color}`}>
                      <a.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{a.desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}

// ─── Viral Sparks Page ────────────────────────────────────────────────────────

function ViralSparksPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [filter, setFilter] = useState("all");

  return (
    <>
      <TopBar pageName="Viral Sparks" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Viral Opportunity Radar</h1>
              <p className="text-sm text-muted-foreground mt-1">Real-time trending signals matched to your brand voice and niche</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh Signals
            </button>
          </div>

          <div className="flex items-center gap-2">
            {["all", "short-form", "long-form", "trending"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? "bg-accent text-accent-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {MOCK_VIRAL_SPARKS.map((spark) => (
              <div key={spark.id} className="rounded-xl border border-border bg-card p-6 hover:border-accent/40 hover:shadow-xl hover:shadow-black/10 transition-all duration-200 group flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-warning">{spark.window} window</span>
                      <p className="text-[10px] text-muted-foreground">{spark.platform}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${spark.score >= 92 ? "text-success" : "text-warning"}`}>{spark.score}%</span>
                    <p className="text-[10px] text-muted-foreground">viral score</p>
                  </div>
                </div>

                <h3 className="text-sm font-semibold leading-snug mb-3 flex-1">{spark.title}</h3>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2 py-1 rounded-lg bg-muted/40 text-muted-foreground">{spark.format}</span>
                  <span className={`text-xs px-2 py-1 rounded-lg ${spark.risk === "Low" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {spark.risk} risk
                  </span>
                </div>

                <div className="rounded-lg bg-muted/20 p-3 mb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Strong signal alignment with your creator economy niche. Hook structure matches your highest-performing content patterns.
                  </p>
                </div>

                <button className="w-full py-2.5 rounded-lg bg-accent/20 hover:bg-accent text-sm font-medium transition-all flex items-center justify-center gap-2 hover:text-accent-foreground">
                  <Zap className="w-3.5 h-3.5" /> Launch Production
                </button>
              </div>
            ))}

            {/* Placeholder cards */}
            {[1, 2].map((n) => (
              <div key={n} className="rounded-xl border border-dashed border-border/60 bg-card/40 p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[280px]">
                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                  <Search className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scanning for opportunities</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Spark is indexing new viral signals in your niche</p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Review Center ────────────────────────────────────────────────────────────

function ReviewCenterPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const statuses = ["Pending Review", "Approved", "Rejected"] as const;
  const [activeStatus, setActiveStatus] = useState<string>("Pending Review");

  const items = [
    { id: "rc1", title: "10 Productivity Hacks That Changed My Life", status: "Pending Review", platform: "TikTok", score: 94, duration: "1:42", hook: "You're working 3x harder than you need to..." },
    { id: "rc2", title: "Why AI Will Replace 90% of Content Jobs", status: "Pending Review", platform: "YouTube Shorts", score: 87, duration: "0:58", hook: "The content creator extinction event is already happening..." },
    { id: "rc3", title: "The Algorithm Secret Nobody Talks About", status: "Approved", platform: "Instagram Reels", score: 91, duration: "1:15", hook: "I cracked the algorithm code after 200 posts..." },
    { id: "rc4", title: "Morning Routine of a 7-Figure Creator", status: "Approved", platform: "TikTok", score: 88, duration: "2:01", hook: "5 AM. No alarm. Here's what actually works..." },
  ];

  const filtered = items.filter(i => i.status === activeStatus);

  return (
    <>
      <TopBar pageName="Review Center" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Creative Review</h1>
              <p className="text-sm text-muted-foreground mt-1">Approve, edit, or reject AI-generated productions before publishing</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-lg px-4 py-2">
              <Clock className="w-4 h-4" />
              <span>SLA: 24h remaining</span>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-0 rounded-xl border border-border bg-card p-1">
            {statuses.map((s) => {
              const count = items.filter(i => i.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeStatus === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeStatus === s ? "bg-accent-foreground/20 text-accent-foreground" : "bg-muted/40"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No items in this status</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-card p-6 hover:border-accent/30 transition-all">
                  <div className="flex items-start gap-5">
                    <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-accent/30 to-primary/20 flex items-center justify-center flex-shrink-0">
                      <Play className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                          <p className="text-xs text-muted-foreground italic mb-2">"{item.hook}"</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground">{item.platform}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground">{item.duration}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.score >= 90 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                              Score: {item.score}%
                            </span>
                          </div>
                        </div>
                        {item.status === "Pending Review" && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <X className="w-3 h-3" /> Reject
                            </button>
                            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:bg-success/80 transition-colors">
                              <Check className="w-3 h-3" /> Approve
                            </button>
                          </div>
                        )}
                        {item.status === "Approved" && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

function AnalyticsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const platforms = [
    { name: "TikTok", views: "142K", followers: "84.2K", engagement: "6.4%", growth: "+22%", color: "text-pink-400" },
    { name: "YouTube Shorts", views: "89K", followers: "31.5K", engagement: "4.1%", growth: "+14%", color: "text-red-400" },
    { name: "Instagram Reels", views: "53K", followers: "22.1K", engagement: "3.8%", growth: "+8%", color: "text-purple-400" },
  ];

  const topContent = [
    { title: "How I Gained 100K Followers in 30 Days", views: "52K", platform: "TikTok", engagement: "8.2%" },
    { title: "10 Productivity Hacks That Changed My Life", views: "41K", platform: "YouTube", engagement: "7.6%" },
    { title: "AI Tools Every Creator Must Use in 2025", views: "38K", platform: "Instagram", engagement: "6.9%" },
    { title: "The Algorithm Secret Nobody Talks About", views: "29K", platform: "TikTok", engagement: "5.4%" },
  ];

  return (
    <>
      <TopBar pageName="Analytics" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1400px] mx-auto p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Performance Analytics</h1>
              <p className="text-sm text-muted-foreground mt-1">Cross-platform insights and growth metrics</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Filter className="w-3.5 h-3.5" /> Last 30 Days
              </button>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Total Views", value: "284K", change: "+18.4%", icon: Eye },
              { title: "Total Followers", value: "137.8K", change: "+12.1%", icon: Users },
              { title: "Avg Engagement", value: "4.8%", change: "+0.6pp", icon: Activity },
              { title: "Est. Revenue", value: "$3,840", change: "+24%", icon: DollarSign },
            ].map((m) => (
              <div key={m.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{m.title}</span>
                  <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-semibold">{m.value}</p>
                <p className="text-xs text-success mt-1">{m.change} vs last period</p>
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold">Views Over Time</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {["TikTok", "YouTube", "Instagram"].map((p, i) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-pink-400" : i === 1 ? "bg-red-400" : "bg-purple-400"}`} />
                    {p}
                  </div>
                ))}
              </div>
            </div>
            {/* Simplified chart visualization */}
            <div className="h-40 flex items-end gap-1.5 px-2">
              {[40, 55, 48, 70, 65, 82, 78, 90, 85, 95, 88, 100, 92, 108, 102, 115, 98, 120, 118, 130, 125, 142, 138, 150, 145, 160, 158, 170, 165, 180].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h / 1.8}%`, background: `oklch(0.65 0.27 ${295 + (i % 3) * 20} / ${0.6 + (i % 3) * 0.1})` }} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 px-2">
              <span>Jul 14</span><span>Jul 21</span><span>Jul 28</span><span>Aug 4</span><span>Aug 11</span>
            </div>
          </div>

          {/* Platform breakdown */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Platform Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {platforms.map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                      <Tv className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className={`text-xs font-semibold ${p.color}`}>{p.growth} growth</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Views", value: p.views },
                      { label: "Followers", value: p.followers },
                      { label: "Engagement", value: p.engagement },
                    ].map((stat) => (
                      <div key={stat.label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                        <span className="text-xs font-medium">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top performing content */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Top Performing Content</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {topContent.map((c, i) => (
                <div key={c.title} className={`flex items-center gap-4 px-6 py-4 ${i < topContent.length - 1 ? "border-b border-border/60" : ""}`}>
                  <span className="text-2xl font-bold text-muted-foreground/30 w-8 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.platform}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">{c.views}</p>
                    <p className="text-xs text-success">{c.engagement} engagement</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Calendar Page ────────────────────────────────────────────────────────────

function CalendarPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = [11, 12, 13, 14, 15, 16, 17];
  const today = 13;

  const events: Record<number, { title: string; platform: string; color: string }[]> = {
    14: [{ title: "AI Tools Video", platform: "TikTok", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" }],
    15: [
      { title: "Morning Routine", platform: "YouTube", color: "bg-red-500/20 text-red-300 border-red-500/30" },
      { title: "Algorithm Secret", platform: "Instagram", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    ],
    16: [{ title: "Side Hustle Trends", platform: "TikTok", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" }],
  };

  return (
    <>
      <TopBar pageName="Calendar" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1200px] mx-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Publishing Calendar</h1>
              <p className="text-sm text-muted-foreground mt-1">Schedule and manage your content publishing queue</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium">
              <Plus className="w-4 h-4" /> Schedule Post
            </button>
          </div>

          {/* Week header */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {days.map((d, i) => (
                <div key={d} className={`p-4 text-center ${dates[i] === today ? "bg-accent/10" : ""}`}>
                  <p className="text-xs text-muted-foreground mb-1">{d}</p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-medium ${dates[i] === today ? "bg-accent text-accent-foreground" : ""}`}>
                    {dates[i]}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 min-h-[200px]">
              {dates.map((d) => (
                <div key={d} className={`p-2 border-r border-border/40 last:border-0 ${d === today ? "bg-accent/5" : ""}`}>
                  <div className="space-y-1.5">
                    {(events[d] || []).map((e, i) => (
                      <div key={i} className={`rounded-md border px-2 py-1.5 text-[10px] font-medium ${e.color}`}>
                        <p className="truncate">{e.title}</p>
                        <p className="text-[9px] opacity-70">{e.platform}</p>
                      </div>
                    ))}
                    {d > today && !events[d] && (
                      <button className="w-full rounded-md border border-dashed border-border/40 py-2 text-[10px] text-muted-foreground/40 hover:border-accent/30 hover:text-accent transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming queue */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Upcoming Publications</h2>
            <div className="space-y-3">
              {[
                { title: "AI Tools Every Creator Must Use in 2025", platform: "TikTok", date: "Thu Aug 14 · 6:00 PM", status: "Scheduled" },
                { title: "Morning Routine of a 7-Figure Creator", platform: "YouTube Shorts", date: "Fri Aug 15 · 2:00 PM", status: "Scheduled" },
                { title: "The Algorithm Secret Nobody Talks About", platform: "Instagram Reels", date: "Fri Aug 15 · 7:00 PM", status: "Scheduled" },
                { title: "Silent Quitting Side Hustle Trend Analysis", platform: "TikTok", date: "Sat Aug 16 · 3:00 PM", status: "Pending Review" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Play className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.platform} · {item.date}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    item.status === "Scheduled" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── My Spark Page ────────────────────────────────────────────────────────────

function MySparkPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <>
      <TopBar pageName="My Spark" onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1200px] mx-auto p-8 space-y-8">
          <div>
            <h1 className="text-xl font-semibold">Brand Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">Your brand DNA, character, and strategic positioning</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Brand card */}
            <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-500/30 flex items-center justify-center">
                  <span className="text-xl font-bold text-purple-200">CS</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold">{MOCK_BRAND.name}</h2>
                  <p className="text-xs text-muted-foreground">{MOCK_BRAND.handle}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full mt-1 border border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Active
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Niche", value: "Creator Economy / Productivity" },
                  { label: "Tone", value: "Energetic & Educational" },
                  { label: "Mode", value: "Co-Pilot" },
                  { label: "Automation", value: "Approve Actions" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right columns */}
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold mb-4">Content Pillars</h3>
                <div className="grid grid-cols-2 gap-3">
                  {["Productivity & Systems", "AI Tools & Technology", "Creator Business", "Audience Growth"].map((p) => (
                    <div key={p} className="rounded-lg bg-accent/10 border border-accent/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-medium text-accent-foreground">{p}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold mb-4">Connected Accounts</h3>
                <div className="space-y-3">
                  {MOCK_ACCOUNTS.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/20 border border-border/60">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.connected ? "bg-success/20" : "bg-muted/30"}`}>
                        <Tv className={`w-4 h-4 ${a.connected ? "text-success" : "text-muted-foreground/40"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.username}</p>
                        <p className="text-xs text-muted-foreground">{a.followers.toLocaleString()} followers · {a.platform.replace("_", " ")}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.connected ? "bg-success/15 text-success" : "bg-muted/40 text-muted-foreground"}`}>
                        {a.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Stub Page ────────────────────────────────────────────────────────────────

function StubPage({ title, icon: Icon, onNavigate }: { title: string; icon: React.ElementType; onNavigate: (p: string) => void }) {
  return (
    <>
      <TopBar pageName={title} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto scrollbar-none flex items-center justify-center">
        <div className="text-center space-y-4 p-12">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
            <Icon className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">This section is ready to be built. Use the Spark AI to generate content for this view.</p>
          </div>
          <button onClick={() => onNavigate("/")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent-foreground text-sm font-medium hover:bg-accent/30 transition-colors mx-auto">
            <ArrowRight className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </main>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// ─── Mobile Shell ─────────────────────────────────────────────────────────────
// Shared visual tokens — same family as BrandGenesisMobile
const M = {
  bg:        "#0B0F17",
  card:      "rgba(255,255,255,0.04)",
  cardHover: "rgba(255,255,255,0.07)",
  border:    "rgba(255,255,255,0.08)",
  borderHi:  "rgba(168,85,247,0.45)",
  purple:    "#a855f7",
  magenta:   "#F018FF",
  muted:     "rgba(255,255,255,0.38)",
  body:      "rgba(255,255,255,0.78)",
  label:     "rgba(255,255,255,0.25)",
};

const MOBILE_NAV = [
  { name: "Home",        icon: Zap,          path: "/" },
  { name: "Sparks",      icon: TrendingUp,   path: "/viral-sparks" },
  { name: "Review",      icon: CheckSquare,  path: "/review" },
  { name: "Calendar",    icon: Calendar,     path: "/calendar" },
  { name: "More",        icon: MoreHorizontal, path: "/more" },
];

function MobileBottomNav({ current, onNavigate }: { current: string; onNavigate: (p: string) => void }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(8,12,20,0.96)",
      borderTop: `1px solid ${M.border}`,
      paddingBottom: "env(safe-area-inset-bottom,0px)",
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", height: 60 }}>
        {MOBILE_NAV.map(item => {
          const active = current === item.path || (item.path !== "/" && current.startsWith(item.path));
          return (
            <button key={item.path} onClick={() => onNavigate(item.path)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <item.icon style={{ width: 20, height: 20, color: active ? M.magenta : M.muted, transition: "color 0.15s" }} />
              <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 400, color: active ? M.magenta : M.muted, letterSpacing: "0.04em", transition: "color 0.15s" }}>{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Mobile visual system — same DNA as Brand Genesis ────────────────────────
const MOBILE_STYLES = `
  /* press feedback */
  .m-press { transition: transform 0.14s ease, opacity 0.14s ease; cursor: pointer; }
  .m-press:active { transform: scale(0.96); opacity: 0.84; }

  /* card entry — mirrors genesis-in from onboarding */
  @keyframes m-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .m-card-in { animation: m-card-in 0.32s ease both; }

  /* orb background blobs */
  @keyframes orb-drift {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(14px,-10px) scale(1.05); }
    66%      { transform: translate(-10px,12px) scale(0.96); }
  }

  /* neon border — same as onboard neon-border-flow */
  @keyframes neon-border-flow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes neon-glow-pulse {
    0%,100% { box-shadow: 0 0 12px rgba(168,85,247,0.5), 0 0 24px rgba(240,24,255,0.2); }
    50%      { box-shadow: 0 0 22px rgba(168,85,247,0.9), 0 0 44px rgba(240,24,255,0.4); }
  }
  .neon-pill-wrap {
    padding: 1.5px; border-radius: 50px;
    background: linear-gradient(90deg,#a855f7,#22d3ee,#ec4899,#6366f1,#F018FF,#a855f7);
    background-size: 400% 400%;
    animation: neon-border-flow 2.6s ease infinite, neon-glow-pulse 2.6s ease infinite;
  }
  .neon-pill-inner {
    background: #0B0F17; border-radius: 50px;
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; cursor: pointer;
  }

  /* pipeline node pulse */
  @keyframes node-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,24,255,0.6); }
    50%      { box-shadow: 0 0 0 6px rgba(240,24,255,0); }
  }
  .node-active { animation: node-pulse 1.6s ease infinite; }

  /* decision card glow */
  @keyframes decision-glow-amber {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
    50%      { box-shadow: 0 2px 18px rgba(245,158,11,0.14); }
  }
  @keyframes decision-glow-magenta {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,24,255,0); }
    50%      { box-shadow: 0 2px 18px rgba(240,24,255,0.14); }
  }
  @keyframes decision-glow-green {
    0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    50%      { box-shadow: 0 2px 18px rgba(34,197,94,0.14); }
  }

  /* thinking dots — mirrors onboard */
  @keyframes thinking-pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.8); }
  }

  /* photo card zoom on entry */
  @keyframes photo-zoom-in {
    from { transform: scale(1.06); }
    to   { transform: scale(1); }
  }
  .photo-zoom { animation: photo-zoom-in 600ms ease-out both; }

  /* ping for status dot */
  @keyframes ping {
    0%    { transform: scale(1); opacity: 0.8; }
    75%,100% { transform: scale(2); opacity: 0; }
  }
`;

function MobileDecisionCard({ accent, accentKey, title, subtitle, cta, onClick, delay = 0 }: {
  accent: string; accentKey: "amber" | "magenta" | "green";
  title: string; subtitle: string; cta: string; onClick: () => void; delay?: number;
}) {
  return (
    <button onClick={onClick} className={`m-press m-card-in`} style={{
      width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
      background: "rgba(255,255,255,0.035)",
      border: `1px solid rgba(255,255,255,0.09)`,
      borderRadius: 20, padding: "16px 18px",
      animationDelay: `${delay}ms`,
      animation: `m-card-in 0.32s ease ${delay}ms both, decision-glow-${accentKey} 3s ease 0.4s infinite`,
    }}>
      {/* colored glow bar */}
      <div style={{ width: 3, height: 40, borderRadius: 4, background: accent, flexShrink: 0, boxShadow: `0 0 10px ${accent}88` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "white", margin: 0, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 12, color: M.muted, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        padding: "6px 12px", borderRadius: 50,
        background: `${accent}18`, border: `1px solid ${accent}40`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{cta}</span>
        <ArrowRight style={{ width: 12, height: 12, color: accent }} />
      </div>
    </button>
  );
}

function MobilePipelineStrip({ activeIdx = 1 }: { activeIdx?: number }) {
  const stages = ["Research", "Produce", "Review", "Publish", "Learn"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {stages.map((label, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
            {i > 0 && (
              <div style={{
                position: "absolute", top: 7, left: "-50%", width: "100%", height: 1.5,
                background: done
                  ? "linear-gradient(90deg,rgba(168,85,247,0.6),rgba(240,24,255,0.4))"
                  : "rgba(255,255,255,0.08)",
              }} />
            )}
            <div className={active ? "node-active" : ""} style={{
              width: 15, height: 15, borderRadius: "50%", zIndex: 1, position: "relative",
              background: active ? M.magenta : done ? "rgba(168,85,247,0.45)" : "transparent",
              border: `2px solid ${active ? M.magenta : done ? M.purple : "rgba(255,255,255,0.15)"}`,
              transition: "all 0.3s",
            }} />
            <span style={{
              fontSize: 9, color: active ? "white" : done ? M.purple : M.label,
              fontWeight: active ? 700 : 400, textAlign: "center", lineHeight: 1.2,
              letterSpacing: "0.04em",
            }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MobileMetricTile({ value, label, color, onClick }: { value: string; label: string; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="m-press" style={{
      flex: 1, background: "rgba(255,255,255,0.035)",
      border: `1px solid rgba(255,255,255,0.09)`,
      borderRadius: 20, padding: "20px 14px", textAlign: "center", minWidth: 0,
    }}>
      <p style={{
        fontSize: 32, fontWeight: 800, color: color || "white",
        margin: 0, letterSpacing: "-0.04em", lineHeight: 1,
        textShadow: color ? `0 0 20px ${color}55` : undefined,
      }}>{value}</p>
      <p style={{ fontSize: 11, color: M.muted, margin: "7px 0 0", lineHeight: 1.3 }}>{label}</p>
    </button>
  );
}

const OPPORTUNITY_PHOTOS = [
  "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80&fit=crop",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80&fit=crop",
];

function MobileHome({ onNavigate }: { onNavigate: (p: string) => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const brandName = MOCK_BRAND.name.split(" ")[0];
  const pendingReviews = MOCK_REVIEWS.filter(r => r.status === "Pending Review");
  const approvedCount = MOCK_PRODUCTIONS.filter(p => p.status === "Approved").length;
  const topSpark = MOCK_VIRAL_SPARKS[0];
  const inProd = MOCK_PRODUCTIONS.filter(p => p.status === "Drafting" || p.status === "Ready for Review").length;

  const decisions = [
    pendingReviews.length > 0 ? { accent: "#f59e0b", accentKey: "amber" as const, title: `${pendingReviews.length} review${pendingReviews.length > 1 ? "s" : ""} waiting`, subtitle: `"${pendingReviews[0].title}"`, cta: "Review", path: "/review" } : null,
    MOCK_VIRAL_SPARKS.length > 0 ? { accent: M.magenta, accentKey: "magenta" as const, title: `${MOCK_VIRAL_SPARKS.length} opportunities detected`, subtitle: `"${topSpark.title}"`, cta: "Open", path: "/viral-sparks" } : null,
    approvedCount > 0 ? { accent: "#22c55e", accentKey: "green" as const, title: `${approvedCount} ready to publish`, subtitle: "Approved · awaiting schedule", cta: "Schedule", path: "/calendar" } : null,
  ].filter(Boolean) as { accent: string; accentKey: "amber"|"magenta"|"green"; title: string; subtitle: string; cta: string; path: string }[];

  return (
    <>
      <style>{MOBILE_STYLES}</style>

      {/* Sticky header — same glass as onboarding screens */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(8,12,20,0.88)", backdropFilter: "blur(24px)",
        padding: "0 22px", paddingTop: "calc(env(safe-area-inset-top,0px) + 18px)", paddingBottom: 16,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Spark label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22c55e", opacity: 0.5, animation: "ping 1.8s ease infinite" }} />
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "block", position: "relative" }} />
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em", fontWeight: 600, textTransform: "uppercase" }}>Spark</span>
            </div>
            {/* Greeting — same weight/size as onboard DirectorLine */}
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "white", margin: 0, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
              {greeting},<br />{brandName}
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", margin: "6px 0 0" }}>
              {MOCK_VIRAL_SPARKS.length} opportunities · {pendingReviews.length} need review
            </p>
          </div>
          {/* Super Spark — neon pill matching onboard neon-btn-wrap */}
          <button className="m-press" style={{ flexShrink: 0, background: "none", border: "none", padding: 0, marginTop: 2 }}>
            <div className="neon-pill-wrap">
              <div className="neon-pill-inner">
                <SparkLogoMark className="" style={{ width: 14, height: 14 } as React.CSSProperties} />
                <span style={{ fontSize: 12, fontWeight: 700, color: M.purple, letterSpacing: "0.01em" }}>Super Spark</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 88 }} className="scrollbar-none">

        {/* Background orbs — same as onboarding */}
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, right: -80, width: 320, height: 320,
            borderRadius: "50%", pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 65%)",
            animation: "orb-drift 9s ease infinite",
          }} />
          <div style={{
            position: "absolute", top: 200, left: -100, width: 280, height: 280,
            borderRadius: "50%", pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(circle, rgba(240,24,255,0.1) 0%, transparent 65%)",
            animation: "orb-drift 12s ease 2s infinite",
          }} />

          <div style={{ position: "relative", zIndex: 1, padding: "28px 20px 0" }}>

            {/* ── Needs You ───────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
                Needs you
              </p>
              {decisions.length === 0 ? (
                <div className="m-card-in" style={{
                  padding: "24px 20px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, textAlign: "center",
                }}>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>{"You're clear. Spark is watching."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {decisions.slice(0, 3).map((d, i) => (
                    <MobileDecisionCard key={i} accent={d.accent} accentKey={d.accentKey}
                      title={d.title} subtitle={d.subtitle} cta={d.cta}
                      onClick={() => onNavigate(d.path)} delay={i * 60} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Pipeline ─────────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
                Pipeline
              </p>
              <div className="m-card-in" style={{
                background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 20, padding: "20px 18px 16px",
              }}>
                <MobilePipelineStrip activeIdx={1} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%", background: M.magenta,
                      opacity: 0.6, animation: `thinking-pulse 1s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>
                    Spark is producing · 2 drafts active
                  </span>
                </div>
              </div>
            </section>

            {/* ── Opportunities — full-bleed photo cards ────── */}
            {MOCK_VIRAL_SPARKS.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
                    Opportunities
                  </p>
                  <button onClick={() => onNavigate("/viral-sparks")} className="m-press" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: M.purple, background: "none", border: "none", padding: 0 }}>
                    See all <ArrowRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {MOCK_VIRAL_SPARKS.slice(0, 2).map((spark, idx) => (
                    <button key={spark.id} onClick={() => onNavigate("/viral-sparks")} className="m-press" style={{
                      width: "100%", textAlign: "left", position: "relative", height: 200,
                      borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
                      display: "block",
                    }}>
                      {/* Full-bleed photo — same technique as genre cards */}
                      <img src={OPPORTUNITY_PHOTOS[idx % OPPORTUNITY_PHOTOS.length]}
                        alt="" className="photo-zoom"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }} />
                      {/* Gradient overlay — same as genre carousel */}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(8,12,20,0.95) 0%, rgba(8,12,20,0.45) 50%, transparent 100%)",
                      }} />
                      {/* Content */}
                      <div style={{ position: "absolute", inset: 0, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, color: "#f59e0b",
                            background: "rgba(245,158,11,0.15)", padding: "3px 10px", borderRadius: 50,
                            border: "1px solid rgba(245,158,11,0.25)", letterSpacing: "0.04em",
                          }}>
                            {spark.window} window
                          </span>
                          <div style={{
                            fontSize: 15, fontWeight: 800, color: spark.score >= 92 ? "#22c55e" : "#f59e0b",
                            background: "rgba(8,12,20,0.6)", backdropFilter: "blur(8px)",
                            padding: "4px 10px", borderRadius: 50,
                            textShadow: `0 0 12px ${spark.score >= 92 ? "#22c55e" : "#f59e0b"}88`,
                          }}>
                            {spark.score}%
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: "0 0 6px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{spark.title}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>{spark.platform}</span>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "5px 12px", borderRadius: 50,
                              background: "rgba(168,85,247,0.25)", border: "1px solid rgba(168,85,247,0.4)",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: M.purple }}>Open</span>
                              <ArrowRight style={{ width: 12, height: 12, color: M.purple }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── At a Glance ──────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
                At a glance
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MobileMetricTile value={String(pendingReviews.length)} label="Reviews pending" color="#f59e0b" onClick={() => onNavigate("/review")} />
                <MobileMetricTile value={String(MOCK_VIRAL_SPARKS.length)} label="Viral Sparks" color={M.magenta} onClick={() => onNavigate("/viral-sparks")} />
                <MobileMetricTile value={String(inProd)} label="In production" color={M.purple} onClick={() => onNavigate("/review")} />
                <MobileMetricTile value={String(approvedCount)} label="Approved" color="#22c55e" onClick={() => onNavigate("/review")} />
              </div>
            </section>

            {/* ── Recent ───────────────────────────────────── */}
            <section style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
                Recent
              </p>
              <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, overflow: "hidden" }}>
                {([
                  { icon: CheckCircle2, color: "#22c55e", title: "Production Published",  sub: '"How I Gained 100K Followers"', time: "2h ago" },
                  { icon: AlertCircle,  color: "#f59e0b", title: "Review Requested",       sub: '"10 Productivity Hacks That Changed My Life"', time: "4h ago" },
                  { icon: Flame,        color: M.magenta, title: "Opportunity Detected",   sub: `"${topSpark.title}"`, time: "6h ago" },
                ] as { icon: React.ComponentType<{style?:React.CSSProperties}>; color:string; title:string; sub:string; time:string }[]).map((a, i, arr) => (
                  <div key={i} className="m-card-in" style={{
                    display: "flex", alignItems: "center", gap: 13, padding: "14px 18px",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
                    animationDelay: `${i * 80 + 200}ms`,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                      background: `${a.color}18`, border: `1px solid ${a.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <a.icon style={{ width: 15, height: 15, color: a.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: 0 }}>{a.title}</p>
                      <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sub}</p>
                    </div>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", flexShrink: 0 }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}

// ─── Mobile More ────────────────────────────────────────────────────────────

const AI_TASKS = [
  { id: "supersparkChat", label: "Super Spark (chat)",    group: "Conversation",   current: "Gemini" },
  { id: "research",       label: "Research",              group: "Research",       current: "Auto" },
  { id: "videoUnderstand",label: "Video understanding",   group: "Research",       current: "Auto" },
  { id: "imageGen",       label: "Image generation",      group: "Creative media", current: "OpenAI" },
  { id: "videoGen",       label: "Video generation",      group: "Creative media", current: "Gemini" },
  { id: "voiceContent",   label: "Voice (content)",       group: "Voice",          current: "ElevenLabs" },
];

const AI_PROVIDERS: Record<string, { label: string; models: string[] }> = {
  auto:        { label: "Best Available (Auto)", models: [] },
  openai:      { label: "OpenAI",               models: ["GPT-4o", "GPT-4o mini", "o3", "o4-mini", "DALL·E 3"] },
  anthropic:   { label: "Anthropic Claude",     models: ["Claude Sonnet 5", "Claude Opus 5", "Claude Haiku 4.5"] },
  gemini:      { label: "Google Gemini",        models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash", "Veo 3"] },
  xai:         { label: "xAI Grok",             models: ["Grok 3", "Grok 3 mini", "Grok Vision"] },
  elevenlabs:  { label: "ElevenLabs",           models: ["Turbo v2.5", "Multilingual v2", "Flash v2.5"] },
};

const DETAIL_HEADER_STYLE = {
  position: "sticky" as const, top: 0, zIndex: 20,
  background: "rgba(8,12,20,0.88)", backdropFilter: "blur(24px)",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  padding: "0 22px",
  paddingTop: "calc(env(safe-area-inset-top,0px) + 16px)",
  paddingBottom: 16,
};

function MobileDetailHeader({ title, sub, backLabel = "More", onBack }: { title: string; sub?: string; backLabel?: string; onBack: () => void }) {
  return (
    <div style={DETAIL_HEADER_STYLE}>
      <button onClick={onBack} className="m-press" style={{
        display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
        padding: 0, marginBottom: 12, fontSize: 13, color: M.purple, fontWeight: 500,
      }}>
        <ChevronLeft style={{ width: 16, height: 16 }} /> {backLabel}
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "white", margin: 0, letterSpacing: "-0.025em" }}>{title}</h1>
      {sub && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "6px 0 0" }}>{sub}</p>}
    </div>
  );
}

function SettingsRow({ icon: Icon, label, badge, highlight, onPress }: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>; label: string; badge?: string; highlight?: boolean; onPress: () => void;
}) {
  return (
    <button onClick={onPress} className="m-press" style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%",
      padding: "15px 20px", background: "none", border: "none", textAlign: "left", minHeight: 56,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
        background: highlight ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.06)",
        border: highlight ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 16, height: 16, color: highlight ? M.purple : "rgba(255,255,255,0.7)" }} />
      </div>
      <span style={{ flex: 1, fontSize: 15, color: "rgba(255,255,255,0.82)", fontWeight: 450, letterSpacing: "-0.01em" }}>{label}</span>
      {badge && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.28)", marginRight: 8 }}>{badge}</span>}
      <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)" }} />
    </button>
  );
}

// Matches the onboard ModeCard exactly — rounded-2xl, purple glow when selected
function AppModeCard({ label, desc, selected, onClick }: { label: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="m-press" style={{
      flex: 1, textAlign: "left", padding: "15px 14px", borderRadius: 20, cursor: "pointer",
      background: selected ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.035)",
      border: `1.5px solid ${selected ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.08)"}`,
      boxShadow: selected ? "0 0 20px rgba(168,85,247,0.2)" : "none",
      transition: "all 0.18s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: selected ? "white" : "rgba(255,255,255,0.8)" }}>{label}</span>
        {selected && <Check style={{ width: 14, height: 14, color: M.purple }} />}
      </div>
      <p style={{ fontSize: 11, color: selected ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.28)", margin: 0, lineHeight: 1.45 }}>{desc}</p>
    </button>
  );
}

const CARD_BG = "rgba(255,255,255,0.035)";
const CARD_BORDER = "rgba(255,255,255,0.09)";
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)",
  letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12,
};
const ROW_DIVIDER: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.06)" };

function MobileAIPreferences({ onBack }: { onBack: () => void }) {
  const [tasks, setTasks] = useState(AI_TASKS.map(t => ({ ...t })));
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const grouped: Record<string, typeof AI_TASKS> = {};
  for (const t of tasks) {
    if (!grouped[t.group]) grouped[t.group] = [];
    grouped[t.group].push(t);
  }

  // Level 3: model list
  if (activeTask && selectedProvider && selectedProvider !== "auto") {
    const provInfo = AI_PROVIDERS[selectedProvider];
    const task = tasks.find(t => t.id === activeTask)!;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <MobileDetailHeader title={task.label} sub={`Select a model · ${provInfo.label}`}
          backLabel={provInfo.label} onBack={() => setSelectedProvider(null)} />
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 88px" }} className="scrollbar-none">
          {provInfo.models.map((model, i) => {
            const isSel = task.current === model;
            return (
              <button key={model} onClick={() => {
                setTasks(ts => ts.map(t => t.id === activeTask ? { ...t, current: model } : t));
                setSelectedProvider(null); setActiveTask(null);
              }} className={`m-press m-card-in`} style={{
                display: "flex", alignItems: "center", width: "100%", padding: "16px 18px",
                background: isSel ? "rgba(168,85,247,0.15)" : CARD_BG,
                border: `1.5px solid ${isSel ? "rgba(168,85,247,0.55)" : CARD_BORDER}`,
                borderRadius: 18, marginBottom: 10, textAlign: "left",
                boxShadow: isSel ? "0 0 18px rgba(168,85,247,0.15)" : "none",
                animationDelay: `${i * 40}ms`,
              }}>
                <span style={{ flex: 1, fontSize: 15, color: isSel ? "white" : "rgba(255,255,255,0.75)", fontWeight: isSel ? 600 : 400, letterSpacing: "-0.01em" }}>{model}</span>
                {isSel
                  ? <Check style={{ width: 16, height: 16, color: M.purple }} />
                  : <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.15)" }} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Level 2: provider cards
  if (activeTask) {
    const task = tasks.find(t => t.id === activeTask)!;
    const providers = Object.entries(AI_PROVIDERS).filter(([id]) => id !== "elevenlabs" || task.id === "voiceContent");
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <MobileDetailHeader title={task.label} sub="Choose a provider"
          backLabel="AI Preferences" onBack={() => setActiveTask(null)} />
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 88px" }} className="scrollbar-none">
          {providers.map(([id, prov], i) => {
            const isSel = (id === "auto" && task.current === "Auto")
              || task.current.toLowerCase().includes(id === "openai" ? "openai" : id === "anthropic" ? "claude" : id === "gemini" ? "gemini" : id === "xai" ? "grok" : id === "elevenlabs" ? "eleven" : "");
            return (
              <button key={id} onClick={() => {
                if (id === "auto") { setTasks(ts => ts.map(t => t.id === activeTask ? { ...t, current: "Auto" } : t)); setActiveTask(null); }
                else setSelectedProvider(id);
              }} className={`m-press m-card-in`} style={{
                display: "flex", alignItems: "center", width: "100%", padding: "16px 18px",
                background: isSel ? "rgba(168,85,247,0.15)" : CARD_BG,
                border: `1.5px solid ${isSel ? "rgba(168,85,247,0.55)" : CARD_BORDER}`,
                borderRadius: 18, marginBottom: 10, textAlign: "left",
                boxShadow: isSel ? "0 0 18px rgba(168,85,247,0.15)" : "none",
                animationDelay: `${i * 45}ms`,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, color: isSel ? "white" : "rgba(255,255,255,0.82)", fontWeight: isSel ? 600 : 450, margin: 0, letterSpacing: "-0.01em" }}>{prov.label}</p>
                  <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.28)", margin: "4px 0 0" }}>
                    {id === "auto" ? "SPARK picks the best model per task" : prov.models.slice(0, 2).join(" · ")}
                  </p>
                </div>
                {isSel
                  ? <Check style={{ width: 16, height: 16, color: M.purple, flexShrink: 0 }} />
                  : id !== "auto" && <ChevronRight style={{ width: 15, height: 15, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Level 1: task list
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <MobileDetailHeader title="AI Preferences" sub="SPARK picks the best model unless you set one." onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 88px" }} className="scrollbar-none">

        {/* Default */}
        <div style={{ padding: "0 22px 24px" }}>
          <p style={SECTION_LABEL}>Default</p>
          <div className="m-card-in" style={{
            background: "rgba(168,85,247,0.12)", border: "1.5px solid rgba(168,85,247,0.45)",
            borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 0 20px rgba(168,85,247,0.12)",
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "white", margin: 0 }}>Best Available (Auto)</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", margin: "4px 0 0" }}>SPARK routes each task to the optimal model</p>
            </div>
            <Check style={{ width: 16, height: 16, color: M.purple }} />
          </div>
        </div>

        {/* By task */}
        {Object.entries(grouped).map(([group, groupTasks]) => (
          <div key={group} style={{ padding: "0 0 20px" }}>
            <p style={{ ...SECTION_LABEL, padding: "0 22px" }}>{group}</p>
            <div style={{ background: CARD_BG, borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
              {groupTasks.map((task, idx, arr) => (
                <button key={task.id} onClick={() => setActiveTask(task.id)} className="m-press" style={{
                  display: "flex", alignItems: "center", width: "100%", padding: "16px 22px",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  ...(idx < arr.length - 1 ? ROW_DIVIDER : {}),
                }}>
                  <span style={{ flex: 1, fontSize: 15, color: "rgba(255,255,255,0.82)", letterSpacing: "-0.01em" }}>{task.label}</span>
                  <span style={{ fontSize: 12.5, color: M.purple, marginRight: 10, fontWeight: 500 }}>{task.current}</span>
                  <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)" }} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", padding: "0 22px", lineHeight: 1.65 }}>
          Leave Auto unless you have a specific reason to prefer a provider.
        </p>
      </div>
    </div>
  );
}

function MobileMore({ onNavigate: _onNavigate }: { onNavigate: (p: string) => void }) {
  const [autoMode, setAutoMode] = useState<"Manual" | "Balanced" | "Autonomous">("Balanced");
  const [prodMode, setProdMode] = useState<"Off" | "On">("On");
  const [activeDetail, setActiveDetail] = useState<string | null>(null);

  if (activeDetail === "ai-preferences") {
    return <MobileAIPreferences onBack={() => setActiveDetail(null)} />;
  }

  const brandRows = [
    { icon: Zap,        label: "My Spark",  badge: "Active",           hl: false },
    { icon: Flame,      label: "Assets",    badge: "12 items",         hl: false },
    { icon: Star,       label: "Memory",    badge: "Brand & Research", hl: false },
    { icon: TrendingUp, label: "Marketer",  badge: "ON",               hl: false },
    { icon: Users,      label: "Accounts",  badge: "3 active",         hl: false },
  ];
  const accountRows = [
    { icon: CreditCard, label: "Billing",        badge: "Pro",          detail: null,              hl: false },
    { icon: Key,        label: "API",             badge: "2 keys",       detail: null,              hl: false },
    { icon: Cpu,        label: "AI Preferences", badge: undefined,       detail: "ai-preferences",  hl: true  },
    { icon: Link,       label: "Integrations",   badge: "5 connected",  detail: null,              hl: false },
    { icon: Users,      label: "Team",           badge: "2 members",    detail: null,              hl: false },
  ];
  const prefRows = [
    { icon: Palette, label: "Appearance & Theme", badge: "Dark" },
    { icon: Bell,    label: "Notifications",      badge: "On" },
    { icon: Shield,  label: "Privacy",            badge: undefined },
  ];
  const supportRows = [
    { icon: HelpCircle, label: "Support", badge: undefined },
    { icon: FileText,   label: "Legal",   badge: undefined },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Sticky header */}
      <div style={{ ...DETAIL_HEADER_STYLE, paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: "0.18em", fontWeight: 600, textTransform: "uppercase" }}>Spark</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "white", margin: 0, letterSpacing: "-0.025em" }}>More</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 88 }} className="scrollbar-none">

        {/* Account card — same family as onboard brand card */}
        <div style={{ padding: "20px 22px 0" }}>
          <div className="m-card-in" style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(240,24,255,0.07) 100%)",
            border: "1px solid rgba(168,85,247,0.25)", borderRadius: 22,
            padding: "18px 20px", display: "flex", alignItems: "center", gap: 14,
          }}>
            {/* Avatar with same purple-magenta gradient as onboard logo bloom */}
            <div style={{
              width: 48, height: 48, borderRadius: 16, flexShrink: 0, position: "relative",
              background: "linear-gradient(135deg, rgba(168,85,247,0.7) 0%, rgba(240,24,255,0.5) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(168,85,247,0.35)",
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "white" }}>{MOCK_BRAND.name.charAt(0)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "white", margin: 0, letterSpacing: "-0.01em" }}>{MOCK_BRAND.name}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "3px 0 0" }}>studio@creatoroshq.com · Pro</p>
            </div>
            <button className="m-press" style={{
              fontSize: 12, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 13px",
            }}>
              Sign out
            </button>
          </div>
        </div>

        {/* ── Modes ─────────────────────────────────── */}
        <div style={{ padding: "26px 22px 0" }}>
          <p style={SECTION_LABEL}>Modes</p>

          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 500 }}>Automation</p>
          <div style={{ display: "flex", gap: 9, marginBottom: 22 }}>
            {(["Manual", "Balanced", "Autonomous"] as const).map(m => (
              <AppModeCard key={m} label={m} selected={autoMode === m} onClick={() => setAutoMode(m)}
                desc={m === "Manual" ? "All decisions need approval" : m === "Balanced" ? "SPARK drafts; you gate strategy" : "SPARK runs within brand rules"} />
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 500 }}>Production generation</p>
          <div style={{ display: "flex", gap: 9, marginBottom: prodMode === "Off" ? 12 : 0 }}>
            {(["Off", "On"] as const).map(m => (
              <AppModeCard key={m} label={m} selected={prodMode === m} onClick={() => setProdMode(m)}
                desc={m === "Off" ? "Drafts & text pipeline only" : "Full production assets allowed"} />
            ))}
          </div>
          {prodMode === "Off" && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", lineHeight: 1.55 }}>
              When Off, SPARK will not generate images or video.
            </p>
          )}
        </div>

        {/* ── Brand section ─────────────────────────── */}
        <div style={{ padding: "26px 0 0" }}>
          <p style={{ ...SECTION_LABEL, padding: "0 22px" }}>Brand</p>
          <div style={{ background: CARD_BG, borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
            {brandRows.map((row, i, arr) => (
              <div key={row.label} style={i < arr.length - 1 ? ROW_DIVIDER : {}}>
                <SettingsRow icon={row.icon} label={row.label} badge={row.badge} highlight={row.hl} onPress={() => {}} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Account & Team ────────────────────────── */}
        <div style={{ padding: "26px 0 0" }}>
          <p style={{ ...SECTION_LABEL, padding: "0 22px" }}>Account & Team</p>
          <div style={{ background: CARD_BG, borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
            {accountRows.map((row, i, arr) => (
              <div key={row.label} style={i < arr.length - 1 ? ROW_DIVIDER : {}}>
                <SettingsRow icon={row.icon} label={row.label} badge={row.badge} highlight={row.hl}
                  onPress={() => row.detail ? setActiveDetail(row.detail) : undefined} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Preferences ───────────────────────────── */}
        <div style={{ padding: "26px 0 0" }}>
          <p style={{ ...SECTION_LABEL, padding: "0 22px" }}>Preferences</p>
          <div style={{ background: CARD_BG, borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
            {prefRows.map((row, i, arr) => (
              <div key={row.label} style={i < arr.length - 1 ? ROW_DIVIDER : {}}>
                <SettingsRow icon={row.icon} label={row.label} badge={row.badge} highlight={false} onPress={() => {}} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Legal & Support ───────────────────────── */}
        <div style={{ padding: "26px 0 20px" }}>
          <p style={{ ...SECTION_LABEL, padding: "0 22px" }}>Legal & Support</p>
          <div style={{ background: CARD_BG, borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
            {supportRows.map((row, i, arr) => (
              <div key={row.label} style={i < arr.length - 1 ? ROW_DIVIDER : {}}>
                <SettingsRow icon={row.icon} label={row.label} badge={row.badge} highlight={false} onPress={() => {}} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Mobile app shell ────────────────────────────────────────────────────────

function MobileSparkApp({ onNavigate: _nav }: { onNavigate?: (p: string) => void }) {
  const [currentPath, setCurrentPath] = useState("/");

  const renderPage = () => {
    switch (currentPath) {
      case "/":     return <MobileHome onNavigate={setCurrentPath} />;
      case "/more": return <MobileMore onNavigate={setCurrentPath} />;
      default: return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <Zap style={{ width: 32, height: 32, color: M.purple, opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: M.muted, textAlign: "center" }}>Coming soon on mobile</p>
          <button onClick={() => setCurrentPath("/")} style={{ fontSize: 13, color: M.purple, background: "none", border: "none", cursor: "pointer" }}>← Back to Home</button>
        </div>
      );
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: M.bg, display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      {renderPage()}
      <MobileBottomNav current={currentPath} onNavigate={setCurrentPath} />
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState("/");
  const [genesisComplete, setGenesisComplete] = useState(false);
  const isMobile = useIsMobile();

  // Mobile: Brand Genesis onboarding → Mobile Home
  if (isMobile && !genesisComplete) {
    return <BrandGenesisMobile onComplete={() => setGenesisComplete(true)} />;
  }
  if (isMobile && genesisComplete) {
    return <MobileSparkApp />;
  }

  const renderPage = () => {
    const base = currentPath.split("?")[0];
    switch (base) {
      case "/": return <SparkHome onNavigate={setCurrentPath} />;
      case "/my-spark": return <MySparkPage onNavigate={setCurrentPath} />;
      case "/viral-sparks": return <ViralSparksPage onNavigate={setCurrentPath} />;
      case "/review": return <ReviewCenterPage onNavigate={setCurrentPath} />;
      case "/calendar": return <CalendarPage onNavigate={setCurrentPath} />;
      case "/analytics": return <AnalyticsPage onNavigate={setCurrentPath} />;
      default: return <StubPage title="Settings & More" icon={MoreHorizontal} onNavigate={setCurrentPath} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground antialiased theme-violet dark">
      <Navigation currentPath={currentPath} onNavigate={setCurrentPath} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {renderPage()}
      </div>
    </div>
  );
}
