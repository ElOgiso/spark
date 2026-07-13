# SPARK Architecture Gap Report

This gap report cross-references the current SPARK Single Page Application (SPA) codebase with the target provider-agnostic multi-agent operating system architecture. It outlines verified layouts and documents the integration gaps.

---

## 1. Verification of Existing UI / UX

We have verified that the current GitHub codebase contains the complete, approved visual interfaces and requires **no UI or styling redesign**:
* **Executive Dashboard (`SparkHome.tsx`)**: Displays workspace summaries, greeting grids, connected accounts lists, and active pipeline snap cards.
* **Review Center (`ReviewCenter.tsx` & `CreativeReview.tsx`)**: Storyboard inspection panels, safety check badges, and draft video playbacks.
* **Calendar Planner (`Calendar.tsx`)**: Plotting of scheduled post blocks across platforms.
* **Analytics Console (`Analytics.tsx`)**: Custom SVG graphs plotting views and retention drop curves.
* **Brand Memory Control (`MorePage.tsx` / `MoreSubPages.tsx`)**: Custom rules directories and assets upload tables.
* **Automation Modes Control (`GovernanceStatus.tsx` / settings)**: Switches between Manual, Balanced, and Autonomous policies.
* **Executive Chat Console (`AIChatPill.tsx` & `AIChatModal.tsx`)**: Slide-out assistant driving approvals and delegating pipeline generation steps.

---

## 2. Identified Architectural Gaps

To shift SPARK from its current mock-persistence state into an active, provider-agnostic multi-agent system, the following gaps must be resolved:

### A. Stateless Policy & Pipeline Services
* **Gap**: State transitions (e.g. creating a production from a spark) are directly written inside `SparkContext.tsx` or using direct checks on string constants (e.g. `mode === "autonomous"`).
* **Fix**: Scaffold the `ExecutivePolicyEngine` and `PipelineEngine` to isolate governance rules and workflow sequences.

### B. Live Model Routing & Provider Adapters
* **Gap**: There are no provider client adapters. The chat and generators return simulated local messages.
* **Fix**: Implement the `ILlmProvider` and `IModelRouter` interfaces, and set up client wrappers targeting the active model providers (Gemini, Claude, OpenAI).

### C. Live Database Sync & RLS
* **Gap**: Local persistence runs on LocalStorage. The Supabase repository adapters (`src/app/backend/repositories/`) return mock results when the client is unconfigured.
* **Fix**: Apply the SQL schema migrations to the Supabase console, activate `VITE_USE_SUPABASE=true`, and synchronize context actions to run database CRUD queries.

### D. Media Assembly & Publishing API Pipelines
* **Gap**: Calendar scheduling is a client-side mockup; no files are pushed to YouTube or TikTok. Videos inside the Review queue point to static public MP4 folders.
* **Fix**: Integrate a serverless video rendering framework (e.g. Remotion) and platform OAuth publishers to post approved content.
