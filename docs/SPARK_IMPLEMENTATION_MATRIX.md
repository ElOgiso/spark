# SPARK Implementation Matrix

This master matrix maps every subsystem in the SPARK Media Operating System against the requirements outlined in the architectural specifications, comparing local codebase state, Vercel deployments, and Supabase connections.

## Verified hardening checkpoint — 2026-09-23

The historical matrix below is not a current production-readiness certification.
The current Notion implementation program (`3e3c371711ff80d8ada6f0389a364476`)
defines Phase 13 as Format Directors / Production Modes. Earlier documents use
different phase numbers; do not implement duplicate systems from those labels.

- Applied and verified `protect_profile_privileges` on the connected Spark database:
  authenticated users cannot insert profiles or update role, super-admin status,
  credits, approval status, or reviewer fields. Display/onboarding updates remain
  available, and the existing privileged admin RPCs retain access.
- Branch changes protect generation APIs with verified active sessions, check
  supplied brand ownership, constrain credential-bearing destinations to provider
  hosts, and refuse redirects. Existing browser generation callers send sessions.
  Server deployments require `SUPABASE_URL` and a Supabase publishable/anon key
  (the existing service-role configuration is also recognized).
- Repaired canonical task/shot field reads, QC repair contracts, master assembly's
  missing import and result type, review chapter rendering, and legacy spoken-beat
  normalization. Insufficient spoken content still fails validation.
- `npm test` discovers all test files, including the previously omitted modules,
  and disables the default live database client. Configured repository tests use
  explicit fakes. Typecheck and production build pass at this checkpoint.

These branch changes have not been deployed. Remaining audited release blockers
include server-authoritative credit reservation/settlement on the live generation
path, OAuth token isolation and ownership hardening, durable job reconciliation,
media-ingestion isolation, real publishing execution, and the remaining phased
production work. Phase 12 modules existing in source does not establish that every
live path uses them. Do not mark Phase 13–22 complete from this checkpoint.

Official research: Higgsfield's [changelog](https://higgsfield.ai/creator-hub/changelog)
describes Astra handling logic/orchestration while Higgsfield generates assets.
Spark retains its existing provider-neutral production spine; this is not a reason
to introduce another orchestration or provider integration system.

## Master Subsystem Matrix

| Product Area | Notion Status | GitHub Status | Vercel Status | Supabase Status | Current Maturity | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Onboarding & Auth** | Requires secure account access & profile initialization | Built in `AuthContext.tsx`, `AuthGate.tsx`, & `AuthPanel.tsx` | Active. Directs to credentials panels if auth is forced | Active when `VITE_USE_SUPABASE=true`. Implements standard email sign-in/up | 🟡 Partial | Falls back to offline LocalStorage demo mode if Supabase is unconfigured |
| **Home Dashboard (SPARK)** | Demands brand switcher, briefing, pipeline snapshots, active platforms | Built in `SparkHome.tsx`. Maps dashboard widgets to local context data | Live. Renders all grid cards, briefings, and connected account summaries | Inactive (Unconfigured fallback active) | ✅ Implemented | Read/write mutations operate via local state persistence |
| **AI Workspace (MY SPARK)** | Conversational workspace. Perplexity-style prompts for trend reports | Built in `MySpark.tsx`. Clean conversational input interface | Live. Allows typing and selecting prompt pills | Inactive | 🔵 Mock | Conversational logs render static simulated outputs |
| **Opportunity Engine (VIRAL SPARKS)** | Platform scrapers analyzing viral metrics, velocity, and creator fits | Built in `ViralSparks.tsx`. Renders card lists with opportunity scores | Live. Renders trending templates and fit badges | Inactive | 🔵 Mock | Core database feeds are loaded from hardcoded mock lists |
| **Review Pipeline (REVIEW)** | Creative Review gate. Allows approving, rejecting, or editing draft scripts | Built in `ReviewCenter.tsx` & `CreativeReview.tsx`. Wired to state triggers | Live. Working editor with scene detail grids | Inactive | ✅ Implemented | State actions mutate live pipeline status reactively |
| **Scheduling (CALENDAR & PUBLISH)** | Drag-scheduler for planning and scheduling publications | Built in `Calendar.tsx`. Plotting of upcoming publishing posts | Live. Renders full monthly planner layout | Inactive | 🟡 Partial | Drag-and-drop handles are visual; no actual external API publisher is connected |
| **Analytics (ANALYTICS)** | View growth metrics, retention curves, and recommendation signals | Built in `Analytics.tsx`. Custom SVG/HTML chart layouts | Live. High-performance charts | Inactive | 🟡 Partial | Graphs rendering is functional, but analytics inputs are fed from static lists |
| **Settings & Systems (Assets, Memory, Billing, API)** | Assets upload lists, memory rule sheets, API token keys, billing plans | Built in `MorePage.tsx` & `MoreSubPages.tsx`. Connects add/delete buttons | Live. Fully functional tables | Inactive | ✅ Implemented | Direct modification of memory rules and asset lists works |
| **Mobile Layout** | Bottom navigation tabs, scroll cards, native-like mobile wrappers | Built in `src/app/components/mobile` directory | Live. Automatically loads when responsive width shrinks | Inactive | ✅ Implemented | Follows the "Apple Fitness x Spotify" scroll feed template |
| **AI Copilot Agent** | Contextual voice/text assistant supporting inline previews and approvals | Built in `AIChatPill.tsx` & `AIChatModal.tsx`. Connects TTS, STT, and state actions | Live. Full-screen modal accessible from greetings | Inactive | ✅ Implemented | Drives actual platform operations (Approve, Edit, Generate) inside the chat bubble |

---

## Maturity Definitions

* **✅ Implemented**: Core product functionality is fully built, interactive, and connected to the active state layer.
* **🟡 Partial**: Core visual layouts are complete, but certain sub-features or integrations (like external APIs) are absent.
* **🔵 Mock**: UI is fully built, but data and actions are hardcoded or simulated.
* **⚪ Planned**: Feature is mapped out but not yet implemented in the codebase.
* **🔴 Missing**: Specified requirement is absent from both the codebase and mock data.
