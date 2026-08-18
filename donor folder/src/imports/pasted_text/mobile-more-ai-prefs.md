**FIGMA PROMPTS — SPARK Mobile More + AI Preferences**  
*(Live `MobileMore.tsx` inventory · Design Council · onboard/Figma Make cleanliness · Production as mode cards)*

Figma Make file (`35F9an9rLY2BLkd88tC48J`) is oriented to **Brand Genesis**. Treat its **visual DNA** (quiet dark, soft cards, story calm, purple restraint) as the system to extend—not the More IA.

---

### Shared mobile language (both screens)

- Frame: **390×844**, safe-area, bottom nav clearance (~76px) when More is a tab root  
- Background: same deep quiet as Genesis / new Home  
- Cards: `rounded-2xl`, hairline border, no noisy gradients  
- Section labels: 11–12px muted uppercase / tracking  
- Rows: large tap targets (min ~48px), chevron only when it opens a detail  
- **Not** a shrunk desktop settings list; **not** messenger chrome  
- Purple only for selected mode cards / primary emphasis  

---

## 1) Mobile More (root)

### Job
Executive **control room index**: identity, brand paths, modes, account tools—not a dumping ground.

### Live code sections to keep (content map)

From `MobileMore.tsx`:

| Section | Items |
|---------|--------|
| **Header** | Spark Account (name, email, sign in/out) |
| **Modes (elevate)** | Automation Mode · **Production Generation ON/OFF** |
| **Brand** | My Spark · Assets · Memory · Marketer · Accounts |
| **Account & Team** | Billing · API · **AI Preferences** · Integrations · Team |
| **Preferences** | Appearance & Theme · Notifications · Privacy *(Production moves out of a buried row into Modes cards)* |
| **Legal & Support** | Support · Legal |

### Layout (top → bottom)

```text
┌─────────────────────────────────────┐
│  More                               │
│  ┌ Spark Account ─────────────┐    │
│  │  Avatar  Name               │    │
│  │  email · role        Sign out│   │
│  └─────────────────────────────┘    │
│                                     │
│  MODES                              │
│  Automation                         │
│  ┌ Manual ┐ ┌ Balanced ┐ ┌ Auto ┐  │  ← selectable cards
│  Production                         │
│  ┌ Off ────────┐ ┌ On ─────────┐   │  ← same card language
│                                     │
│  BRAND                              │
│  rows → My Spark, Assets, Memory,   │
│         Marketer, Accounts          │
│                                     │
│  ACCOUNT & TEAM                     │
│  rows → Billing, API, AI Prefs,     │
│         Integrations, Team          │
│                                     │
│  PREFERENCES                        │
│  rows → Theme, Notifications,       │
│         Privacy                     │
│                                     │
│  LEGAL & SUPPORT                    │
│  rows → Support, Legal              │
└─────────────────────────────────────┘
```

### Production On/Off — **cards like Automation Mode** (required)

Do **not** hide Production as a deep “Production Settings” list row only.

**Automation** (3 cards, equal width or wrap):
- **Manual** — All decisions need approval  
- **Balanced** — SPARK drafts; you gate strategy  
- **Autonomous** — SPARK runs within brand rules  

**Production generation** (2 cards, same visual system):
- **Off** — No media generation; drafts/text pipeline only  
- **On** — Full production assets allowed  

Selected card: stronger border + soft fill + check or filled state.  
Unselected: quiet.  
Copy stays executive—no “toggle API flag” language.

Optional one-line under Production:  
`When Off, SPARK will not generate images or video.`

### Account card
- Name + email  
- Sign out / Sign in  
- No giant profile editor on the root  

### Row pattern
Icon · Label · muted badge · chevron  
Badge examples: `3 active`, `ON`, `Brand & Research`, `Not set`

### Detail navigation
Tapping a row opens a **full-screen mobile detail** (back chevron + title)—same pattern as live `activeDetail`, redesigned for clarity.

---

## 2) Mobile AI Preferences (detail under More)

### Job
Let the executive choose **Best Available** or pin **provider + model per task**—without exposing orchestrator internals.

### Entry
More → Account & Team → **AI Preferences**

### Header
- Back → More  
- Title: **AI Preferences**  
- One muted line: `SPARK picks the best model unless you set one.`

### Structure

```text
┌─────────────────────────────────────┐
│  ←  AI Preferences                  │
│  SPARK picks the best…              │
│                                     │
│  DEFAULT                            │
│  ┌ Best Available (Auto)  ● selected│
│  │ SPARK routes each task…          │
│                                     │
│  BY TASK                            │
│  ┌ Super Spark (chat) ──── Gemini ▸│
│  ┌ Research ─────────── Auto     ▸│
│  ┌ Video understanding ─ Auto    ▸│
│  ┌ Image generation ─── OpenAI   ▸│
│  ┌ Video generation ─── Gemini   ▸│
│  ┌ Voice (content) ──── ElevenLabs▸│
│  … (match live AIRoutingCategory)   │
│                                     │
│  Tip: leave Auto unless you care.   │
└─────────────────────────────────────┘
```

### Task row
- Task label (human): Super Spark, Research, Image, Video, Voice…  
- Current value: **Auto** or provider short name (+ model if set)  
- Tap → **Task sheet / sub-screen**

### Task detail (provider → model)

1. **Provider cards** (not a dense dropdown wall):  
   - Best Available (Auto)  
   - OpenAI  
   - Anthropic Claude  
   - Google Gemini  
   - xAI Grok  
   - ElevenLabs *(only on voice/content TTS task)*  

2. When a provider is selected (not Auto):  
   - **Model list** for that provider + capability (from product catalog)  
   - One selected model  
   - Short plain labels only (hide internal ids in primary UI if possible)

3. **Save** is implicit on select (mobile) or a single sticky **Done**

### Live capability groups to mirror (from code)
Use the real categories already in `MobileMore` / `modelCatalog` / `AIRoutingCategory`—e.g. Super Spark chat, research, video understanding, image, video, voice—grouped under calm headers like:
- Conversation  
- Research  
- Creative media  
- Voice  

Do not invent parallel taxonomies.

### Empty / error
If keys missing: quiet note *“Provider unavailable until connected in API settings”*—no scary red walls.

---

## 3) What Apple / Linear remove

- Duplicate Production toggle elsewhere on More once cards exist  
- Long walls of every model on the root AI page  
- Desktop two-column settings  
- “Advanced JSON / temperature” on mobile  
- Team/Billing full complexity on first paint (row entry is enough)

---

## 4) Figma deliverables

1. **More — root** (modes cards visible)  
2. **More — Production On selected / Off selected**  
3. **AI Preferences — list**  
4. **AI Preferences — task detail (provider cards)**  
5. **AI Preferences — model list for one provider**  
6. Components: `ModeCard`, `SettingsRow`, `AccountCard`, `ProviderCard`, `ModelRow`  
7. Prototype: More → AI Preferences → task → provider → model → back  

---

### One-line briefs

**More:**  
> Mobile More is a calm executive index: account, **Automation + Production as equal mode cards**, then Brand / Account / Preferences rows—same quiet system as Genesis, never a shrunk desktop.

**AI Preferences:**  
> Mobile AI Preferences is a short Auto-first list of tasks; each task opens provider cards then models—power without cockpit clutter, reachable from More only.