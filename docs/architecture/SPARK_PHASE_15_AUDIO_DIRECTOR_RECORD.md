# Phase 15 — Audio Director timeline integration

Date: 2026-09-24. Audited GitHub main: `0160e9f` (including the newly published Phase 14 checkpoint).
Source: Notion implementation program, Phase 15 Audio Director.

## Existing systems extended

`AudioSpec`, editorial assembly and audio mix, FFmpeg mastering handoff, canonical
asset persistence, and the live AssetService adapter remain the authorities.
No new generation service, router, credit ledger, UI, or database migration.
The pending Phase 13 implementation was rebased onto the newer reliability fixes;
those fixes and the Phase 14 spend gates are preserved. Phase 14 runtime gates remain.

## Implemented behavior

- Audio track plans identify their scene/shot, asset or master reference, source
  trim, production placement, volume, optional loop and lane.
- Narration is placed once per scene, not repeated on every coverage shot. Hybrid
  narration starts after talent dialogue; source offsets are independent of
  production offsets. Source duration is used when supplied by persisted assets.
- Narration, dialogue, music, SFX and ambience bind only to completed sources for
  this production. Ambiguous sources do not silently win. Existing untyped voice
  assets retain narrowly scoped compatibility.
- Voice conversion is an explicit source/target/output relationship on a speech
  track. A converted output replaces the original and preserves lineage; a missing
  output is unresolved. No unsupported conversion provider is invented.
- Embedded video dialogue is marked as embedded in the render plan, preventing
  duplicate mixing. Separately supplied dialogue carries suppression automation
  for the overlapping original video audio.
- Music gains, fades and speech ducking cover all lanes, honor track mute/solo,
  and remain bounded by the timeline. SFX/ambience retain scene placement.
- The existing FFmpeg render plan carries all audio inputs, source trims,
  placements, gains, loop flags, automation, duck targets/triggers, output codec,
  channels/sample rate, and optional LUFS/true-peak targets.
- Missing required audio and measured speech overflow block mastering. Unmeasured
  legacy audio duration produces a warning; planned timing is never labeled measured.
- Canonical persisted/restored voice/music/SFX assets carry audio roles. The live
  compatibility adapter labels narration and passes generated SFX into editorial.

## Runtime boundaries

The live mastering adapter now dispatches `audio_master` through the existing
`/api/runtime/video` endpoint. It rebuilds the soundtrack from source clips and
planned external audio, copies the Phase 14 visual stream unchanged, and persists
a verified MP4 through existing storage. Source trims, placement, loops, gain,
fade, ducking and embedded dialogue are rendered with bundled FFmpeg/ffprobe.
Optional loudness targets are measured after encoding and failures are surfaced.
Failed audio mastering cannot be labeled a completed live production.
Authenticated brand access, production-scoped storage URLs, local-only media
protocols, bounded downloads and cleanup apply to the executor. A visual/timeline
duration mismatch blocks finishing instead of silently changing another phase.

Voice-conversion provider submission remains unsupported: a supplied converted
output is required and retains lineage. Hosted deployment and paid production
runs have not been verified. No new provider spending or API function is added.

## Verification

The rebased baseline passed 1,295 tests. Added focused regression coverage for mixed
speech timing, source identity, soundtrack lanes, conversion lineage, measured
speech overflow, mix bounds, the mastering handoff, missing audio and coverage-shot
narration duplication, scene cues and master references. Final verification:
1,312 tests passed after rebasing onto the Phase 14 and saved-output recovery changes; TypeScript check passed, production build passed, and diff
whitespace checks passed. Existing build warnings remain. No paid provider calls.

## Runtime follow-up verification

Built on main `77a4202`, preserving the concurrent Phase 14 shared compiler.
1,326 tests passed; application TypeScript and production build passed. Real media
checks verify narration placement, removal of previously baked audio, music
looping/ducking, and byte-identical copied video streams. FFmpeg and ffprobe are
pinned server dependencies with explicit Vercel binary inclusion.
