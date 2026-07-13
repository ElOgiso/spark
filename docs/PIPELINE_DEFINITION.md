# SPARK Pipeline Definition

This document outlines the master production pipeline stages, outlining the inputs, outputs, failure states, and approval policies for every stage of content production in the SPARK Media Operating System.

---

## 1. Master Pipeline Sequence

```text
Discovery ──► Research ──► Creative ──► Production ──► Review ──► Publishing ──► Analytics ──► Learning
```

---

## 2. Detailed Stage Definitions

### A. Discovery Stage
* **Inputs**: Brand configuration parameters, connected accounts.
* **Outputs**: Raw opportunity lists with potential virality metrics.
* **Failure States**: No trends found, platform connection timeouts.
* **Retry Rules**: Recalculate parameters with alternative country tags after 30 seconds.
* **Automation Behavior**:
  - *Manual*: Pauses for user click.
  - *Balanced* & *Autonomous*: Executes continuously in the background.

### B. Research Stage
* **Inputs**: Target opportunity card.
* **Outputs**: Hook angles and retention prediction statistics.
* **Failure States**: Fit metrics drop below 60%.
* **Retry Rules**: Shift focus to adjacent content pillars.
* **Automation Behavior**:
  - *Manual* & *Balanced*: Pauses for executive selection.
  - *Autonomous*: Chooses high-confidence hooks automatically.

### C. Creative Stage
* **Inputs**: Hook angle details, brand voice guidelines.
* **Outputs**: Script drafts and scene cues.
* **Failure States**: Policy validation errors (e.g. sensitive keyword matches).
* **Retry Rules**: Re-write scripts using synonym rules.
* **Automation Behavior**:
  - *Manual* & *Balanced*: Stays locked in "Drafting" status until user edits.
  - *Autonomous*: Auto-compiles script JSON.

### D. Production Stage
* **Inputs**: Script scenes, layout assets.
* **Outputs**: Storyboard mockups, video rendering templates.
* **Failure States**: Missing asset files, resolution mismatches.
* **Retry Rules**: Regenerate canvas components.
* **Automation Behavior**:
  - *Manual*: Pauses.
  - *Balanced* & *Autonomous*: Initiates storyboard draft.

### E. Review Stage
* **Inputs**: Structured draft files, safety scores.
* **Outputs**: Approved / Needs Edit state transitions.
* **Failure States**: Brand safety rating drops to "Warning" or "Failed".
* **Retry Rules**: Return to Creative stage for script adjustment.
* **Automation Behavior**:
  - *Manual* & *Balanced*: Requires manual click on **Approve** button.
  - *Autonomous*: Auto-approves if all safety checks pass `Passed`.

### F. Publishing Stage
* **Inputs**: Approved production files, scheduled post time.
* **Outputs**: Scheduled post blocks, completed publish tokens.
* **Failure States**: Network token expiration, upload file errors.
* **Retry Rules**: Re-try upload every 10 minutes (up to 3 times).
* **Automation Behavior**:
  - *Manual*: Pauses.
  - *Balanced* & *Autonomous*: Schedules publish job automatically.

### G. Analytics Stage
* **Inputs**: Live video retention statistics.
* **Outputs**: Performance drop-off reports.
* **Failure States**: Zero analytics data returned from API.
* **Retry Rules**: Query metrics provider again after 1 hour.
* **Automation Behavior**:
  - Automatically fetches stats in all modes.

### H. Learning Stage
* **Inputs**: Performance insights, retention drop curves.
* **Outputs**: New memory rules and formatting guidelines.
* **Failure States**: Ambiguous trend patterns (no clear signal).
* **Retry Rules**: Merge with other snapshot files to find patterns.
* **Automation Behavior**:
  - *Manual*: Requests user confirmation before adding rules.
  - *Balanced* & *Autonomous*: Saves rules directly to active memory list.
