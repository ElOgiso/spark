Design concept
What it is
Full-bleed, story-like Brand Genesis — one decision per frame, Super Spark as quiet director, executive actions in-frame. Feels closer to WhatsApp/Instagram Stories (immersive card, progress, forward motion) than a SaaS wizard or a chat app.
What it is not

Stepper forms (“Step 3 of 7”) as the hero
iMessage bubble threads as the main UI
Logo-in-round-avatar chat chrome
Desktop settings pages scaled to mobile

SPARK language only
Brand · Character · Niche · Voice / Audio · Research Sources · Accounts · Production Modes · Automation · MY SPARK · VIRAL SPARKS · Super Spark
Visual DNA (match live SPARK)

Quiet dark surface (#0B0F17 family)
Purple accent sparingly (progress + primary CTA)
Soft ambient glow, not noisy gradients
Large type hierarchy, generous padding
One primary action per frame; secondary is text/ghost
Safe-area aware; sticky action zone when needed

Story mechanics

Top: thin segment progress (story bars), not “Phase labels” as chrome
Center: one Director line + one interactive canvas
Bottom: optional reply field + primary forward control
Forward feels like “next story”; back is subtle
No dead screens; every frame produces BrandGenesis data


Global frame structure (all steps)
text┌─────────────────────────────┐
│ ▓▓▓░░░░  story segments     │  ← progress only
│                             │
│  Super Spark  (flat mark)   │  ← NOT in chat avatar circle
│  One director sentence      │
│                             │
│                             │
│     INTERACTIVE CANVAS      │  ← chips / connect / preview
│                             │
│                             │
├─────────────────────────────┤
│  [ optional text field ]    │  ← ask / type / paste
│  [ PRIMARY ACTION ]         │  ← Continue / Generate / Enter
└─────────────────────────────┘
Text box rule
Always available to ask Super Spark or type a custom answer — secondary to the canvas, not a full chat transcript.

Flow (ordered — no duplicate work)
textLogin (existing)
    ↓
GENESIS STORY
    1  Connect Account
    2  Brand + Niche
    3  Character
    4  Voice
    5  Research Sources
    6  Modes
    7  Ready → Enter SPARK
    ↓
Dashboard (existing)
Skip allowed where noted. Connect failure must never hard-block Genesis.

Frame-by-frame
Frame 0 — Entry (optional, ≤1 beat)

Full-bleed quiet dark
Line: “Super Spark is ready to build your media brand.”
Primary: Begin
No name form here


Frame 1 — Connect Account (first real step)
Director: “Connect the account you’ll publish with. SPARK will use it for your brand identity.”
Canvas

Large cards: YouTube / Google, X (only if live)
States: idle · connecting · connected (handle + avatar) · error
Text: Continue without connecting

Text box: optional question only
On success: prefill brand/channel name from account for Frame 2
Primary: Continue (enabled after connect or skip)

Frame 2 — Brand + Niche
Director: “Confirm your brand. This is what SPARK will optimize for.”
Canvas

Brand / channel name (prefilled, editable)
Niche chips + Other
Optional: audience or goal chips (one row max)

No separate “what’s your name?” if account already gave creator identity
Primary: Continue (requires brand + niche)

Frame 3 — Character
Director: “Lock the host SPARK will keep consistent across every production.”
Canvas — controls (chips, not long forms)

Genre: Realistic · Cinematic · 3D · Anime · Cartoon · Illustration · Comic · Art · Clay
Skin · Hair · Wardrobe · Personality
Short director notes field

Actions in canvas

Generate character sheet
Regenerate · Upload

Preview

Large sheet preview (reference-bible energy: multi-angle, not a tiny avatar)
Tap → fullscreen story-style viewer · close to return

Primary: Continue when user accepts a sheet or explicit skip with description only

Frame 4 — Voice
Director: “Choose the narrator voice for your content—not Super Spark’s chat voice.”
Canvas

Voice rows: Play · Select
“Design a voice” → description → preview plays → Select

Text box: describe voice to design
Primary: Continue after selection (or clear skip if product allows)

Frame 5 — Research Sources
Director: “Paste channels SPARK should learn from. Analysis can start now.”
Canvas

Paste URL
Chips of added sources + remove
Status: Syncing · Ready · Failed

Label clearly: inspiration / research — not “your publish account”
Primary: Continue · Skip equal weight as text

Frame 6 — Modes
Director: “How should SPARK produce and how much should it decide alone?”
Canvas

Production: Narrator · Hybrid · Cinematic (one-line plain meaning each)
Automation: Manual · Balanced · Autonomous

Primary: Continue

Frame 7 — Ready
Director: “Your SPARK is ready.”
Canvas — compact summary only

Brand · Niche
Character thumb → fullscreen
Voice name
Sources count · Account if connected
Modes

Primary (sticky, always visible): Enter SPARK Dashboard
No long checklist scrolling the CTA off-screen.

Interaction notes for Figma

































PatternSpecProgress7 story segments; current filledMotionHorizontal or fade “next story”; 200–300msPrimary CTAFull width mobile; high contrast purpleText boxSingle line; placeholder “Ask Super Spark or type…”ErrorsInline on canvas (connect timeout, voice fail)—never silentDesktopSame frames, centered max-width story stage (~420–480px), not a different IA

Copy rules

Super Spark speaks in short director lines (1–2 sentences)
No “wizard,” “onboarding funnel,” “setup assistant” in UI
No model names (GPT, ElevenLabs) in executive copy
Locked terms only (see language list above)


Out of scope for these frames
Sign-up/login screens · billing · full MY SPARK · production pipeline · Super Spark chat modal inside the app

One-line for designers
Brand Genesis is a premium, story-format, AI-directed setup: one immersive frame per decision, interactive chips and previews, a light reply field, and a single sticky path into SPARK—not a form wizard and not a chat app.