# Spark experience: ongoing design guidance

## Source and precedence

This guide carries the user's approved experience direction into the repository workflow. It is not a second product constitution. Consult the current Notion authorities when making substantive experience decisions:

- [Design truth](https://www.notion.so/38cc371711ff8167a648e24957b6d671)
- [Design system](https://www.notion.so/383c371711ff81fe9e85f021f73c6aae)
- [Visual language](https://www.notion.so/383c371711ff81bd92c1c7ed41822fc3)
- [Experience council plan](https://www.notion.so/3f3c371711ff810bbb2cfbb7c21088c5)
- [Build workflow](https://www.notion.so/3f3c371711ff81da808eff512cabb3ca)
- [Production boundary](https://www.notion.so/38cc371711ff81d68235ece24d794ea6)

The user's latest explicit direction is to extend the original GitHub UI, preserving its obsidian/violet onboarding texture, restraint and high-end feel. Do not replace it with a different palette or navigation because an older reference uses another color system. The linked Figma Make file was not modified by this implementation.

## Non-negotiable experience rules

1. Onboarding is one continuous chat: one timeline, one composer, contextual inline tools. Previously shown controls collapse into editable summaries. No numbered slide sequence in the main setup conversation. Existing legal agreements remain a separate, explicit acceptance flow.
2. The user can express their purpose in natural language or choose a starting point. Spark asks for missing essentials and presents the relevant existing tool. Do not render every configuration tool at once.
3. Use case, public destination, content format, visual genre and production mode are distinct. Selecting drama must not silently lock every scene's background; selecting an explainer does not prohibit a presenter.
4. Import the exact connected account's real avatar, name, handle and description. Generated character imagery belongs in private production assets, not in place of the account avatar. Label unavailable, cached and live data honestly.
5. Show only actual locks, with their scope. A saved character or location reference is not a claim that it is universally locked or generation-proof.
6. Public feed membership requires a publication receipt: production, exact destination account, normalized platform, platform post ID and HTTPS post URL. Exports, local masters and a `Published` label without a receipt are not proof of public posting.
7. Performance is observed and account-specific. Missing metrics are unavailable, never zero by assumption. Historical imported platform content is not a Spark-created post.
8. Keep the existing router, authentication, workspace sync, review, asset studios, analytics, approvals, billing and production executor authoritative. Do not build a parallel execution path for a visual feature.

## Screen-by-screen implementation map

| Surface | Purpose | Existing path retained |
| --- | --- | --- |
| Onboarding welcome | Original branded entry | BrandGenesisFlow / FrameEntry |
| Chat setup | Purpose, identity, connection, format, character, voice, operating choices and summary, inline as needed | Existing frame controls and ModelRouter response service |
| Social Influencer profile | Portrait post grid, character, voice and reusable set | MY SPARK and existing asset studios |
| Short Movies profile | Landscape short-film shelf, cast, scene locations and continuity props | MY SPARK, production review, series canon |
| Explainer profile | Landscape channel-style video shelf, narrator and evidence/visual-language entry | Existing research controls and analytics |
| Drama profile | Portrait episode feed, series/seasons and ordered episode details | Existing production-series data and review |
| Talking Avatar profile | Presenter clips, character, narrator voice and reusable set | Existing character, voice and location controls |
| Films profile | Landscape release shelf, cast/world references and collections | Existing series canon and production review |
| Published post details | Master preview, verified platform link and available observed metrics | Existing publication receipts and connected-account snapshots |
| Private controls | Existing sources, identity, assets and settings, progressively disclosed | Existing desktop/mobile MY SPARK controls |

Desktop and mobile share the profile component. Navigation remains unchanged. Finishing onboarding opens MY SPARK. Profile chat opens the existing AI chat with a suggested prompt; it does not automatically send, generate, spend or publish.

## Implementation boundaries and verification

- Purpose is persisted in the existing brand settings envelope. Receipts are persisted in existing publish-job metadata. No database migration or alternate persistence service was introduced.
- OAuth resume envelopes carry user, workspace and setup mode, and preserve the chat. Local conversation drafts are scoped to the setup workspace and user.
- Setup completion awaits the canonical initializer; save failures preserve the draft and surface an error instead of treating an eight-second timeout as success.
- Voice-library preview buttons play available saved samples; they do not synthesize speech as a fallback. Existing paid studios and production billing remain authoritative.
- Tests cover purpose/format separation, missing-essential tool selection, receipt mapping, cross-account feed exclusion and legacy non-receipt records. TypeScript and the production bundle are checked separately.
- The verification browser could not reach this workspace's local server. Rendered desktop/mobile layouts, authenticated OAuth return, live database writes and real platform publication have **not** been certified by this change. Validate these in the existing deployed application before calling it live-ready.
- Do not treat the six profile variants as a completed visual polish pass for every existing application page. Review, analytics, scheduling and asset-studio routes remain the existing implementation; future screen work must use this same guide and verify those surfaces individually.

## Manual acceptance checklist

- On each viewport, confirm the chat composer stays accessible and long conversation history scrolls without page sliding or unwanted reader jumps.
- Change purpose in chat, revisit a prior tool, defer optional assets and finish setup. Verify only the current inline tool is interactive.
- Reload mid-setup; return from real OAuth; switch users/workspaces. Confirm no other account's draft, identity, metrics or posts appear.
- For each of the six use cases, inspect empty/populated feed, private assets, production rows and relevant series details.
- Force profile refresh and setup-save failures. Confirm no fabricated identity, counts, publication or completion success.
- Verify the receipt survives a real database reload and matches the actual published platform post. Refresh account-specific metrics and confirm unavailable values remain marked unavailable.
- Check keyboard focus, labels, dialogs, reduced motion, narrow-screen overflow and existing navigation/review/studio links.
