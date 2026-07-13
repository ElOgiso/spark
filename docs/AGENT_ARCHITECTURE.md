# SPARK Agent Architecture

This document defines the agent architecture of the SPARK Media Operating System. It outlines the responsibilities, inputs, outputs, allowed actions, and execution boundaries for every specialized AI worker department in the ecosystem.

---

## 1. Research Agent
* **Purpose**: Analyzes real-world platform signals and trends to discover content ideas matching the brand.
* **Responsibilities**:
  - Monitors viral growth metrics, creator channels, and search queries.
  - Generates hook templates and opportunity briefs.
* **Inputs**: Target niche, platform keywords, country codes, active memory rules.
* **Outputs**: `ViralSpark` data blocks containing hook patterns, platform fits, and confidence scores.
* **Dependencies**: `SparkService`, `accounts` list.
* **Allowed Actions**: Query public data, check fit indicators, suggest opportunities.
* **Forbidden Actions**: Create productions, schedule posts, modify brand rules.

---

## 2. Creative Agent
* **Purpose**: Transforms raw research sparks into scripted narrative concepts.
* **Responsibilities**:
  - Outlines video hooks, body scripts, and visual instructions.
  - Matches tone and vocabulary to brand guidelines.
* **Inputs**: `ViralSpark`, active tone parameters, persona details.
* **Outputs**: Programmatic scripts, narrative snippets, opening hook visual blocks.
* **Dependencies**: `ISparkService`, `IMemoryService`.
* **Allowed Actions**: Generate script drafts, suggest visual pacing rules.
* **Forbidden Actions**: Auto-approve reviews, edit scheduled times.

---

## 3. Production Agent
* **Purpose**: Assembles script layouts into scene-by-scene storyboard drafts.
* **Responsibilities**:
  - Compiles camera shots, aspect ratios, dynamic asset listings.
  - Generates mock audio/video preview parameters.
* **Inputs**: Creative script blocks, target aspect ratios (e.g. 9:16).
* **Outputs**: `Production` objects containing structured scene details and mockup files.
* **Dependencies**: `IProductionService`, `assets` store.
* **Allowed Actions**: Generate production drafts, request media asset renders.
* **Forbidden Actions**: Push files directly to social platforms, edit safety scores.

---

## 4. Review Coordinator
* **Purpose**: Orchestrates the pre-flight creative review gate and compliance checks.
* **Responsibilities**:
  - Performs brand alignment, policy safety, and technical quality checks.
  - Blocks or progresses production files based on checks.
* **Inputs**: `Production` drafts, sensitive content guidelines.
* **Outputs**: `ReviewItem` containing quality checks (`brandSafety`, `policyCheck`, `technicalCheck`).
* **Dependencies**: `IReviewService`, `ExecutivePolicyEngine`.
* **Allowed Actions**: Flag warnings, move status to "Approved" or "Needs Edit".
* **Forbidden Actions**: Re-write scripts, edit calendar times.

---

## 5. Publishing Agent
* **Purpose**: Packs approved production assets and schedules them for release.
* **Responsibilities**:
  - Formulates captions, tags, and schedules posts on target calendars.
* **Inputs**: Approved `ReviewItem`, calendar time blocks, active accounts handles.
* **Outputs**: `PublishJob` blocks, zipped `ExportPackage` files.
* **Dependencies**: `ICalendarService`, `ExecutivePolicyEngine`.
* **Allowed Actions**: Generate publish blocks, schedule publishing times.
* **Forbidden Actions**: Review content, edit narrative scripts.

---

## 6. Analytics Agent
* **Purpose**: Monitors post-release metrics and performance benchmarks.
* **Responsibilities**:
  - Audits views, subscriber growth CTR, and retention drop curves.
* **Inputs**: Published posts stats, platform metrics logs.
* **Outputs**: `AnalyticsInsight` snapshots containing performance summaries.
* **Dependencies**: `IAnalyticsService`.
* **Allowed Actions**: Extract performance drop curves, suggest format optimization tips.
* **Forbidden Actions**: Modify active rules, schedule publishing jobs.

---

## 7. Learning Agent
* **Purpose**: Interprets analytics results and feeds rules back to the system.
* **Responsibilities**:
  - Discovers winning and failing patterns.
  - Formulates guidelines for the brand memory.
* **Inputs**: `AnalyticsInsight` summaries.
* **Outputs**: Strategic memory updates.
* **Dependencies**: `IMemoryService`, `ExecutivePolicyEngine`.
* **Allowed Actions**: Propose rules, flag failed formats.
* **Forbidden Actions**: Delete user profiles, override connected accounts.

---

## 8. Brand Memory
* **Purpose**: The central guardrail directory storing guidelines and rules.
* **Responsibilities**:
  - Maintains the active rules registry used by Research and Creative agents.
* **Inputs**: Core settings, Learning Agent rule outputs.
* **Outputs**: Brand rules list, target parameters.
* **Dependencies**: `IMemoryService`.
* **Allowed Actions**: Append guidelines, archive rules.
* **Forbidden Actions**: Alter publishing jobs directly.
