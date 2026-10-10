import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Film,
  Image,
  Layers,
  Lock,
  MessageSquare,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  User,
  Video,
} from "lucide-react";
import { useSpark } from "../state/SparkContext";
import type {
  Brand,
  Character,
  Production,
  ProductionSeries,
  PublishJob,
} from "../domain/types";
import {
  SPARK_USE_CASES,
  isSparkUseCase,
  publishedSparkPosts,
  resolveSparkUseCase,
  safeExternalUrl,
  useCaseDefinition,
  type SparkUseCase,
} from "../domain/sparkExperience";
import {
  fetchLiveAccountProfiles,
  type LiveAccountProfileCard,
} from "../services/socialIntegrationService";
import { AIChatModal } from "./AIChatModal";
import { openProductionReviewDetail } from "../services/production/homeReviewCardMedia";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import "../../styles/spark-experience.css";

type AssetKind = "character" | "voice" | "location" | "cast";
interface ProfileProps {
  brand: Brand | null;
  character?: Character | null;
  characters: Character[];
  productions: Production[];
  publishJobs: PublishJob[];
  series: ProductionSeries[];
  profiles: LiveAccountProfileCard[];
  loading?: boolean;
  error?: string;
  onRefresh: () => void;
  onUseCase: (id: SparkUseCase) => void;
  onNavigate: (path: string) => void;
  onOpenAsset: (kind: AssetKind) => void;
  onAskSpark: () => void;
  onEditPurpose: () => void;
}
const metric = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Intl.NumberFormat(undefined, { notation: "compact" }).format(value)
    : "—";

/** Presentational and shared by native mobile and desktop; never seeds live data. */
export function SparkSocialProfileView({
  brand,
  character,
  characters,
  productions,
  publishJobs,
  series,
  profiles,
  loading,
  error,
  onRefresh,
  onUseCase,
  onNavigate,
  onOpenAsset,
  onAskSpark,
  onEditPurpose,
}: ProfileProps) {
  const useCase = resolveSparkUseCase(brand);
  const definition = useCaseDefinition(useCase);
  const [accountKey, setAccountKey] = useState("");
  const [tab, setTab] = useState<"published" | "work" | "series">("published");
  const [selectedPost, setSelectedPost] = useState<
    ReturnType<typeof publishedSparkPosts>[number] | null
  >(null);
  const [selectedSeries, setSelectedSeries] = useState<ProductionSeries | null>(
    null,
  );
  const [assetDetail, setAssetDetail] = useState<
    "world" | "props" | "evidence" | null
  >(null);
  useEffect(() => {
    setAccountKey("");
    setSelectedPost(null);
    setSelectedSeries(null);
    setTab("published");
  }, [brand?.id]);
  const account =
    profiles.find((p) => `${p.platform}:${p.channelId}` === accountKey) ||
    profiles[0];
  useEffect(() => { setSelectedPost(null); }, [account?.channelId, account?.platform]);
  useEffect(() => { setTab("published"); setSelectedSeries(null); setAssetDetail(null); }, [useCase]);
  const posts = useMemo(
    () => publishedSparkPosts(productions, publishJobs, brand?.id, account),
    [productions, publishJobs, brand?.id, account],
  );
  const pending = productions.filter(
    (p) =>
      (!brand?.id || !p.brandId || p.brandId === brand.id) &&
      p.status !== "Published" &&
      p.status !== "Cancelled",
  );
  const portrait =
    useCase === "influencer" || useCase === "avatar" || useCase === "drama";
  const tabs: Array<"published" | "work" | "series"> = [
    "published",
    "work",
    ...(useCase === "short_movies" || useCase === "drama" || useCase === "films"
      ? ["series" as const]
      : []),
  ];
  const narrative =
    useCase === "short_movies" || useCase === "drama" || useCase === "films";
  const scopedSeries = series.filter(
    (s) => !brand?.id || !s.brandId || s.brandId === brand.id,
  );
  const cast = [
    ...(character ? [character] : []),
    ...characters.filter((c) =>
      c.id ? c.id !== character?.id : c.name !== character?.name,
    ),
  ].filter((c) => !brand?.id || !c.brandId || c.brandId === brand.id);
  const locations = scopedSeries.flatMap(
    (s) => s.storyCanon?.establishedLocations || [],
  );
  const props = scopedSeries.flatMap((s) => s.storyCanon?.keyProps || []);
  const postMetrics =
    selectedPost && account?.source !== "token"
      ? account?.content?.find(
          (item) => item.id === selectedPost.job.platformPostId,
        )
      : undefined;
  const asset = (
    kind: AssetKind | "world" | "props" | "evidence",
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    image?: string | null,
    locked = false,
  ) => (
    <button
      key={kind}
      type="button"
      onClick={() =>
        kind === "world" || kind === "props" || kind === "evidence"
          ? setAssetDetail(kind)
          : onOpenAsset(kind)
      }
      className="spark-asset group text-left"
    >
      <div className="spark-asset-preview">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-purple-300/45">{icon}</div>
        )}
        {locked && (
          <span
            className="absolute right-2 bottom-2 rounded-full p-1.5 bg-black/60"
            aria-label="Locked"
          >
            <Lock className="w-3 h-3 text-emerald-300" />
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-white/80 mt-3 truncate">
        {title}
      </p>
      <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
        {subtitle}
      </p>
    </button>
  );
  const contentCard = (post: (typeof posts)[number]) => (
    <button
      key={`${post.job.accountId}:${post.job.platformPostId}`}
      type="button"
      onClick={() => setSelectedPost(post)}
      className="text-left group min-w-0"
    >
      <div
        className={`relative rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.05] ${portrait ? "aspect-[3/4]" : "aspect-video"}`}
      >
        {post.production.thumbnailUrl ? (
          <img
            src={post.production.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white/20">
            <Film className="w-8 h-8" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 bg-black/50 rounded-full px-2 py-1 flex items-center gap-1 text-[10px] text-white">
          <Play className="w-3 h-3" />
          Published
        </div>
      </div>
      <p className="text-sm text-white/80 font-medium mt-3 line-clamp-2">
        {post.production.title}
      </p>
      <p className="text-xs text-white/35 mt-1">
        {post.job.platform} ·{" "}
        {post.job.publishedAt
          ? new Date(post.job.publishedAt).toLocaleDateString()
          : "Publication confirmed"}
      </p>
    </button>
  );
  return (
    <div className="spark-experience" data-use-case={useCase}>
      <div className="spark-profile-header">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <p className="text-[10px] tracking-[0.22em] text-white/35 font-semibold uppercase">
            My Spark · Your media presence
          </p>
          <div className="flex items-center gap-2">
            {profiles.length > 1 && (
              <select
                aria-label="Connected account"
                value={`${account?.platform}:${account?.channelId}`}
                onChange={(e) => {
                  setSelectedPost(null);
                  setAccountKey(e.target.value);
                }}
                className="spark-select max-w-48"
              >
                {profiles.map((p) => (
                  <option
                    key={`${p.platform}:${p.channelId}`}
                    value={`${p.platform}:${p.channelId}`}
                  >
                    {p.displayName} · {p.platform}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh connected identity"
              className="spark-icon-button"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
        <div className="flex gap-5 sm:gap-7 items-center">
          <div className="spark-account-avatar shrink-0">
            {account?.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={`${account.displayName} account profile`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-8 h-8 text-white/25" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-4xl text-white font-semibold tracking-tight break-words">
              {account?.displayName || brand?.name || "Your Spark"}
            </h1>
            <p className="text-sm text-white/45 mt-2 break-words">
              {account?.username ||
                (loading
                  ? "Loading connected identity…"
                  : "Connect an account to import its profile")}
            </p>
            {account && (
              <p className="text-[11px] text-white/35 mt-2">
                {account.platform} ·{" "}
                {account.error
                  ? "Sync unavailable"
                  : account.source === "live"
                    ? "Live profile"
                    : "Cached identity"}
                {account.lastSynced
                  ? ` · ${new Date(account.lastSynced).toLocaleString()}`
                  : ""}
              </p>
            )}
          </div>
        </div>
        {account?.description && (
          <p className="text-sm leading-relaxed text-white/60 max-w-2xl mt-6 whitespace-pre-wrap">
            {account.description}
          </p>
        )}
        {error && (
          <p role="status" className="text-xs text-amber-200/70 mt-4">
            {error} Your saved Spark remains available.
          </p>
        )}
        {!account && !loading && (
          <button
            type="button"
            onClick={() => onNavigate("/more/accounts")}
            className="spark-secondary mt-5"
          >
            Connect a social account
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="spark-purpose mt-7">
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-[10px] uppercase tracking-[0.18em] text-purple-300/65"
              htmlFor={`purpose-${brand?.id || "new"}`}
            >
              This Spark creates
            </label>
            <button
              type="button"
              onClick={onEditPurpose}
              className="text-xs text-purple-300 min-h-9"
            >
              Edit purpose
            </button>
          </div>
          <select
            id={`purpose-${brand?.id || "new"}`}
            className="spark-usecase-select"
            value={useCase}
            onChange={(e) => {
              if (isSparkUseCase(e.target.value)) onUseCase(e.target.value);
            }}
          >
            {SPARK_USE_CASES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-white/60 leading-relaxed mt-2">
            {brand?.purpose || definition.description}
          </p>
          <p className="text-[11px] text-white/30 mt-2">
            {brand?.language || "Language not set"} ·{" "}
            {brand?.formatSettings?.visualGenre || "Automatic visual genre"} ·
            Private operating purpose, not your public account bio
          </p>
        </div>
        <div className="flex flex-wrap gap-6 mt-6 text-xs text-white/40">
          <span>
            <strong className="text-white/85 font-semibold">
              {posts.length}
            </strong>{" "}
            Spark posts
          </span>
          <span>
            <strong className="text-white/85 font-semibold">
              {metric(
                account?.source === "token"
                  ? undefined
                  : (account?.subscribersCount ?? account?.followersCount),
              )}
            </strong>{" "}
            {account?.platform.toLowerCase().includes("youtube")
              ? "subscribers"
              : "followers"}
          </span>
          <span>{pending.length} in production</span>
        </div>
      </div>
      <section className="spark-profile-section" aria-label="Production assets">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-sm text-white/80 font-semibold">
            {narrative
              ? "Cast & story world"
              : useCase === "explainer"
                ? "Your content foundation"
                : useCase === "avatar"
                  ? "Your presenter"
                  : "Your creative identity"}
          </h2>
          <p className="text-[10px] text-white/30">Private to Spark</p>
        </div>
        <div className="spark-asset-shelf">
          {(brand?.formatSettings?.contentFormat || brand?.contentFormat) !==
            "faceless" &&
            asset(
              "character",
              character?.name || "Character",
              character?.characterSheetUrl
                ? "Identity reference · reusable"
                : "Add a character reference",
              <User className="w-7 h-7" />,
              character?.imageUrl ||
                character?.avatarUrl ||
                character?.characterSheetUrl,
            )}
          {asset(
            "voice",
            character?.voice?.name || "Narrator voice",
            character?.voice?.locked
              ? "Voice locked · account scope"
              : "Choose or review the voice",
            <Mic className="w-7 h-7" />,
            undefined,
            Boolean(character?.voice?.locked),
          )}
          {narrative ? (
            <>
              {asset(
                "cast",
                `${cast.length} cast members`,
                "Voices & references by character",
                <Layers className="w-7 h-7" />,
              )}
              {asset(
                "world",
                "Story world",
                `${locations.length} canon locations · scene scope`,
                <BookOpen className="w-7 h-7" />,
              )}
              {asset(
                "props",
                "Continuity props",
                `${props.length} established props · series scope`,
                <Film className="w-7 h-7" />,
              )}
            </>
          ) : useCase === "explainer" ? (
            asset(
              "evidence",
              "Sources & visual language",
              "Evidence policy, graphics & captions",
              <BookOpen className="w-7 h-7" />,
            )
          ) : (
            asset(
              "location",
              "Background / set",
              brand?.locationPlateUrl
                ? "Saved reference · not a universal scene lock"
                : "Choose a reusable set when needed",
              <Image className="w-7 h-7" />,
              brand?.locationPlateUrl,
            )
          )}
        </div>
      </section>
      <section className="spark-profile-section">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div role="group" aria-label="Spark content" className="flex gap-5">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`spark-content-tab ${tab === t ? "is-active" : ""}`}
              >
                {t === "published"
                  ? definition.feed
                  : t === "work"
                    ? "In production"
                    : useCase === "drama"
                      ? "Series & seasons"
                      : "Collections"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onAskSpark}
            className="spark-secondary"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Plan with Spark
          </button>
        </div>
        {tab === "published" &&
          (posts.length ? (
            <div
              className={`grid gap-x-4 gap-y-7 ${portrait ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
            >
              {posts.map(contentCard)}
            </div>
          ) : (
            <div className="spark-feed-empty">
              <Video className="w-8 h-8 text-purple-300/25 mx-auto" />
              <h2 className="text-lg font-semibold text-white/80 mt-4">
                Your first {definition.feed.toLowerCase()} start here
              </h2>
              <p className="text-sm text-white/40 leading-relaxed max-w-md mx-auto mt-2">
                Only posts made by Spark and confirmed on this connected account
                appear here. Drafts, exports and your older social posts stay
                separate.
              </p>
              <button
                type="button"
                onClick={onAskSpark}
                className="spark-primary mt-6"
              >
                {definition.prompt}
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        {tab === "work" && (
          <div className="space-y-3">
            {pending.length ? (
              pending.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProductionReviewDetail(onNavigate, p.id)}
                  className="spark-work-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80 truncate">{p.title}</p>
                    <p className="text-xs text-white/35 mt-1">
                      {p.status} · {p.scenes?.length || 0} scenes
                    </p>
                  </div>
                  <span className="text-xs text-purple-300">Open review →</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-white/40 py-7">
                No productions yet. Plan a first piece with Spark.
              </p>
            )}
          </div>
        )}
        {tab === "series" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {scopedSeries.length ? (
              scopedSeries.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSeries(s)}
                  className="spark-series-card text-left"
                >
                  <p className="text-[10px] text-purple-300/55 uppercase tracking-wider">
                    {s.genre || "Story collection"}
                  </p>
                  <h3 className="text-xl text-white/85 font-semibold mt-3">
                    {s.title}
                  </h3>
                  <p className="text-xs text-white/40 leading-relaxed mt-2">
                    {s.logline || s.storyCanon?.worldState || "No logline yet"}
                  </p>
                  <p className="text-xs text-white/30 mt-5">
                    Season {s.currentSeason || 1} ·{" "}
                    {productions.filter((p) => p.seriesId === s.id).length}{" "}
                    productions
                  </p>
                </button>
              ))
            ) : (
              <div className="col-span-full spark-feed-empty">
                <Layers className="w-8 h-8 text-purple-300/25 mx-auto" />
                <h3 className="text-lg text-white/80 mt-4">
                  Build your{" "}
                  {useCase === "drama" ? "first series" : "first collection"}
                </h3>
                <p className="text-sm text-white/40 mt-2">
                  Spark keeps characters, locations and episode continuity
                  together.
                </p>
                <button
                  type="button"
                  onClick={onAskSpark}
                  className="spark-primary mt-5"
                >
                  Plan with Spark
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      <button
        type="button"
        onClick={onAskSpark}
        className="spark-profile-composer"
      >
        <MessageSquare className="w-4 h-4 text-purple-300/70" />
        <span>Ask Spark about this account…</span>
        <span className="ml-auto text-purple-300">↗</span>
      </button>
      <Dialog
        open={Boolean(selectedPost)}
        onOpenChange={(open) => {
          if (!open) setSelectedPost(null);
        }}
      >
        <DialogContent className="spark-experience-dialog sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            {selectedPost?.production.title || "Published post"}
          </DialogTitle>
          <DialogDescription>
            Publication receipt and account-specific observed performance.
          </DialogDescription>
          {selectedPost && (
            <>
              {selectedPost.production.canonicalMasterUrl ||
              selectedPost.production.videoUrl ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[48dvh] rounded-xl bg-black"
                  src={
                    selectedPost.production.canonicalMasterUrl ||
                    selectedPost.production.videoUrl
                  }
                />
              ) : (
                <p className="text-sm text-white/40">
                  Local preview unavailable. View the verified post on its
                  platform.
                </p>
              )}
              <a
                href={selectedPost.url}
                target="_blank"
                rel="noreferrer"
                className="spark-secondary justify-center"
              >
                Open published post
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <div className="grid grid-cols-3 gap-3 py-4">
                {[
                  ["Views", postMetrics?.views],
                  ["Likes", postMetrics?.likes],
                  ["Comments", postMetrics?.comments],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xl text-white/85 font-semibold">
                      {metric(value as number | undefined)}
                    </p>
                    <p className="text-xs text-white/35 mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40">
                {postMetrics
                  ? `Observed account snapshot · ${account?.source} · ${account?.lastSynced || "sync time unavailable"}`
                  : "Post-level metrics not available yet. No performance or retention values have been estimated."}
              </p>
              <button
                type="button"
                onClick={() => onNavigate("/analytics")}
                className="spark-primary"
              >
                Open analytics & learning
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedSeries)}
        onOpenChange={(open) => {
          if (!open) setSelectedSeries(null);
        }}
      >
        <DialogContent className="spark-experience-dialog sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogTitle>{selectedSeries?.title || "Series"}</DialogTitle>
          <DialogDescription>
            Episodes in story order. Production status and public release are
            separate.
          </DialogDescription>
          {selectedSeries && (
            <div className="space-y-3">
              {productions
                .filter((p) => p.seriesId === selectedSeries.id)
                .sort(
                  (a, b) =>
                    (a.seasonNumber || 1) - (b.seasonNumber || 1) ||
                    (a.episodeNumber || 0) - (b.episodeNumber || 0),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProductionReviewDetail(onNavigate, p.id)}
                    className="spark-work-row"
                  >
                    <span className="text-purple-300 text-xs">
                      S{p.seasonNumber || 1} · E{p.episodeNumber || "—"}
                    </span>
                    <span className="text-sm text-white/80 flex-1 text-left">
                      {p.title}
                    </span>
                    <span className="text-xs text-white/35">{p.status}</span>
                  </button>
                ))}
              {!productions.some((p) => p.seriesId === selectedSeries.id) && (
                <p className="text-sm text-white/40">
                  No episodes produced yet.
                </p>
              )}
              <p className="text-xs text-white/40 leading-relaxed">
                {selectedSeries.storyCanon?.worldState ||
                  "Story canon will grow as episodes are approved."}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(assetDetail)}
        onOpenChange={(open) => {
          if (!open) setAssetDetail(null);
        }}
      >
        <DialogContent className="spark-experience-dialog max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            {assetDetail === "world"
              ? "Locations & scene continuity"
              : assetDetail === "props"
                ? "Continuity props"
                : "Explainer foundation"}
          </DialogTitle>
          <DialogDescription>
            Private production references, not public profile content.
          </DialogDescription>
          {assetDetail === "world" ? (
            <>
              <p className="text-sm text-white/45">
                Locations vary by scene. A saved plate is a reference, not a
                fixed background for every film.
              </p>
              {locations.map((l, i) => (
                <div key={`${l.name}-${i}`} className="spark-work-row">
                  {l.plateUrl && (
                    <img
                      src={l.plateUrl}
                      alt={l.name}
                      className="w-16 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm">{l.name}</p>
                    <p className="text-xs text-white/40">{l.description}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAssetDetail(null);
                  onOpenAsset("location");
                }}
                className="spark-primary"
              >
                Open location studio
              </button>
            </>
          ) : assetDetail === "props" ? (
            <>
              {props.length ? (
                props.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="spark-work-row">
                    <div>
                      <p className="text-sm text-white/80">{p.name}</p>
                      <p className="text-xs text-white/40">{p.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/40">
                  No canon props saved yet. Establish them with Spark while
                  planning your series.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setAssetDetail(null);
                  onAskSpark();
                }}
                className="spark-primary"
              >
                Discuss continuity with Spark
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/45">
                Use researched sources for factual scripts. Your current
                narrator, visual genre, graphics and captions remain governed by
                existing production controls.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAssetDetail(null);
                  onEditPurpose();
                }}
                className="spark-primary"
              >
                Edit operating purpose
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SparkSocialProfile({
  onNavigate,
  onOpenAsset,
  onEditPurpose,
}: {
  onNavigate: (path: string) => void;
  onOpenAsset: (kind: AssetKind) => void;
  onEditPurpose: () => void;
}) {
  const {
    brand,
    character,
    characters = [],
    productions = [],
    publishJobs = [],
    seriesList = [],
    updateBrand,
  } = useSpark();
  const [snapshot, setSnapshot] = useState<{
    brandId?: string;
    profiles: LiveAccountProfileCard[];
  }>({ profiles: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSnapshot({ brandId: brand?.id, profiles: [] });
    if (!brand?.id) {
      setLoading(false);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    fetchLiveAccountProfiles(brand.id)
      .then((profiles) => {
        if (!cancelled) setSnapshot({ brandId: brand.id, profiles });
      })
      .catch(() => {
        if (!cancelled) setError("Connected profile refresh is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand?.id, refresh]);
  return (
    <>
      <SparkSocialProfileView
        key={brand?.id || "new"}
        brand={brand}
        character={character}
        characters={characters}
        productions={productions}
        publishJobs={publishJobs}
        series={seriesList}
        profiles={snapshot.brandId === brand?.id ? snapshot.profiles : []}
        loading={loading}
        error={error}
        onRefresh={() => setRefresh((v) => v + 1)}
        onUseCase={(sparkUseCase) =>
          updateBrand({ settings: { ...brand?.settings, sparkUseCase } })
        }
        onNavigate={onNavigate}
        onOpenAsset={onOpenAsset}
        onAskSpark={() => setChatOpen(true)}
        onEditPurpose={onEditPurpose}
      />
      <AIChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onNavigate={onNavigate}
        initialPrompt={useCaseDefinition(resolveSparkUseCase(brand)).prompt}
      />
    </>
  );
}
