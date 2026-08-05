# SPARK Executive Control Model

This document outlines how the user (the Executive) controls SPARK's multi-agent runtime operations. The interface abstracts underlying models, placing focus on policy management, overrides, and audit trails.

---

## 1. Automation & Governance Modes

The Executive sets the operational boundaries of the runtime using three modes:

* **Manual**: Every pipeline step (from Research selection to Publishing) is held in a paused state. The agent compiles drafts but cannot proceed without explicit manual approval clicks.
* **Balanced**: Background research and data collection run autonomously. Production drafting is processed, but creative reviews and publish steps are blocked for executive sign-off.
* **Autonomous**: The pipeline executes end-to-end. Content is compiled and scheduled autonomously unless pre-flight safety flags fall below confidence boundaries.

---

## 2. Emergency Controls & Overrides

To prevent runtime anomalies, the Executive has access to real-time control hooks:

* **Emergency Stop (Kill Switch)**: Immediately halts all active dispatcher threads, terminates pending LLM API connections, and locks the pipeline state in a `paused` status.
* **Pause Department**: Pauses execution requests for a specific department (e.g. halts Research while keeping Creative active).
* **Resume**: Re-activates a paused department or pipeline step.
* **Override / Force Execute**: Bypasses the Policy Engine's confidence blocks to force execution of a halted task.
* **Undo**: Reverts a state mutation (e.g. restoring an archived memory rule or unscheduling a calendar post).
* **Audit History**: Displays trace history logs showing which agent executed which step, associated costs, and user approval logs.
