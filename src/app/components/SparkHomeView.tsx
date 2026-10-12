import { ArrowRight, CircleAlert, Film, MessageSquare, RefreshCw } from "lucide-react";
import type { Production } from "../domain/types";
import type { projectSparkHome } from "../services/production/ui/sparkHomeProjection";
import { openProductionReviewDetail } from "../services/production/homeReviewCardMedia";

export interface SparkHomeViewProps {
  brandName: string;
  purpose: string;
  useCase: string;
  model: ReturnType<typeof projectSparkHome>;
  status: "loading" | "ready" | "error" | "local";
  error?: string;
  onNavigate: (path: string) => void;
  onChat: () => void;
  onRefresh: () => void;
}

export function SparkHomeView({ brandName, purpose, useCase, model, status, error, onNavigate, onChat, onRefresh }: SparkHomeViewProps) {
  const busy = status === "loading";
  const unavailable = busy || status === "error";
  const summary = [
    { label: "Awaiting review", count: model.needsReview.length, path: "/review" },
    { label: "In progress", count: model.inProgress.length, path: "/review" },
    { label: "Scheduled jobs", count: model.scheduled.length, path: "/calendar" },
    { label: "Verified posts", count: model.verifiedPosts, path: "/my-spark" },
  ];
  const attention = [...new Map([...model.needsAttention, ...model.needsReview].map(p => [p.id,p])).values()].slice(0,3);
  return <div className="spark-home" aria-busy={busy}>
    <header className="spark-home-hero">
      <div className="spark-home-eyebrow">SPARK / {useCase}</div>
      <div className="spark-home-heading">
        <div><h1>{brandName || "Your Spark"}</h1><p>{purpose || "Your media company, one clear next step at a time."}</p></div>
        <button type="button" className="spark-home-primary" onClick={onChat}><MessageSquare size={17} />Ask Spark</button>
      </div>
      <div className="spark-home-context"><span>{status === "ready" ? "Workspace loaded" : status === "local" ? "Local workspace · not cloud-verified" : busy ? "Refreshing workspace…" : "Refresh unavailable"}</span>
        <button type="button" onClick={onRefresh} disabled={busy} aria-label="Refresh workspace"><RefreshCw size={14} />Refresh</button>
      </div>
    </header>
    {status === "error" ? <section className="spark-home-notice" role="alert"><CircleAlert size={20} /><div><h2>Workspace refresh failed</h2><p>{error || "Saved work has been preserved. Retry to load current data."}</p><button type="button" onClick={onRefresh}>Retry refresh</button></div></section> : null}
    {busy ? <div className="spark-home-loading" role="status">Loading your current work…</div> : null}
    {!unavailable ? <>
      <section className="spark-home-summary" aria-label="Current workspace activity">
        {summary.map(item => <button type="button" key={item.label} onClick={() => onNavigate(item.path)}><span>{item.label}</span><strong>{item.count}</strong><ArrowRight size={15} /></button>)}
      </section>
      <section className="spark-home-section">
        <div className="spark-home-section-title"><h2>Your next move</h2><button type="button" onClick={() => onNavigate("/my-spark")}>Open MY SPARK <ArrowRight size={15} /></button></div>
        {attention.length ? <div className="spark-home-attention">{attention.map(p => <button type="button" key={p.id} onClick={() => openProductionReviewDetail(onNavigate,p.id)}><CircleAlert size={18} /><span><strong>{p.title}</strong><small>{p.lastError ? "Needs attention · open for details" : p.status}</small></span><ArrowRight size={16} /></button>)}</div> : <div className="spark-home-empty"><h3>{model.productions.length ? "No review decisions waiting" : "Make your first production"}</h3><p>{model.productions.length ? "Open your current work, check the calendar, or plan what comes next." : "Start with an idea. Spark will help shape the brief before any generation is approved."}</p><button type="button" onClick={onChat}>Plan with Spark <ArrowRight size={16} /></button></div>}
        {model.failedJobs.length ? <button type="button" className="spark-home-job-warning" onClick={() => onNavigate("/calendar")}>{model.failedJobs.length} publishing job{model.failedJobs.length === 1 ? "" : "s"} need attention <ArrowRight size={15} /></button> : null}
      </section>
      <section className="spark-home-section">
        <div className="spark-home-section-title"><h2>Current work</h2><button type="button" onClick={() => onNavigate("/review")}>All productions <ArrowRight size={15} /></button></div>
        {model.latest.length ? <div className="spark-home-work-grid">{model.latest.map(p => <ProductionTile key={p.id} production={p} onOpen={() => openProductionReviewDetail(onNavigate,p.id)} />)}</div> : <p className="spark-home-muted">Your drafts, clips, episodes and films will appear here. Published posts live in MY SPARK.</p>}
      </section>
      <nav className="spark-home-shortcuts" aria-label="Workspace shortcuts">
        {[{label:"Discover an angle",path:"/viral-sparks"},{label:"Private assets",path:"/more/assets"},{label:"Performance & learning",path:"/analytics"}].map(item => <button type="button" key={item.path} onClick={() => onNavigate(item.path)}>{item.label}<ArrowRight size={16} /></button>)}
      </nav>
    </> : null}
  </div>;
}

function ProductionTile({ production, onOpen }: { production: Production; onOpen: () => void }) {
  const image = production.thumbnailUrl || production.scenes?.find(s => s.image)?.image;
  return <button type="button" className="spark-home-work" onClick={onOpen}>
    <div className="spark-home-work-image">{image ? <img src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} /> : <Film size={28} />}<span>{production.status}</span></div>
    <div className="spark-home-work-copy"><h3>{production.title || "Untitled production"}</h3><p>{production.seriesId ? `Season ${production.seasonNumber || 1} · Episode ${production.episodeNumber || "—"}` : "Private production"}</p></div>
  </button>;
}
