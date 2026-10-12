# Spark UI / experience workflow

Before changing onboarding, MY SPARK, navigation, creative controls or publication views, read `docs/design/SPARK_EXPERIENCE_GUIDE.md` and the relevant current architecture documents.

For remaining-screen UI work, also read `docs/design/SPARK_SCREEN_ROLLOUT.md`. Consolidate one feature implementation and its existing backend authority; do not retain parallel desktop/mobile/theme business workflows.

Improve the existing application; do not create a competing UI or production spine. Preserve the user's existing onboarding visual language and navigation unless they explicitly request a structural change. Keep public account identity, private production assets and publishing evidence distinct. Never replace unavailable live data with believable sample data.

For each changed screen, check loading, empty, populated, error, workspace-switch and mobile states. Document which checks are automated and which require live account access. Do not report provider, OAuth, publishing, database or visual verification as completed without evidence.
