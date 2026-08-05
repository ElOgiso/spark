import { ExternalLink, RefreshCw, Users, Video, Eye, MapPin, BadgeCheck } from "lucide-react";
import type { LiveAccountProfileCard } from "../services/socialIntegrationService";
import { formatCount } from "../services/socialIntegrationService";

interface AccountProfileCardsProps {
  profiles: LiveAccountProfileCard[];
  loading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

export function AccountProfileCards({
  profiles,
  loading,
  onRefresh,
  compact = false,
}: AccountProfileCardsProps) {
  if (loading && profiles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-accent-foreground" />
        Loading live channel profiles…
      </div>
    );
  }

  if (!profiles.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Connected channel profiles
        </h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      <div
        className={
          compact
            ? "space-y-3"
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
        }
      >
        {profiles.map((p) => (
          <div
            key={`${p.platform}-${p.channelId || p.username}`}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.displayName}
                  className="w-14 h-14 rounded-full border border-border object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent-foreground shrink-0">
                  {(p.displayName || p.platform || "?")[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-semibold text-sm truncate">{p.displayName}</h3>
                  {p.verified && (
                    <BadgeCheck className="w-4 h-4 text-accent-foreground shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {p.username || "—"}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  {p.platform}
                  {p.source === "live" ? " · Live" : p.source === "cached" ? " · Cached" : ""}
                </p>
              </div>
            </div>

            {p.description ? (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {p.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/70 italic">No bio / description available.</p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
              <div className="text-center py-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Users className="w-3 h-3" />
                </div>
                <p className="text-sm font-semibold">
                  {p.hiddenSubscriberCount
                    ? "Hidden"
                    : formatCount(
                        p.subscribersCount ?? p.followersCount
                      )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {String(p.platform).toLowerCase().includes("youtube")
                    ? "Subscribers"
                    : "Followers"}
                </p>
              </div>
              <div className="text-center py-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Video className="w-3 h-3" />
                </div>
                <p className="text-sm font-semibold">{formatCount(p.postsCount)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {String(p.platform).toLowerCase().includes("youtube") ? "Videos" : "Posts"}
                </p>
              </div>
              <div className="text-center py-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Eye className="w-3 h-3" />
                </div>
                <p className="text-sm font-semibold">
                  {p.totalViews != null && p.totalViews > 0
                    ? formatCount(p.totalViews)
                    : p.followingCount != null
                      ? formatCount(p.followingCount)
                      : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {p.totalViews != null && p.totalViews > 0 ? "Views" : "Following"}
                </p>
              </div>
            </div>

            {p.content && p.content.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <h4 className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  Recent Content & Analytics
                </h4>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {p.content.map((item) => (
                    <a
                      key={item.id}
                      href={item.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-1.5 rounded bg-background/50 border border-border/40 hover:bg-accent/10 hover:border-accent/20 transition-all group"
                    >
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-10 h-7 rounded object-cover border border-border/40 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate group-hover:text-accent-foreground transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                          {item.views != null && (
                            <span className="flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> {formatCount(item.views)}
                            </span>
                          )}
                          {item.likes != null && (
                            <span>· {formatCount(item.likes)} likes</span>
                          )}
                          {item.comments != null && (
                            <span>· {formatCount(item.comments)} comments</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              <span className="inline-flex items-center gap-1 min-w-0 truncate">
                {p.country ? (
                  <>
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.country}</span>
                  </>
                ) : (
                  <span>ID: {(p.channelId || "—").slice(0, 18)}</span>
                )}
              </span>
              {p.profileUrl && (
                <a
                  href={p.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent-foreground hover:underline shrink-0"
                >
                  Open profile <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {p.error && (
              <p className="text-[10px] text-warning leading-relaxed border border-warning/20 bg-warning/5 rounded-lg px-2 py-1.5">
                {p.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
