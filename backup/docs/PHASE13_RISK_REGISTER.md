# SPARK Phase 13 Risk Register

This document registers the risks associated with the Multi-Agent Operating System runtime implementation and defines standard rollback recovery strategies.

---

## 1. Risk Matrix

### A. State Management & Desynchronization
* **Risk**: Switching to asynchronous database queries causes UI components to render empty lists before repository calls resolve.
* **Severity**: High
* **Mitigation**: Implement progressive loaders (skeletons) and seed default offline fallbacks inside the context during async execution.

### B. Database Integration & Supabase Connection Drops
* **Risk**: Slow network connections or API gateway drop-offs trigger crash states on transactions.
* **Severity**: High
* **Mitigation**: Expose a dual-write mechanism. If Supabase repository calls timeout, write data to LocalStorage and queue a background sync handler.

### C. Model Routing & Provider Failures
* **Risk**: Rate limits (429) or endpoint outages block content generation completely.
* **Severity**: Critical
* **Mitigation**: Bind target fallback routes inside the Model Router (e.g. failing Gemini Flash calls automatically swap to OpenAI or Claude backups).

### D. Single-Threaded UI Blocking (Scaling)
* **Risk**: Autonomous execution steps (like video analysis or scraping) run on the client's browser thread, locking the UI page.
* **Severity**: Medium
* **Mitigation**: Restrict client agents to low-overhead text formatting. Offload media compiling and heavy API calls to background worker threads or cloud queues.

---

## 2. Rollback Recovery Strategy

To handle breaking changes or runtime regressions, the team enforces a three-tier rollback procedure:

```text
1. Branch Hotfix (Localize patch)
  │
  ▼
2. Toggle VITE_USE_SUPABASE=false (De-activate Cloud Sync, revert to LocalStorage)
  │
  ▼
3. Git revert (Revert codebase state back to ad2bf01)
```

1. **Feature Toggle Guard**: The application is wrapped in `isSupabaseConfigured()`. Set `VITE_USE_SUPABASE=false` in the production environment variables to bypass database repositories and restore the mock LocalStorage engine.
2. **Commit Rollback**: If a fatal regression escapes testing, revert the codebase state back to Git commit `ad2bf01` (Multi-Agent Architecture Foundation).
3. **Database Restore**: Maintain daily backups on the Supabase console to restore Postgres tables to clean states if data corruption occurs.
