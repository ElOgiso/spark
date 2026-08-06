import type { ConversationSessionRow } from "../database.types";
import type { ConversationSession } from "../../domain/types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";

const SESSIONS_CACHE_KEY = "spark_conversation_sessions_v1";
const MESSAGES_CACHE_PREFIX = "spark_session_msg_v1_";

export function mapRowToSession(row: ConversationSessionRow): ConversationSession {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id,
    userId: row.user_id,
    title: row.title || "New Executive Session",
    subtitle: row.subtitle || undefined,
    category: row.category as any || "executive",
    isArchived: row.is_archived || false,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export const conversationSessionRepository = {
  /** List all conversation sessions for a brand */
  async listSessions(brandId: string): Promise<ConversationSession[]> {
    const localSessions = this.getLocalSessions(brandId);

    if (!isSupabaseConfigured()) return localSessions;
    const supabase = getSupabaseClient();
    if (!supabase) return localSessions;

    try {
      const { data, error } = await (supabase.from("conversation_sessions") as any)
        .select("*")
        .eq("brand_id", brandId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const remoteSessions = (data as ConversationSessionRow[]).map(mapRowToSession);
        this.saveLocalSessions(brandId, remoteSessions);
        return remoteSessions;
      }
    } catch (err) {
      console.warn("[SessionRepository] Remote fetch notice:", err);
    }

    return localSessions;
  },

  /** Create a new session */
  async createSession(session: Partial<ConversationSession>): Promise<ConversationSession> {
    const newSession: ConversationSession = {
      id: session.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      brandId: session.brandId || "default-brand",
      title: session.title || "New Executive Session",
      subtitle: session.subtitle,
      category: session.category || "executive",
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    const existing = this.getLocalSessions(newSession.brandId);
    const updated = [newSession, ...existing.filter((s) => s.id !== newSession.id)];
    this.saveLocalSessions(newSession.brandId, updated);

    // Sync to Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await (supabase.from("conversation_sessions") as any).insert({
            id: newSession.id,
            brand_id: newSession.brandId,
            title: newSession.title,
            subtitle: newSession.subtitle,
            category: newSession.category,
            is_archived: false,
            created_at: newSession.createdAt,
            updated_at: newSession.updatedAt,
          });
        } catch (err) {
          console.warn("[SessionRepository] Supabase session insert notice:", err);
        }
      }
    }

    return newSession;
  },

  /** Update session details (title, subtitle, category) */
  async updateSession(sessionId: string, updates: Partial<ConversationSession>, brandId: string): Promise<ConversationSession | null> {
    const local = this.getLocalSessions(brandId);
    const targetIdx = local.findIndex((s) => s.id === sessionId);
    if (targetIdx === -1) return null;

    const updatedSession: ConversationSession = {
      ...local[targetIdx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    local[targetIdx] = updatedSession;
    // Move updated session to top
    local.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    this.saveLocalSessions(brandId, local);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await (supabase.from("conversation_sessions") as any)
            .update({
              title: updatedSession.title,
              subtitle: updatedSession.subtitle,
              category: updatedSession.category,
              updated_at: updatedSession.updatedAt,
            })
            .eq("id", sessionId);
        } catch (err) {
          console.warn("[SessionRepository] Supabase update notice:", err);
        }
      }
    }

    return updatedSession;
  },

  /** Delete a session */
  async deleteSession(sessionId: string, brandId: string): Promise<boolean> {
    const local = this.getLocalSessions(brandId);
    const filtered = local.filter((s) => s.id !== sessionId);
    this.saveLocalSessions(brandId, filtered);

    // Remove cached messages
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`${MESSAGES_CACHE_PREFIX}${sessionId}`);
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await (supabase.from("conversation_sessions") as any).delete().eq("id", sessionId);
          await (supabase.from("executive_conversation_messages") as any).delete().eq("session_id", sessionId);
        } catch (err) {
          console.warn("[SessionRepository] Supabase delete notice:", err);
        }
      }
    }

    return true;
  },

  /** Save session messages */
  saveSessionMessages(sessionId: string, messages: any[]): void {
    if (typeof localStorage === "undefined" || !sessionId) return;
    try {
      localStorage.setItem(`${MESSAGES_CACHE_PREFIX}${sessionId}`, JSON.stringify(messages));
    } catch {}
  },

  /** Get session messages */
  getSessionMessages(sessionId: string): any[] {
    if (typeof localStorage === "undefined" || !sessionId) return [];
    try {
      const raw = localStorage.getItem(`${MESSAGES_CACHE_PREFIX}${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /** Internal local storage helpers */
  getLocalSessions(brandId: string): ConversationSession[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(`${SESSIONS_CACHE_KEY}_${brandId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveLocalSessions(brandId: string, sessions: ConversationSession[]): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(`${SESSIONS_CACHE_KEY}_${brandId}`, JSON.stringify(sessions));
    } catch {}
  },
};
