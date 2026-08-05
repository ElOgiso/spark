# SPARK Department Operating Model

This document defines the mission, operational inputs, outputs, capabilities, and key performance indicators (KPIs) for every department unit inside the SPARK Media Operating System.

---

## 1. Operating Unit Definitions

### A. Research Department
* **Mission**: Extract actionable high-potential trends matching the brand profile.
* **Inputs**: Target niche parameters, active search queries.
* **Outputs**: Raw opportunity lists (`ViralSpark[]`).
* **Capabilities**: `webSearch`, `longContext`.
* **Dependencies**: `ISparkService`.
* **Policies**: Max scrape rate limits.
* **KPIs**: Discovery rate, opportunity alignment score.
* **Failure Modes**: Missing trend signals, network timeouts.

### B. Creative Department
* **Mission**: Compile storyboards and narratives localized to active guidelines.
* **Inputs**: Selected trend `ViralSpark`, tone settings.
* **Outputs**: Formatted scripts.
* **Capabilities**: `writing`, `styleConsistency`, `toneAdaptation`.
* **Dependencies**: `IMemoryService`.
* **Policies**: Brand voice guidelines enforcement.
* **KPIs**: Script formatting score, content policy adherence.
* **Failure Modes**: AI text repetition, policy violations.

### C. Director Department
* **Mission**: Coordinates production schedules and resolves campaign planning.
* **Inputs**: Approved campaign plans.
* **Outputs**: Planned steps list.
* **Capabilities**: `strategicPlanning`, `decisionSynthesis`.
* **Dependencies**: `SparkContext`.
* **Policies**: Calendar timing guidelines.
* **KPIs**: Step progression speed, execution rate.
* **Failure Modes**: Workflow lockups.

### D. Production Department
* **Mission**: Translate scripts into scene-by-scene storyboard components.
* **Inputs**: Active script blocks, format ratios.
* **Outputs**: storyboards.
* **Capabilities**: `imageGeneration`, `videoGeneration`.
* **Dependencies**: `IProductionService`.
* **Policies**: Aspect ratio validations.
* **KPIs**: Render quality rating.
* **Failure Modes**: Rendering timeout, malformed JSON schemas.

### E. Review Department
* **Mission**: Act as the compliance gate checking safety and technical values.
* **Inputs**: Storyboard layouts, safety parameters.
* **Outputs**: Approved / Edit required status codes.
* **Capabilities**: `decisionSynthesis`, `deepReasoning`.
* **Dependencies**: `IReviewService`.
* **Policies**: Strict compliance safety gates.
* **KPIs**: True positive safety catch rate.
* **Failure Modes**: Safety rating errors.

### F. Publishing Department
* **Mission**: Dispatch completed packages to target social APIs.
* **Inputs**: Approved review media, platform credentials.
* **Outputs**: API publish confirmation ids.
* **Capabilities**: `publishing`.
* **Dependencies**: `ICalendarService`.
* **Policies**: Auth token validation guidelines.
* **KPIs**: Scheduling precision.
* **Failure Modes**: Expired platform tokens.

### G. Analytics Department
* **Mission**: Poll views, CTR, and retention metrics.
* **Inputs**: Published post stats.
* **Outputs**: CSV data audits.
* **Capabilities**: `analytics`.
* **Dependencies**: `IAnalyticsService`.
* **Policies**: Interval metrics checks.
* **KPIs**: Metric ingestion delay.
* **Failure Modes**: API rate limits.

### H. Learning Department
* **Mission**: Identify winning formats to formulate memory rules.
* **Inputs**: Post analytics audits.
* **Outputs**: Propose memory guidelines.
* **Capabilities**: `planning`, `reasoning`.
* **Dependencies**: `IMemoryService`.
* **Policies**: Policy Engine rules check.
* **KPIs**: Strategic rule generation accuracy.
* **Failure Modes**: Inconsistent guidelines.

### I. Memory Department
* **Mission**: Maintain active rules registry.
* **Inputs**: Brand rules updates.
* **Outputs**: Registered rule indexes.
* **Capabilities**: `memory`.
* **Dependencies**: `IMemoryService`.
* **Policies**: Rules duplication checks.
* **KPIs**: Index query speeds.
* **Failure Modes**: Rules database conflicts.
