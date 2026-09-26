# SPARK runtime configuration

No secret values belong in this file. Names only.

## Client safe

Exposed to the browser. Must not be a service role or provider secret.

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Public Supabase URL. Default in code is project `jaqzjhabmtvqtvinoafq`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key. |
| `VITE_USE_SUPABASE` | `false` forces the local/test client off. |
| `VITE_REQUIRE_AUTH` | Auth gate. |
| `VITE_REQUIRE_ADMIN_APPROVAL` | Closed-beta approval. |
| `VITE_ALLOW_PROVIDER_SIMULATION` | Allows simulation when a provider key is absent. |
| `VITE_GOOGLE_CLIENT_ID` | Public OAuth client id for Google connect. |
| `VITE_X_CLIENT_ID` | Public OAuth client id for X connect. |
| `VITE_YOUTUBE_API_KEY` | Optional browser research key. Restrict it. It is not a service role. |

## Server required

| Name | Purpose | Exposure |
| --- | --- | --- |
| `SUPABASE_URL` | Server Supabase URL | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth callbacks and storage writes that must bypass RLS | Server only. Never `VITE_`. |

## OAuth secrets

| Name | Purpose | Exposure |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Callback token exchange | Server only |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | Callback token exchange | Server only |

## Optional provider keys

Required only when that route is enabled. Missing key must exclude the provider or fail before reservation, not invent a free generation.

| Name | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI image/chat/video routes |
| `GOOGLE_AI_API_KEY` / `GEMINI_API_KEY` | Gemini / Veo |
| `XAI_API_KEY` | Grok |
| `ANTHROPIC_API_KEY` | Claude planning/chat |
| `ELEVENLABS_API_KEY` | Narration |
| `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` | Kling I2V |
| `ARK_API_KEY` | Seedance / Ark I2V |
| `HIGGSFIELD_API_KEY` | Higgsfield, only if that route is enabled. Live adapter is not certified. |

## Deployment / local

| Name | Purpose |
| --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Local browser tests only |
| FFmpeg | `ffmpeg-static` restored by `scripts/ensure-media-runtime.mjs` on `postinstall`. Not an env secret. |

## Must never be client-safe

`SUPABASE_SERVICE_ROLE_KEY`, provider API secrets, OAuth client secrets, refresh tokens.
