# SPARK Architecture Boundary (locked)

## Conversation Layer vs Runtime Layer

```
User message
  → AIChatModal
  → SparkContext.sendMessage
  → InteractionController  (ONLY chat entry)
       ├─ IntentRouter.classify + mode gates
       ├─ ConversationController  (no agents, no DAG)
       └─ onTriggerWorkspace(ExecutionRequest)
            → RuntimeOrchestrator  (DAG / providers)
```

Rules:
1. Chat UI never imports RuntimeOrchestrator directly.
2. Runtime rejects non-workspace `ExecutionRequest` (`isWorkspaceTask` must be true).
3. Manual + Balanced automation require explicit Approve before runtime.
4. Autonomous may run workspace intents without per-prompt approval.
5. Provider simulation must be labeled; never silent “real” success.

## Persistence

- Local: `localStorage` (`spark_state_v2`) offline cache.
- Live: Supabase when `VITE_USE_SUPABASE=true` + signed-in user.
- Brand hydrate: Auth bootstrap → `ensureDefaultBrand` / existing brand → domain map.
- Brand save: debounced `updateBrand` from SparkContext.
