# SPARK operational runbooks

These are procedures. They are not a second execution engine.

## PROVIDER OUTAGE

- Detection: provider health in admin, or generation errors with auth/timeout/5xx from one provider.
- Immediate action: leave production generation on only if another eligible provider exists. Otherwise turn **Production Generation OFF**.
- User impact: new provider submits stop. Planning and chat can continue.
- Credit impact: `NOT_SUBMITTED` releases a reservation. `UNKNOWN_SUBMISSION` holds it.
- Recovery: reconcile unknown jobs before any retry. Do not click Generate again on an unknown execution.
- Escalation: provider status page and the stored `providerJobId`.

## UNKNOWN_SUBMISSION

- Detection: execution status `unknown_submission` or `reconciling`, reservation `PENDING_UNKNOWN`.
- Immediate action: do not retry. Do not start a second Generate.
- User impact: the UI must block unsafe retry.
- Credit impact: hold remains until reconciliation.
- Recovery: look up the provider job. Found and succeeded → settle. Confirmed not submitted → release. Still unknown → keep the hold.
- Escalation: `productionId`, `taskId`, `executionId`, `reservationId`, `providerJobId`.

## CREDIT DISPUTE

- Detection: user balance disagrees with the ledger.
- Immediate action: read `credit_reservations` and `credit_ledger` through admin RPCs. Do not edit balances in the client.
- User impact: explain reserved vs consumed vs released. Unknown cost is not free and is not zero.
- Credit impact: none until an admin adjustment RPC is used.
- Recovery: match reservation id to execution id in `production_events`.
- Escalation: finance/admin only.

## FAILED MASTER

- Detection: scenes exist, master URL missing, or FFmpeg runtime error.
- Immediate action: do not regenerate every shot.
- User impact: review shows the failure, not Ready for Review from a clip URL alone.
- Credit impact: completed shots stay settled. Do not re-reserve them.
- Recovery: rerun master assembly only. If FFmpeg is missing, fix the runtime (`postinstall` / `ffmpeg-static`) before retrying the master.
- Escalation: local vs deployed. Deployed FFmpeg is not yet certified.

## SUPABASE OUTAGE

- Detection: auth or REST failures.
- Immediate action: stop new generation. Do not treat a failed write as success.
- User impact: workspace saves and session sync fail visibly.
- Credit impact: if a reservation RPC did not commit, no hold exists. If it committed and the provider call did not, reconcile.
- Recovery: restore Supabase, then hydrate executions. Do not resubmit in-flight work.
- Escalation: Supabase status for `jaqzjhabmtvqtvinoafq`.

## STORAGE FAILURE

- Detection: upload returns no durable Spark URL.
- Immediate action: do not mark the asset fulfilled.
- User impact: that sheet or shot stays missing.
- Credit impact: if the provider image was billed, do not pretend the upload succeeded. Studio-sheet code releases the reservation when the submit throws before a durable URL is kept; a provider that billed after a thrown error still needs reconciliation.
- Recovery: retry the upload from the stored provider URL only when that URL is still valid.
- Escalation: bucket privacy and path ownership. Do not make the bucket public to "fix" a 403.

## PUBLISH FAILURE

- Detection: publish job error, missing connector.
- Immediate action: leave the master and review item intact.
- User impact: not published. Do not invent a calendar slot.
- Credit impact: none. Publish is not a generation.
- Recovery: reconnect the account and retry publish only.
- Escalation: OAuth server secrets, not `VITE_` secrets.

## DISABLE GENERATION

- Detection: operator decision or spend incident.
- Immediate action: turn production generation OFF in the existing guard (`ProductionGenerationGuard`).
- User impact: new `generateAssets` calls are refused. Chat and planning stay available.
- Credit impact: in-flight work is not deleted. Unknown jobs stay held.
- Recovery: turn generation on only after the incident is understood.
- Escalation: record the operator and the time in the admin audit log.

## ROLLBACK DEPLOYMENT

- Detection: a bad frontend or API deploy.
- Immediate action: redeploy the previous known Vercel deployment. Do not `git reset --hard` and do not force-push.
- User impact: UI or API returns to the previous revision.
- Credit impact: database rows are not rolled back by a frontend rollback.
- Recovery: forward-fix schema. Irreversible migrations get a new migration, not a wipe.
- Escalation: there is no canonical Spark Vercel project yet. Do not attach SPARK to `elogiso-art`.
