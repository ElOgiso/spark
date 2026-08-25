/**
 * Spark Media OS — Social Platform Connector Framework
 * 
 * STABILITY MODE: Every connector must prove itself using live API responses.
 * - Token exchange happens server-side via Vercel functions (secrets never in browser)
 * - Analytics return "No analytics available" until real API responds
 * - Publishing returns failure until real API is called
 * - No fabricated accounts, usernames, or metrics
 */

import { eventBus } from "./runtime/eventBus";

export type AccountConnectionStatus =
  | "Connecting"
  | "Connected"
  | "Refreshing"
  | "Expired"
  | "Permission Lost"
  | "Disconnected"
  | "Needs Reauthorization";

export interface SocialProfileMetadata {
  displayName: string;
  username: string;
  avatarUrl: string;
  channelId: string;
  verified: boolean;
  followersCount: number;
  subscribersCount?: number;
  description?: string;
  postsCount?: number;
  totalViews?: number;
  followingCount?: number;
  country?: string;
  publishedAt?: string;
  profileUrl?: string;
  website?: string;
  platform?: string;
  hiddenSubscriberCount?: boolean;
}

/** Rich profile card for Analytics / account surfaces (live API or token cache). */
export interface LiveAccountProfileCard extends SocialProfileMetadata {
  platform: string;
  source: "live" | "cached" | "token";
  error?: string;
  lastSynced?: string;
  content?: Array<{
    id: string;
    title: string;
    publishedAt?: string;
    thumbnail?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    url?: string;
  }>;
}

export interface PlatformAnalyticsData {
  platform: string;
  followers: number;
  views: number;
  engagementRate: number;
  watchTimeHours: number;
  ctrPercent: number;
  impressions: number;
  postsCount: number;
  growthPercent: number;
  lastSynced: string;
  available: boolean;
  unavailableReason?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  publishedAt?: string;
  error?: string;
}

export interface ConnectedAccountToken {
  id?: string;
  brand_id?: string;
  platform: string;
  handle: string;
  displayName: string;
  avatar: string;
  channelId: string;
  verified: boolean;
  status: AccountConnectionStatus;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
  permissionsGranted: string[];
  connectedAt: string;
  lastSyncAt: string;
  /** Cached live profile fields for Analytics cards */
  description?: string;
  followersCount?: number;
  subscribersCount?: number;
  postsCount?: number;
  totalViews?: number;
  followingCount?: number;
  country?: string;
  profileUrl?: string;
  website?: string;
}

export interface OAuthProviderConfig {
  platform: string;
  authUrl: string;
  clientId: string;
  scopes: string[];
  redirectUri: string;
}

// Client-safe values only — NO secrets
const GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  "";

const X_CLIENT_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_TWITTER_CLIENT_ID) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_X_CLIENT_ID) ||
  "";

function originBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
}

/** Always compute at call-time so preview/prod hosts match Google Console redirect URIs. */
export function getGoogleRedirectUri(): string {
  return `${originBase()}/auth/google/callback`;
}

export function getXRedirectUri(): string {
  return `${originBase()}/auth/x/callback`;
}

export function getDefaultRedirectUri(): string {
  return `${originBase()}/auth/callback`;
}

export const OAUTH_CONFIGS: Record<string, OAuthProviderConfig> = {
  "YouTube Shorts": {
    platform: "YouTube Shorts",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: GOOGLE_CLIENT_ID,
    scopes: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    get redirectUri() {
      return getGoogleRedirectUri();
    },
  },
  TikTok: {
    platform: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    clientId:
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_TIKTOK_CLIENT_KEY) || "",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    get redirectUri() {
      return getDefaultRedirectUri();
    },
  },
  Instagram: {
    platform: "Instagram",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId:
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_META_APP_ID) || "",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_read_engagement"],
    get redirectUri() {
      return getDefaultRedirectUri();
    },
  },
  Facebook: {
    platform: "Facebook",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId:
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_META_APP_ID) || "",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    get redirectUri() {
      return getDefaultRedirectUri();
    },
  },
  LinkedIn: {
    platform: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    clientId:
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_LINKEDIN_CLIENT_ID) || "",
    scopes: ["r_liteprofile", "w_member_social", "r_organization_social"],
    get redirectUri() {
      return getDefaultRedirectUri();
    },
  },
  "Twitter/X": {
    platform: "Twitter/X",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    clientId: X_CLIENT_ID,
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    get redirectUri() {
      return getXRedirectUri();
    },
  },
};

export type SocialProvider = "YouTube Shorts" | "Twitter/X" | "TikTok" | "Instagram" | "Facebook" | "LinkedIn";

export interface ITokenStore {
  saveToken(token: ConnectedAccountToken, opts?: { silent?: boolean }): void;
  getStoredTokens(): Record<string, ConnectedAccountToken>;
  getValidAccessToken(platform: string): Promise<string>;
}

export interface IOAuthManager {
  getAuthUrl(provider: SocialProvider): string;
  exchangeCode(provider: SocialProvider, code: string, redirectUri: string, additional?: any): Promise<ConnectedAccountToken>;
  refreshToken(provider: SocialProvider, refreshToken: string, workspaceId: string): Promise<any>;
}

export interface IProfileFetcher {
  fetchProfile(provider: SocialProvider, accessToken: string): Promise<SocialProfileMetadata>;
}

export interface IAnalyticsFetcher {
  fetchAnalytics(provider: SocialProvider, accessToken: string): Promise<PlatformAnalyticsData>;
}

export interface IPublisher {
  publish(provider: SocialProvider, accessToken: string, mediaData: any): Promise<PublishResult>;
}

/**
 * Unified Social Platform Adapter Interface
 */
export interface ISocialPlatformAdapter {
  platform: string;
  getAuthUrl(): string;
  exchangeCodeForTokens(code: string): Promise<ConnectedAccountToken>;
  fetchProfileMetadata(accessToken: string): Promise<SocialProfileMetadata>;
  publishMedia(accessToken: string, job: any): Promise<PublishResult>;
  fetchAnalytics(accessToken: string): Promise<PlatformAnalyticsData>;
}

/**
 * PKCE pair generator with proper SHA-256 hashing.
 */
export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

  // SHA-256 hash the verifier for the challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge };
}

/**
 * Helper: return "not available" analytics
 */
function unavailableAnalytics(platform: string, reason: string): PlatformAnalyticsData {
  return {
    platform,
    followers: 0,
    views: 0,
    engagementRate: 0,
    watchTimeHours: 0,
    ctrPercent: 0,
    impressions: 0,
    postsCount: 0,
    growthPercent: 0,
    lastSynced: new Date().toISOString(),
    available: false,
    unavailableReason: reason,
  };
}

/**
 * YouTube Platform Adapter — server-side token exchange via /api/auth/google/callback
 */
class YouTubePlatformAdapter implements ISocialPlatformAdapter {
  platform = "YouTube Shorts";

  getAuthUrl(): string {
    const config = OAUTH_CONFIGS[this.platform];
    if (!config.clientId) {
      console.error("[YouTubeAdapter] VITE_GOOGLE_CLIENT_ID not configured");
      return "#";
    }
    const tokens = socialConnectorFramework.getStoredTokens();
    const existing = tokens["YouTube Shorts"] || tokens["YouTube"] || tokens["youtube"];
    const hasRefreshToken = Boolean(existing?.refreshToken);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: hasRefreshToken ? "consent select_account" : "consent",
      state: `spark_oauth_youtube_${Date.now()}`,
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<ConnectedAccountToken> {
    const now = new Date().toISOString();
    const config = OAUTH_CONFIGS[this.platform];

    // Server-side exchange — no client secret in browser
    const res = await fetch("/api/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Connection failed: ${errData.error || errData.detail || res.statusText}`);
    }

    const data = await res.json();

    if (!data.access_token) {
      throw new Error("Connection failed: No access token received from Google");
    }

    const profile = data.profile;
    if (!profile) {
      throw new Error("Connection failed: Could not retrieve YouTube channel data");
    }

    const connectedAccount: ConnectedAccountToken = {
      platform: this.platform,
      handle: profile.username || "Unknown",
      displayName: profile.displayName || "Unknown",
      avatar: profile.avatarUrl || "",
      channelId: profile.channelId || "",
      verified: true,
      status: "Connected",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || "",
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      scopes: (data.scope || "").split(" "),
      permissionsGranted: (data.scope || "").split(" "),
      connectedAt: now,
      lastSyncAt: now,
    };

    eventBus.emit("ACCOUNT_CONNECTED", { platform: this.platform, handle: profile.username });
    return connectedAccount;
  }

  async fetchProfileMetadata(accessToken: string): Promise<SocialProfileMetadata> {
    // Prefer server proxy (no CORS issues)
    try {
      const proxy = await fetch("/api/runtime/social-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: this.platform, access_token: accessToken }),
      });
      if (proxy.ok) {
        const data = await proxy.json();
        if (data?.profile) return data.profile as SocialProfileMetadata;
      }
    } catch {
      /* fall through to direct */
    }

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,status&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`YouTube profile fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data?.items?.[0]) {
      const item = data.items[0];
      const title = item.snippet.title;
      const customUrl = item.snippet.customUrl || "";
      return {
        platform: this.platform,
        displayName: title,
        username: customUrl
          ? `@${customUrl.replace(/^@+/, "")}`
          : `@${title.toLowerCase().replace(/\s+/g, "").replace(/^@+/, "")}`,
        avatarUrl:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
        channelId: item.id,
        verified: true,
        description: item.snippet.description || "",
        followersCount: parseInt(item.statistics.subscriberCount || "0", 10),
        subscribersCount: parseInt(item.statistics.subscriberCount || "0", 10),
        postsCount: parseInt(item.statistics.videoCount || "0", 10),
        totalViews: parseInt(item.statistics.viewCount || "0", 10),
        country: item.snippet.country || "",
        publishedAt: item.snippet.publishedAt || "",
        profileUrl: item.id
          ? `https://www.youtube.com/channel/${item.id}`
          : "https://www.youtube.com",
        hiddenSubscriberCount: Boolean(item.statistics.hiddenSubscriberCount),
      };
    }

    throw new Error("No YouTube channel found for authenticated Google account");
  }

  async publishMedia(_accessToken: string, _job: any): Promise<PublishResult> {
    // Real YouTube upload requires resumable upload API — not yet implemented
    return {
      success: false,
      error: "YouTube publishing not yet connected. Upload API integration pending.",
    };
  }

  async fetchAnalytics(accessToken: string): Promise<PlatformAnalyticsData> {
    const { fetchAnalyticsViaPipeline } = await import("./analyticsPipeline");
    return fetchAnalyticsViaPipeline(this.platform, accessToken);
  }
}

/**
 * X (Twitter) Platform Adapter — server-side token exchange via /api/auth/x/callback
 */
class XPlatformAdapter implements ISocialPlatformAdapter {
  platform = "Twitter/X";

  getAuthUrl(): string {
    const config = OAUTH_CONFIGS[this.platform];
    if (!config.clientId) {
      console.error("[XAdapter] VITE_TWITTER_CLIENT_ID / VITE_X_CLIENT_ID not configured");
      return "#";
    }

    // Generate PKCE synchronously for URL construction
    // We use plain method here and do proper S256 in the async flow
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

    // Store verifier for callback
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("spark_x_pkce_verifier", codeVerifier);
    }

    // For S256, we need async — use plain as fallback for sync getAuthUrl
    // Twitter accepts plain for public clients using PKCE
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      state: `spark_oauth_x_${Date.now()}`,
      code_challenge: codeVerifier,
      code_challenge_method: "plain",
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<ConnectedAccountToken> {
    const now = new Date().toISOString();
    const config = OAUTH_CONFIGS[this.platform];
    const codeVerifier =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("spark_x_pkce_verifier") || ""
        : "";

    if (!codeVerifier) {
      throw new Error("Connection failed: PKCE code_verifier not found. Please try connecting again.");
    }

    // Server-side exchange — no client secret in browser
    const res = await fetch("/api/auth/x/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: config.redirectUri,
      }),
    });

    // Clean up PKCE verifier
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("spark_x_pkce_verifier");
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Connection failed: ${errData.error || errData.detail || res.statusText}`);
    }

    const data = await res.json();

    if (!data.access_token) {
      throw new Error("Connection failed: No access token received from X");
    }

    const profile = data.profile;
    if (!profile) {
      throw new Error("Connection failed: Could not retrieve X profile data");
    }

    const connectedAccount: ConnectedAccountToken = {
      platform: this.platform,
      handle: profile.username || "Unknown",
      displayName: profile.displayName || "Unknown",
      avatar: profile.avatarUrl || "",
      channelId: profile.userId || "",
      verified: profile.verified || false,
      status: "Connected",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || "",
      expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
      scopes: (data.scope || "").split(" "),
      permissionsGranted: (data.scope || "").split(" "),
      connectedAt: now,
      lastSyncAt: now,
    };

    eventBus.emit("ACCOUNT_CONNECTED", { platform: this.platform, handle: profile.username });
    return connectedAccount;
  }

  async fetchProfileMetadata(accessToken: string): Promise<SocialProfileMetadata> {
    try {
      const proxy = await fetch("/api/runtime/social-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: this.platform, access_token: accessToken }),
      });
      if (proxy.ok) {
        const data = await proxy.json();
        if (data?.profile) return data.profile as SocialProfileMetadata;
      }
    } catch {
      /* fall through */
    }

    const res = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,verified,description,created_at,url,location",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`X user profile fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data?.data) {
      const u = data.data;
      return {
        platform: this.platform,
        displayName: u.name,
        username: `@${(u.username || "").replace(/^@+/, "")}`,
        avatarUrl: (u.profile_image_url || "").replace("_normal", "_400x400"),
        channelId: u.id,
        verified: Boolean(u.verified),
        description: u.description || "",
        followersCount: u.public_metrics?.followers_count || 0,
        subscribersCount: u.public_metrics?.followers_count || 0,
        postsCount: u.public_metrics?.tweet_count || 0,
        followingCount: u.public_metrics?.following_count || 0,
        country: u.location || "",
        publishedAt: u.created_at || "",
        profileUrl: `https://x.com/${u.username}`,
        website: u.url || "",
      };
    }

    throw new Error("No X profile found for authenticated token");
  }

  async publishMedia(_accessToken: string, _job: any): Promise<PublishResult> {
    return {
      success: false,
      error: "X publishing not yet connected. Tweet API integration pending.",
    };
  }

  async fetchAnalytics(accessToken: string): Promise<PlatformAnalyticsData> {
    const { fetchAnalyticsViaPipeline } = await import("./analyticsPipeline");
    return fetchAnalyticsViaPipeline(this.platform, accessToken);
  }
}

/**
 * Generic Base Platform Adapter — used for platforms without real OAuth yet
 */
class BasePlatformAdapter implements ISocialPlatformAdapter {
  constructor(public platform: string) {}

  getAuthUrl(): string {
    const config = OAUTH_CONFIGS[this.platform];
    if (!config || !config.clientId) {
      console.warn(`[${this.platform}] OAuth credentials not configured`);
      return "#";
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state: `spark_oauth_${this.platform.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`,
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(_code: string): Promise<ConnectedAccountToken> {
    throw new Error(`Connection failed: ${this.platform} OAuth integration is not yet available.`);
  }

  async fetchProfileMetadata(_accessToken: string): Promise<SocialProfileMetadata> {
    throw new Error(`${this.platform} profile retrieval is not yet available.`);
  }

  async publishMedia(_accessToken: string, _job: any): Promise<PublishResult> {
    return {
      success: false,
      error: `${this.platform} publishing is not yet connected.`,
    };
  }

  async fetchAnalytics(_accessToken: string): Promise<PlatformAnalyticsData> {
    return unavailableAnalytics(this.platform, `${this.platform} analytics not yet connected`);
  }
}

export function normalizePlatformKey(platform: string): string {
  const lower = String(platform || "").toLowerCase().trim();
  if (
    lower.includes("youtube") ||
    lower.includes("youtu") ||
    lower === "yt" ||
    lower === "google" ||
    lower === "googledrive" ||
    lower === "google drive"
  ) {
    return "youtube";
  }
  if (
    lower.includes("twitter") ||
    lower === "x" ||
    lower.startsWith("x/") ||
    lower.endsWith("/x") ||
    lower === "twitter/x" ||
    lower === "x/twitter"
  ) {
    return "x";
  }
  if (lower.includes("tiktok") || lower === "tik tok") {
    return "tiktok";
  }
  if (lower.includes("instagram") || lower.includes("insta") || lower === "ig") {
    return "instagram";
  }
  if (lower.includes("facebook") || lower === "fb" || lower.includes("meta")) {
    return "facebook";
  }
  if (lower.includes("linkedin") || lower === "li") {
    return "linkedin";
  }
  return lower;
}

export interface CanonicalPlatformAccount {
  platform: string;
  rawPlatform: string;
  handle: string;
  displayName: string;
  avatar?: string;
  status: "connected" | "needs_reconnect" | "disconnected";
  active: boolean;
  refreshToken?: string;
  accessToken?: string;
}

/**
 * Builds a unified canonical platform map from local OAuth tokens and cloud Supabase accounts.
 * Single source of truth for Accounts UI header counts, status badges, and row lookups.
 */
export function buildPlatformAccountMap(
  contextAccounts?: any[]
): Map<string, CanonicalPlatformAccount> {
  const map = new Map<string, CanonicalPlatformAccount>();
  const liveStoredTokens = getStoredAccountTokens();

  // 1. Ingest local OAuth token store
  Object.values(liveStoredTokens).forEach((t) => {
    if (!t) return;
    const pKey = normalizePlatformKey(t.platform);
    const statusLower = String(t.status || "").toLowerCase();
    const hasRefresh = Boolean(t.refreshToken);
    const isExplicitInvalid =
      statusLower === "needs reauthorization" ||
      statusLower === "needs_reconnect" ||
      statusLower === "disconnected" ||
      statusLower === "invalid_grant" ||
      (statusLower === "expired" && !hasRefresh);
    const isConn =
      !isExplicitInvalid &&
      (hasRefresh || ["connected", "refreshing", "active"].includes(statusLower));

    map.set(pKey, {
      platform: pKey,
      rawPlatform: t.platform,
      handle: t.handle || "",
      displayName: t.displayName || t.handle || pKey,
      avatar: t.avatar,
      status: isConn ? "connected" : hasRefresh ? "needs_reconnect" : "disconnected",
      active: isConn,
      refreshToken: t.refreshToken,
      accessToken: t.accessToken,
    });
  });

  // 2. Ingest Supabase context accounts (cloud state merge)
  if (Array.isArray(contextAccounts)) {
    contextAccounts.forEach((acc: any) => {
      if (!acc) return;
      const pKey = normalizePlatformKey(acc.platform);
      const statusLower = String(acc.status || "").toLowerCase();
      const hasRefresh = Boolean(acc.permissions?.refresh_token || acc.refreshToken);
      const isExplicitInvalid =
        statusLower === "needs_reconnect" ||
        statusLower === "needs reauthorization" ||
        statusLower === "disconnected" ||
        statusLower === "invalid_grant";
      const isConn =
        !isExplicitInvalid &&
        (["connected", "active", "refreshing"].includes(statusLower) || hasRefresh);

      const existing = map.get(pKey);
      if (existing) {
        if (isConn) {
          existing.status = "connected";
          existing.active = true;
        }
        if (acc.handle && !existing.handle) existing.handle = acc.handle;
        if (acc.displayName && !existing.displayName) existing.displayName = acc.displayName;
        if (acc.avatar && !existing.avatar) existing.avatar = acc.avatar;
      } else {
        map.set(pKey, {
          platform: pKey,
          rawPlatform: acc.platform,
          handle: acc.handle || "",
          displayName: acc.displayName || acc.handle || pKey,
          avatar: acc.avatar,
          status: isConn ? "connected" : hasRefresh ? "needs_reconnect" : "disconnected",
          active: isConn,
          refreshToken: acc.permissions?.refresh_token || acc.refreshToken,
          accessToken: acc.permissions?.access_token || acc.accessToken,
        });
      }
    });
  }

  return map;
}

export class SocialConnectorFramework implements ITokenStore, IOAuthManager, IProfileFetcher, IAnalyticsFetcher, IPublisher {
  private static instance: SocialConnectorFramework;
  private adapters: Map<string, ISocialPlatformAdapter> = new Map();

  constructor() {
    this.adapters.set("YouTube Shorts", new YouTubePlatformAdapter());
    this.adapters.set("Twitter/X", new XPlatformAdapter());
    const platforms = ["TikTok", "Instagram", "Facebook", "LinkedIn"];
    platforms.forEach((p) => this.adapters.set(p, new BasePlatformAdapter(p)));
    
    // Fire-and-forget async config pre-load on startup
    this.loadClientConfig().catch((err) => {
      console.warn("[SocialConnectorFramework] Pre-load error:", err);
    });
  }

  async loadClientConfig(): Promise<void> {
    try {
      const res = await fetch("/api/auth/config");
      if (res.ok) {
        const data = await res.json();
        if (data.googleClientId) {
          OAUTH_CONFIGS["YouTube Shorts"].clientId = data.googleClientId;
        }
        if (data.xClientId) {
          OAUTH_CONFIGS["Twitter/X"].clientId = data.xClientId;
        }
      }
    } catch (err) {
      console.warn("[SocialConnectorFramework] Failed to load server client configuration:", err);
    }
  }

  static getInstance(): SocialConnectorFramework {
    if (!SocialConnectorFramework.instance) {
      SocialConnectorFramework.instance = new SocialConnectorFramework();
    }
    return SocialConnectorFramework.instance;
  }

  getAdapter(platform: string): ISocialPlatformAdapter {
    const norm = normalizePlatformKey(platform);
    if (norm === "youtube") return this.adapters.get("YouTube Shorts")!;
    if (norm === "x") return this.adapters.get("Twitter/X")!;
    if (norm === "tiktok") return this.adapters.get("TikTok") || new BasePlatformAdapter("TikTok");
    if (norm === "instagram") return this.adapters.get("Instagram") || new BasePlatformAdapter("Instagram");
    if (norm === "facebook") return this.adapters.get("Facebook") || new BasePlatformAdapter("Facebook");
    if (norm === "linkedin") return this.adapters.get("LinkedIn") || new BasePlatformAdapter("LinkedIn");
    return this.adapters.get(platform) || new BasePlatformAdapter(platform);
  }

  getAuthUrl(platform: string): string {
    return this.getAdapter(platform).getAuthUrl();
  }

  saveToken(token: ConnectedAccountToken, opts?: { silent?: boolean }): void {
    try {
      const stored = this.getStoredTokens();
      const pKey = normalizePlatformKey(token.platform);
      stored[pKey] = { ...token, platform: pKey };
      localStorage.setItem("spark_social_account_tokens_v2", JSON.stringify(stored));
      // silent=true when analytics pipeline enriches cache (avoid re-sync loops)
      if (!opts?.silent) {
        eventBus.emit("ACCOUNT_CONNECTED", { platform: pKey, handle: token.handle });
      }
    } catch (err) {
      console.warn("[SocialConnectorFramework] Token save error:", err);
    }
  }

  getStoredTokens(): Record<string, ConnectedAccountToken> {
    try {
      const stored = localStorage.getItem("spark_social_account_tokens_v2");
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      const normalized: Record<string, ConnectedAccountToken> = {};
      Object.entries(parsed).forEach(([k, tok]: [string, any]) => {
        if (tok && typeof tok === "object") {
          const pKey = normalizePlatformKey(tok.platform || k);
          normalized[pKey] = { ...tok, platform: pKey };
        }
      });
      return normalized;
    } catch {
      return {};
    }
  }

  async getValidAccessToken(platform: string): Promise<string> {
    const tokens = this.getStoredTokens();
    const pKey = normalizePlatformKey(platform);
    const token = tokens[pKey] || tokens[platform];
    if (!token) return "";

    // If expired or about to expire (within 60 seconds)
    if (token.expiresAt && token.expiresAt < Date.now() + 60 * 1000 && token.refreshToken) {
      console.log(`[SocialConnectorFramework] Access token for ${platform} is expired or expiring soon. Refreshing...`);
      try {
        const isGoogle = pKey.includes("youtube") || platform.toLowerCase().includes("youtube");
        const endpoint = isGoogle ? "/api/auth/google/refresh" : "/api/auth/x/refresh";
        const brandId = getBrandWorkspaceId();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refresh_token: token.refreshToken,
            workspace_id: brandId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          token.accessToken = data.access_token;
          if (data.refresh_token) {
            token.refreshToken = data.refresh_token;
          }
          token.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          token.status = "Connected";
          this.saveToken(token);
          if (brandId) {
            const { persistAccountToken } = await import("../backend/workspaceSync");
            void persistAccountToken(brandId, token);
          }
        } else {
          console.warn(`[SocialConnectorFramework] Token refresh failed for ${platform}. Marking needs reauthorization.`);
          token.status = "Needs Reauthorization";
          this.saveToken(token);
          if (brandId) {
            const { persistAccountToken } = await import("../backend/workspaceSync");
            void persistAccountToken(brandId, { ...token, status: "needs_reconnect" });
          }
        }
      } catch (err) {
        console.warn("[SocialConnectorFramework] Automatic token refresh failed:", err);
      }
    }
    return token.status === "Needs Reauthorization" || token.status === "Disconnected" ? "" : (token.accessToken || "");
  }

  // IOAuthManager
  async exchangeCode(provider: SocialProvider, code: string, redirectUri: string, additional?: any): Promise<ConnectedAccountToken> {
    return this.getAdapter(provider).exchangeCodeForTokens(code);
  }

  async refreshToken(provider: SocialProvider, refreshToken: string, workspaceId: string): Promise<any> {
    const endpoint = (provider === "YouTube Shorts") ? "/api/auth/google/refresh" : "/api/auth/x/refresh";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken, workspace_id: workspaceId }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.statusText}`);
    return res.json();
  }

  // IProfileFetcher
  async fetchProfile(provider: SocialProvider, accessToken: string): Promise<SocialProfileMetadata> {
    return this.getAdapter(provider).fetchProfileMetadata(accessToken);
  }

  // IAnalyticsFetcher
  async fetchAnalytics(provider: SocialProvider, accessToken: string): Promise<PlatformAnalyticsData> {
    return this.getAdapter(provider).fetchAnalytics(accessToken);
  }

  // IPublisher
  async publish(provider: SocialProvider, accessToken: string, mediaData: any): Promise<PublishResult> {
    return this.getAdapter(provider).publishMedia(accessToken, mediaData);
  }
}

export const socialConnectorFramework = SocialConnectorFramework.getInstance();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Live brand workspace id only — never fall back to brand name strings. */
export function getBrandWorkspaceId(): string {
  try {
    const id = localStorage.getItem("spark_current_brand_id") || "";
    if (UUID_RE.test(id)) return id;
  } catch {
    /* ignore */
  }
  return "";
}

export function getOAuthAuthorizationUrl(platform: string): string {
  return socialConnectorFramework.getAuthUrl(platform);
}

export function saveConnectedAccountToken(token: ConnectedAccountToken): void {
  socialConnectorFramework.saveToken(token);
  const brandId = getBrandWorkspaceId();
  if (brandId) {
    void import("../backend/workspaceSync").then(({ persistAccountToken }) => {
      void persistAccountToken(brandId, token);
    });
  }
  // Notify workspace UI to merge connected account into live accounts list
  try {
    eventBus.emit("ACCOUNT_CONNECTED", {
      platform: token.platform,
      handle: token.handle,
      displayName: token.displayName,
      status: "Connected",
    });
    window.dispatchEvent(
      new CustomEvent("spark-account-connected", {
        detail: {
          platform: token.platform,
          handle: token.handle,
          displayName: token.displayName,
        },
      })
    );
  } catch {
    /* ignore */
  }

  // Phase 6J: immediately ingest live analytics for all connected platforms
  void import("./analyticsPipeline")
    .then(({ syncConnectedPlatformAnalytics }) => syncConnectedPlatformAnalytics())
    .catch((err) => console.warn("[OAuth] analytics sync after connect failed", err));
}

export function getStoredAccountTokens(): Record<string, ConnectedAccountToken> {
  return socialConnectorFramework.getStoredTokens();
}

function platformKeysMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.includes("youtube") && nb.includes("youtube")) return true;
  if ((na === "x" || na.includes("twitter")) && (nb === "x" || nb.includes("twitter"))) return true;
  return false;
}

/** Purge all local token caches, brand pointers, and onboarding state across user sign-out boundaries. */
export function clearAllStoredAccountTokens(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem("spark_social_account_tokens_v2");
    localStorage.removeItem("spark_platform_analytics_v1");
    localStorage.removeItem("spark_current_brand_id");
    localStorage.removeItem("spark_current_brand_name");
    localStorage.removeItem("spark_onboarding_state");
    localStorage.removeItem("spark_onboarding_step");
    localStorage.removeItem("spark_onboarding_resume_state");
    localStorage.removeItem("spark_onboarding_complete");
    localStorage.removeItem("spark_demo_user");
  } catch (err) {
    console.warn("[socialIntegrationService] Token purge notice:", err);
  }
}

/** Remove a connected social account from local token store + optional Supabase row. */
export async function disconnectConnectedAccount(platform: string): Promise<void> {
  try {
    const stored = socialConnectorFramework.getStoredTokens();
    const next: Record<string, ConnectedAccountToken> = {};
    for (const [key, token] of Object.entries(stored)) {
      if (!platformKeysMatch(key, platform) && !platformKeysMatch(token.platform, platform)) {
        next[key] = token;
      }
    }
    localStorage.setItem("spark_social_account_tokens_v2", JSON.stringify(next));

    eventBus.emit("ACCOUNT_DISCONNECTED", { platform });
    window.dispatchEvent(
      new CustomEvent("spark-account-disconnected", { detail: { platform } })
    );
  } catch (err) {
    console.warn("[disconnectConnectedAccount] local remove error:", err);
  }

  const brandId = getBrandWorkspaceId();
  if (!brandId) return;

  try {
    const { supabase } = await import("../backend/supabaseClient");
    if (!supabase) return;

    // Delete matching platform rows (YouTube Shorts / YouTube aliases)
    const platformsToClear = [platform];
    if (platformKeysMatch(platform, "YouTube Shorts")) {
      platformsToClear.push("YouTube Shorts", "YouTube", "youtube");
    }
    if (platformKeysMatch(platform, "Twitter/X")) {
      platformsToClear.push("Twitter/X", "Twitter", "X");
    }
    const unique = Array.from(new Set(platformsToClear));
    for (const p of unique) {
      await (supabase.from("accounts") as any)
        .delete()
        .eq("brand_id", brandId)
        .eq("platform", p);
    }
  } catch (err) {
    console.warn("[disconnectConnectedAccount] supabase remove error:", err);
  }
}

/**
 * Ensure valid Google/YouTube access token.
 * Refreshes silently using refresh_token if expired or within 5 min of expiry.
 * Connected means: refresh_token present + not revoked.
 */
export async function ensureValidGoogleAccess(
  accountOrPlatform?: string | { platform?: string; accessToken?: string; refreshToken?: string; expiresAt?: number }
): Promise<string | null> {
  const pKey = typeof accountOrPlatform === "string" ? accountOrPlatform : (accountOrPlatform?.platform || "YouTube Shorts");
  const stored = socialConnectorFramework.getStoredTokens();
  const normKey = normalizePlatformKey(pKey);
  const token = stored[normKey] || stored["YouTube Shorts"] || stored["YouTube"] || stored["youtube"];

  const effectiveRefreshToken = (typeof accountOrPlatform === "object" && accountOrPlatform?.refreshToken) || token?.refreshToken;
  const effectiveAccessToken = (typeof accountOrPlatform === "object" && accountOrPlatform?.accessToken) || token?.accessToken;
  const effectiveExpiresAt = (typeof accountOrPlatform === "object" && accountOrPlatform?.expiresAt) || token?.expiresAt || 0;

  if (!effectiveRefreshToken) {
    if (token) {
      token.status = "Needs Reauthorization";
      socialConnectorFramework.saveToken(token, { silent: true });
    }
    return null;
  }

  const SKEW_MS = 5 * 60 * 1000; // 5 minutes
  if (effectiveAccessToken && effectiveExpiresAt > Date.now() + SKEW_MS) {
    return effectiveAccessToken;
  }

  // Token is expired or expiring within 5 minutes — refresh silently
  console.log(`[ensureValidGoogleAccess] Performing silent OAuth refresh for Google/YouTube...`);
  try {
    const brandId = getBrandWorkspaceId();
    const res = await fetch("/api/auth/google/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: effectiveRefreshToken,
        workspace_id: brandId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || effectiveRefreshToken;
      const newExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      if (token) {
        token.accessToken = newAccessToken;
        token.refreshToken = newRefreshToken;
        token.expiresAt = newExpiresAt;
        token.status = "Connected";
        socialConnectorFramework.saveToken(token, { silent: true });
      }

      if (brandId) {
        const { persistAccountToken } = await import("../backend/workspaceSync");
        void persistAccountToken(brandId, {
          platform: "YouTube Shorts",
          status: "connected",
          handle: token?.handle || "YouTube",
          displayName: token?.displayName || "YouTube",
          avatar: token?.avatar,
          permissions: {
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_at: Math.floor(newExpiresAt / 1000),
          },
        });
      }

      // Notify UI that connection is verified and alive
      try {
        window.dispatchEvent(
          new CustomEvent("spark-account-connected", {
            detail: {
              platform: "YouTube Shorts",
              handle: token?.handle,
              displayName: token?.displayName,
            },
          })
        );
      } catch {}

      return newAccessToken;
    } else {
      const errText = await res.text();
      console.warn("[ensureValidGoogleAccess] Refresh failed:", res.status, errText);
      if (res.status === 400 || res.status === 401) {
        if (token) {
          token.status = "Needs Reauthorization";
          socialConnectorFramework.saveToken(token, { silent: true });
        }
        try {
          window.dispatchEvent(
            new CustomEvent("spark-account-needs-reconnect", {
              detail: { platform: "YouTube Shorts" },
            })
          );
        } catch {}
      }
      return null;
    }
  } catch (err) {
    console.warn("[ensureValidGoogleAccess] Network error during refresh:", err);
    return null;
  }
}

/** Live connected platforms from local OAuth token store only (no mock fillers). */
export function listLiveConnectedAccounts(): Array<{
  platform: string;
  handle: string;
  displayName: string;
  status: "connected" | "needs_reconnect";
  active: boolean;
}> {
  return Array.from(buildPlatformAccountMap().values())
    .filter((a) => a.status === "connected" || a.status === "needs_reconnect")
    .map((a) => ({
      platform: a.platform,
      handle: a.handle || "",
      displayName: a.displayName || a.handle || a.platform,
      status: a.status as "connected" | "needs_reconnect",
      active: a.active,
    }));
}

function formatCount(n?: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export { formatCount };

/**
 * Fetch live profile cards for all connected OAuth accounts (YouTube, X, …).
 * Phase 6J: runs full analytics pipeline (profile + channel stats + recent content).
 */
export async function fetchLiveAccountProfiles(): Promise<LiveAccountProfileCard[]> {
  const tokens = Object.values(getStoredAccountTokens()).filter(
    (t) => !t.status || ["connected", "refreshing", "active"].includes(String(t.status).toLowerCase())
  );
  if (tokens.length === 0) return [];

  try {
    const { syncConnectedPlatformAnalytics } = await import("./analyticsPipeline");
    const result = await syncConnectedPlatformAnalytics();
    if (result.profiles.length > 0) return result.profiles;
  } catch (err) {
    console.warn("[fetchLiveAccountProfiles] pipeline sync failed, token fallback", err);
  }

  // Fallback: token cache only
  let cacheMap: any = {};
  try {
    const raw = localStorage.getItem("spark_platform_analytics_v1");
    if (raw) cacheMap = JSON.parse(raw);
  } catch {}

  return tokens.map((token) => ({
    platform: token.platform,
    displayName: token.displayName || token.handle || token.platform,
    username: token.handle || "",
    avatarUrl: token.avatar || "",
    channelId: token.channelId || "",
    verified: Boolean(token.verified),
    followersCount: token.followersCount ?? 0,
    subscribersCount: token.subscribersCount ?? token.followersCount,
    description: token.description || "",
    postsCount: token.postsCount,
    totalViews: token.totalViews,
    followingCount: token.followingCount,
    country: token.country,
    profileUrl: token.profileUrl,
    website: token.website,
    source: "token" as const,
    lastSynced: token.lastSyncAt,
    content: cacheMap[token.platform]?.content || [],
  }));
}
