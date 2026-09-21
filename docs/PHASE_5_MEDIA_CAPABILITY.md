# Phase 5: Capability Fact Layer & Model Catalog Alignment

Authoritative technical documentation for SPARK Phase 5.

## 1. Overview
The Capability Fact Layer provides provider-neutral, verifiable ground truth regarding AI model parameters and constraints. It bridges runtime model declarations in `MODEL_CATALOG` with execution-level verification in `GenerationExecutionEngine`.

## 2. Directory Structure
```text
src/app/services/production/capability/
  types.ts             - MediaCapabilityProfile, CapabilityRequirements, MatchResult contracts
  profiles.ts          - Authoritative capability fact profiles for all production models
  registry.ts          - Capability profile registry with case-insensitive model & alias lookup
  requirements.ts      - Extraction of CapabilityRequirements from ShotSpec and GenerationTask
  validate.ts          - Pure validation functions enforcing temporal, reference, and output constraints
  router.ts            - assertExecutableCapability pre-execution guard
  sparkCapabilities.ts - Frozen system-level platform capabilities (captioning, distribution)
```

## 3. Registered Production Media Models
- **Kling Video**: `kling-v2-6`, `kling-v1-6`, `kling-v3-omni` (preview)
- **Seedance Video**: `doubao-seedance-1-5-pro-251215`, `doubao-seedance-2-0-260128`
- **Grok Media**: `grok-imagine-video-1.5`, `grok-imagine-image-2.0`, `grok-tts-eve`
- **Gemini / Veo Media**: `veo-3.1-generate-preview`, `veo-2.0-generate-001`, `imagen-3.0-generate-002`, `gemini-2.0-flash-tts`
- **Higgsfield Media**: `seedance-2.5-i2v`, `seedance-2.0-i2v`, `seedance-2.5-r2v`, `soul-2`, `soul-cinema`
- **OpenAI Media**: `gpt-image-1.5`, `dall-e-3`, `tts-1`
- **ElevenLabs Voice**: `eleven_multilingual_v2`, `eleven_turbo_v2_5`
- **Disabled Stubs**: `runway::gen3`, `luma::ray-2` (`adapterSupported: false`)

## 4. Pre-Execution Validation
Before any remote adapter is invoked:
1. `capabilityRequirementsFromTask(task, inputs, extra)` derives structured requirements.
2. `assertExecutableCapability(requirements, provider, model)` checks temporal, duration, aspect ratio, reference budget, and adapter support.
3. If incompatible, the task fails closed with structured reason codes (`REJECTED_*`) before calling the remote provider.
