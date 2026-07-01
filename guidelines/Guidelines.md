# Media OS Design Guidelines

## Product Vision

Media OS is an AI-native operating system for running media companies. Users are not operating software—they are directing an AI-powered media organization consisting of producers, researchers, writers, directors, editors, publishers, analysts, and strategists.

## Core Design Principles

### 1. Hide Complexity
Never expose backend architecture, workflows, orchestration engines, AI agents, or implementation details to users.

### 2. Surface Outcomes
Show opportunities, content, productions, publishing status, insights, and recommendations.

### 3. Every Screen Must Answer
- What is happening?
- What needs my attention?
- What should happen next?

### 4. Premium & Calm Experience
Every screen should feel calm, focused, and premium. Designed for long daily usage without fatigue.

## Visual Style

- **Font Size**: Base 15px
- **Dark Mode First**: Default theme is dark mode
- **Spacing**: Generous padding and margins (Apple-level spacing)
- **Depth**: Soft shadows and subtle elevation
- **Borders**: Minimal, subtle borders using soft opacity
- **Typography**: Clean, medium weight for headings, normal for body
- **Motion**: Subtle transitions (200ms duration)
- **Radius**: Rounded corners (0.75rem base)

## Design Inspiration

The design draws inspiration from:
- **Apple**: Exceptional spacing, premium polish, minimal noise, elegant typography
- **Linear**: Workflow-first design, fast interactions, clear status visibility
- **Coinbase**: Trustworthy information display, clear metrics
- **Airbnb**: Excellent hierarchy, readable layouts
- **Notion**: Information architecture, structured content presentation

## Layout Guidelines

### Navigation
- Left sidebar navigation (64rem width)
- Primary navigation items: Home, Pipeline, Review, Library, Insights, Workspace
- User profile at bottom of sidebar
- Active state clearly indicated with accent color

### Cards
- Primary container for grouped content
- Rounded corners (rounded-xl)
- Soft borders with minimal opacity
- Hover states with subtle shadow elevation
- Internal padding of 1.5rem (p-6)

### Status Displays
- Use color-coded cards for different states (success, warning, destructive)
- Icons paired with metrics
- Trend indicators for data that changes over time
- Clear hierarchy: large metric, small label

### Activity Feeds
- Chronological, card-based layout
- Icons indicating content type and status
- Timestamps relative (e.g., “2m ago”)
- Most recent items highlighted with subtle accent ring

## Color Tokens

### Backgrounds
- `bg-background`: Main app background (darkest)
- `bg-card`: Card background (lighter than background)
- `bg-accent`: Interactive element backgrounds

### Text
- `text-foreground`: Primary text
- `text-muted-foreground`: Secondary text, labels

### Status Colors
- `text-success` / `bg-success`: Completed, positive trends
- `text-warning` / `bg-warning`: In progress, attention needed
- `text-destructive` / `bg-destructive`: Errors, rejections

### Navigation
- `bg-nav-background`: Navigation sidebar background
- `text-nav-foreground`: Inactive navigation items
- `text-nav-active`: Active navigation item
- `bg-nav-hover`: Hover state for navigation items

## Component Guidelines

### Status Cards
- Display key metrics and KPIs
- Include icon, title, value, optional subtitle and trend
- Use appropriate variant (default, success, warning, destructive)
- Hover state with shadow elevation

### Review Queue
- Priority-based visual treatment (high = red tint, medium = yellow tint, low = default)
- Thumbnail preview when available
- Quick actions: Approve, Regenerate, Reject
- Clear timestamps and metadata

### Activity Feed
- Vertical timeline of recent events
- Dual icon system: content type + status
- Collapsible details
- Color-coded status indicators

### Daily Briefing
- AI-generated insights grouped by type
- Visual distinction for opportunities, alerts, recommendations, achievements
- Timestamp showing when generated
- Scannable, card-based layout

## Typography

- **Headings (h1)**: 2xl, medium weight
- **Headings (h2)**: lg, medium weight
- **Headings (h3)**: base, medium weight
- **Body**: base, normal weight
- **Labels**: base, medium weight
- **Small text**: sm or xs for metadata

## Interaction Patterns

### Buttons
- Primary: Full background, high contrast
- Secondary: Transparent with border
- Tertiary: Text-only, no border
- All buttons include hover and active states

### Hover States
- Subtle background color change
- Optional shadow elevation
- Text color intensification
- 200ms transition duration

### Focus States
- Visible outline using `outline-ring` with 50% opacity
- Accessible keyboard navigation

## Content Guidelines

### Metrics & Data
- Use large, prominent numbers
- Include context (comparison, trend)
- Show units when applicable (M for millions, K for thousands)

### Timestamps
- Relative for recent items (“2m ago”, “1h ago”)
- Absolute for older items (“Jun 5, 2026”)

### Status Messaging
- Action-oriented language
- Clear next steps
- Avoid technical jargon

## Accessibility

- Maintain WCAG AA contrast ratios
- Keyboard navigation supported
- Focus indicators visible
- Screen reader friendly component structure

## Media OS Structure

### Product Roadmap
The product follows this implementation order:
1. Design System ✓
2. Home Dashboard ✓
3. Review Center ✓
4. Review Gate #1 (Creative Approval) ✓
5. Review Gate #2 (Production Approval) — NEXT PRIORITY
6. Review Gate #3 (Publishing Approval)
7. Pipeline
8. Opportunity Detail
9. Narrative Detail
10. Storyboard Detail
11. Production Center
12. Publishing Center
13. Insights
14. Workspace

### Philosophy
**Review comes before Create.** The entire product revolves around the human approval system. The Review experience is the heart of Media OS—it's where users direct their AI media organization.

### Home Dashboard Sections

1. **Executive Overview**: 6 premium metric cards (Monthly Views, Revenue, Growth Rate, Published Assets, Active Channels, Active Productions)

2. **Daily AI Briefing**: Most important section—executive summary with:
   - Top Opportunities
   - High Performing Content
   - Underperforming Content
   - AI Strategic Recommendations

3. **Review Queue**: Three review gates with clear “Review Now” actions:
   - Creative Reviews Pending
   - Production Reviews Pending
   - Publishing Reviews Pending

4. **Production Status**: Five production stages:
   - Planning
   - Production
   - Rendering
   - Ready For Review
   - Publishing

5. **Publishing Status**: Four publishing states:
   - Scheduled
   - Publishing
   - Published
   - Failed

6. **Activity Feed**: Linear-inspired timeline showing:
   - Opportunity Discovered
   - Storyboard Approved
   - Production Completed
   - Publishing Completed
   - Analytics Updated

### Review Center Sections

The Review Center is the operational approval hub—mission control for directing the AI media company.

1. **Governance Status**: Control panel showing:
   - Automation Mode (Manual, Balanced, Autonomous)
   - Review Gate toggles (Enable/Disable each gate)
   - Clear visual status indicators

2. **Review Queue Summary**: Five large overview cards:
   - Creative Reviews Pending
   - Production Reviews Pending
   - Publishing Reviews Pending
   - Needs Attention
   - AI Approved

3. **Pending Reviews**: Linear-inspired table view displaying:
   - Title
   - Channel
   - Series
   - Review Type
   - Priority (High/Medium/Low with visual indicators)
   - Status (Pending/In Review/AI Approved)
   - AI Confidence Score (with progress bar)
   - Time Waiting

4. **Review Categories**: Filter tabs for:
   - All Reviews
   - Creative
   - Production
   - Publishing
   - Completed
   - Rejected

5. **AI Decisions**: Log of automated decisions showing:
   - Decision made
   - Reason for decision
   - Confidence score
   - Outcome (Approved/Rejected/Flagged)
   - Timestamp

6. **Review Analytics**: Key metrics:
   - Average Approval Time
   - Approval Rate
   - Rejection Rate
   - Automation Rate

### Design Inspiration for Review Center

- **Linear Inbox**: Clean list views, clear status indicators, workflow-first design
- **GitHub Pull Requests**: Review approval patterns, confidence indicators, decision tracking
- **Apple Simplicity**: Minimal controls, clear hierarchy, intuitive interactions
- **Coinbase Trust**: Professional metrics display, trustworthy data presentation

## Mobile Experience

### Mobile Philosophy

**Desktop = Headquarters. Mobile = Command Center.**

The mobile app is not a replica of the desktop experience. It's designed for:
- **Awareness**: Monitor operations on the go
- **Approvals**: Review and approve content from anywhere
- **Decisions**: Make quick strategic decisions
- **Monitoring**: Track performance and status

Users should be able to run their media company from their phone in **under 60 seconds per session**.

### Mobile Visual Style

- Dark mode first
- Premium SaaS polish
- Large touch targets (minimum 44x44px)
- Minimal visual noise
- Comfortable for daily use
- Maximum 5 bottom navigation tabs

### Mobile Navigation

Bottom navigation with 5 tabs:
1. **Home**: Executive overview and command center
2. **Review**: Primary workflow for approving content
3. **Pipeline**: Track content progress through stages
4. **Insights**: Learn what's working and what's not
5. **More**: Settings, automation, and management

### Mobile Home Screen

Displays:
- Executive metrics (Monthly Views, Revenue, Active Channels, Published Today, Reviews Pending, Opportunities)
- AI Daily Briefing with key insights
- Recent Activity Feed
- Review Queue Summary with "Review Now" CTA

### Mobile Review Experience

The most important mobile workflow. Users can:
- Filter reviews by type (Creative, Production, Publishing)
- See AI confidence scores and priority levels
- Tap to view full review details
- Approve, Regenerate, or Reject within 60 seconds
- Large, clear action buttons optimized for touch

Review detail includes:
- Content preview
- AI confidence visualization
- Expected reach and platform
- Priority indicator
- Quick action buttons

### Mobile Pipeline Screen

Feed-based design showing content cards with:
- Stage indicators (Opportunity, Narrative, Storyboard, Rendering, Published, Learning)
- Progress bars for rendering
- Channel and time information
- Color-coded status badges
- Quick stats at top (In Progress, Published Today, Opportunities)

### Mobile Insights Screen

Strategic overview with:
- **What Worked**: Top performing content with metrics
- **What Failed**: Underperforming content to learn from
- **What To Create Next**: AI-identified opportunities
- **AI Recommendations**: Actionable strategic advice with impact levels

Avoids complex analytics in favor of clear strategic guidance.

### Mobile More Screen

Settings and management:
- User profile
- Automation Mode indicator and settings
- Workspace Settings
- Team Management
- Integrations
- Notifications
- Billing
- Help and Privacy

### Mobile Interaction Patterns

- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Cards**: Primary container for grouped content, optimized for tapping
- **Filters**: Horizontal scrollable tabs with pill-style buttons
- **Action Buttons**: Large, full-width primary actions
- **Safe Areas**: Respect iOS/Android safe area insets for notches and home indicators
- **Active States**: Visual feedback with scale transform (0.98) on tap

### Mobile Design Inspiration

- **Apple**: Premium polish, exceptional spacing, calm interfaces
- **Linear**: Workflow visibility, activity feeds, fast decisions
- **Coinbase**: Trust, operational confidence, status clarity
- **TikTok**: Feed-based consumption, fast scanning, mobile-first patterns
- **Duolingo**: Obvious next actions, low cognitive load
- **Airbnb**: Hierarchy, readability, friendly presentation

### View Switching

Toggle between Desktop and Mobile views using the floating button in the bottom-right corner. This allows testing both experiences without separate deployments.

## Review Center Updates

The Review Center has been refined to be the operational heart of Media OS, where humans and AI collaborate on every major decision.

### Governance Overview

The Governance section now shows three review gates with clear status indicators:

**Review Gate States:**
- **Required** (Warning badge with AlertCircle icon): Human approval is mandatory
- **Optional** (Muted badge with CheckCircle icon): Human approval is recommended but not mandatory
- **Automated** (Success badge with Zap icon): AI handles automatically, human can inspect

**Default Configuration (Balanced Mode):**
- Creative Review: Required
- Production Review: Required
- Publishing Review: Optional

### Review Queue as Primary Focus

The review queue has been repositioned as the primary focus of the page:

1. **Review Summary** appears first with 5 large metric cards
2. **Review Queue** is prominently displayed with filtering tabs
3. **Governance Overview** and **Review Performance** appear below as supporting information
4. **AI Decisions** log appears at the bottom for inspection

### Review Categories

Seven filter tabs for organizing reviews:
- **All**: Complete view of all reviews
- **Creative**: Opportunities, narratives, storyboards
- **Production**: Videos, voice, captions
- **Publishing**: Metadata, schedules, platforms
- **AI Approved** (NEW): Items pre-approved by AI (confidence ≥80%)
- **Completed**: Approved and processed reviews
- **Rejected**: Declined items

The AI Approved category helps users quickly find items the AI is confident about, enabling faster batch approvals.

### Mobile Review Refinements

The mobile review experience has been streamlined for even faster decisions:

**Quick Scanning:**
- AI confidence and priority badges at the top of review detail
- Large, prominent "Approve" button (larger text, shadow, active state)
- Secondary actions (Regenerate, Reject) remain accessible but less prominent
- All buttons have active scale transforms for tactile feedback

**Filter Improvements:**
- Added "AI Approved" filter to mobile
- Filters show in horizontal scroll with pill-style buttons
- Count badges on all filters

**Review Detail Enhancements:**
- AI confidence shown as colored badge at top (not buried in cards)
- Priority level shown as colored badge next to confidence
- Content preview remains central
- Expected reach and platform details easily scannable

Users can now complete a review workflow in under 30 seconds on mobile:
1. Tap review card (1 second)
2. Scan title, confidence, priority (2 seconds)
3. Preview content (5-10 seconds)
4. Tap Approve (1 second)

Total: 9-14 seconds per review, well under the 60-second target.

### Design Philosophy

The Review Center embodies:
- **Clarity**: Immediately understand what needs attention
- **Trust**: See AI confidence and reasoning
- **Control**: Override any AI decision
- **Speed**: Make informed decisions in seconds
- **Transparency**: Inspect AI decisions and outcomes

The interface feels like mission control because it provides complete operational visibility without overwhelming the user with unnecessary complexity.

## Cross-Platform UX Constitution Compliance

Media OS strictly adheres to a mandatory UX Constitution that governs all desktop and mobile experiences.

### RULE #1: Separate Product Experiences

- **Desktop is Headquarters**: Full management, analysis, configuration, complexity
- **Mobile is Command Center**: Execution, approvals, monitoring, speed
- Mobile is NOT a responsive version of desktop - they are intentionally different products

### RULE #2: No Manual Switching (CRITICAL)

❌ INCORRECT:
- Desktop/Mobile toggle buttons
- Device switchers in UI
- Manual view selection

✅ CORRECT:
- Automatic device detection based on screen width
- Separate layouts that adapt automatically
- Users never manually switch - the app adapts

**Implementation**: `useDeviceType` hook detects screen width (<768px = mobile) and automatically renders the appropriate experience.

### RULE #3 & #4: Navigation Patterns

**Desktop Navigation** (Left Sidebar):
- Home
- Pipeline
- Review
- Library
- Insights
- Workspace

**Mobile Navigation** (Bottom Tabs, Maximum 5):
- Home
- Review
- Pipeline
- Insights
- More

Mobile NEVER uses desktop sidebars. Bottom navigation is mandatory.

### RULE #5: Redesigned, Not Resized

Mobile screens are intentionally designed for mobile behavior:
- Not shrunk desktop layouts
- Not stacked desktop widgets
- Not converted sidebars
- Purpose-built mobile experiences

### RULE #6: Single Natural Scrolling (CRITICAL)

❌ INCORRECT:
```
Screen
└── Scroll Container
    └── Nested Scroll Container
```

✅ CORRECT:
```
Screen (naturally scrollable)
└── Content
└── Fixed Bottom Navigation
```

**Implementation**: 
- Removed all `overflow-y-auto` containers from mobile screens
- Content scrolls naturally with the page
- Top headers use `sticky` positioning when needed
- Action buttons are `fixed` at bottom
- No nested scroll conflicts

### RULE #7-9: Purpose Distinction

**Mobile is Action-First**:
- Approve, Reject, Edit, Override, Monitor
- Users make decisions, not browse dashboards
- Speed over complexity

**Desktop is Management**:
- Analyze, Configure, Manage, Create, Review
- Supports complexity and deep work

### RULE #10: One-Thumb Operation

- Primary actions in comfortable thumb zone
- Large touch targets (minimum 44x44px)
- Review actions reachable without excessive scrolling
- Fixed bottom action bar for primary decisions

### RULE #11-13: Mobile Design Patterns

**Mobile Review**:
- Card-based (not tables)
- Feed-based (not dashboards)
- Swipe-friendly layouts (not dense lists)

**Mobile Production Review**:
- Video is hero element
- Content appears before metadata
- Experience content before deciding

**Mobile Insights**:
- Concise and actionable (not enterprise dashboards)
- What Worked / What Failed / What To Create Next
- No complex charts or dense analytics

### RULE #14: 60-Second Sessions

Every mobile session must be completable within 60 seconds:
- Review → Approve → Leave
- Monitor status → Make decision → Exit
- Speed is paramount

### RULE #15: Design Inspiration

**Mobile Inspired By**:
- Apple Wallet (simple, focused)
- TikTok (feed-based, fast)
- Linear Mobile (workflow clarity)
- Coinbase Mobile (trust, confidence)
- Duolingo (obvious next actions)

**NOT Inspired By**:
- Desktop SaaS products
- Admin panels
- Traditional dashboards
- Enterprise software

### Final Principle

> Desktop feels like operating company headquarters.
> Mobile feels like carrying company command center in your pocket.

This principle overrides all other design decisions and is the litmus test for any design choice.

## Review Gate #1: Creative Approval

Review Gate #1 is the Creative Approval screen where users decide whether content should be produced. This is a decision screen, not an editor or dashboard.

### Design Philosophy

**Reduce Cognitive Load**: Present information progressively through collapsible sections. Users should never feel overwhelmed.

**10-Second Understanding**: The Executive Summary must be scannable and understandable within 10 seconds.

**Decision-First**: The user is a Creative Director reviewing a pitch. The question is simple: "Should we produce this?"

### Desktop Experience

**Single Proposal Focus**: Only one content proposal is shown at a time. No multi-proposal views or dashboards.

**Header Section**:
- Title (large, prominent)
- Content type, series, channel (metadata)
- Opportunity Score (success color, percentage)
- AI Confidence Score (accent color, percentage)

**Section 1: Executive Summary** (Always Visible)
- One sentence concept
- Target audience
- Expected reach (with numbers)
- Recommended platforms (pill badges)
- Must be scannable in 10 seconds

**Section 2: Hook Preview** (Always Visible)
- Primary hook (large text)
- Opening moment description
- Why it will capture attention (highlighted box)

**Section 3: Thumbnail Concepts** (Always Visible)
- 3 thumbnail variants in grid
- Large visual previews
- Concept descriptions
- Users immediately understand visual direction

**Section 4: Narrative Blueprint** (Collapsed by Default)
- Expandable accordion
- 5-part structure: Hook, Build-Up, Conflict, Reveal, Payoff
- Each part in separate card for clarity

**Section 5: Storyboard Preview** (Collapsed by Default)
- Expandable accordion
- Scene cards in 2-column grid
- Scene number, duration, description
- Progressive disclosure of production details

**Section 6: Platform Strategy** (Collapsed by Default)
- Expandable accordion
- Strategy for each platform (YouTube, TikTok, Shorts, Reels)
- Platform icons for visual recognition
- Specific duration and optimization notes

**Bottom Action Bar** (Persistent, Fixed):
- Always visible, never scrolls away
- Fixed to bottom of viewport (desktop: left margin accounts for sidebar)
- 4 actions in horizontal layout:
  1. **Approve Production** (primary, success green, largest, prominent)
  2. **Request Changes** (secondary, accent color)
  3. **Regenerate** (secondary, accent color)
  4. **Reject** (tertiary, muted)

### Mobile Experience

**60-Second Decision Target**: Users must be able to review and approve within 60 seconds.

**Sticky Header**:
- Back button
- Title (truncated if needed)
- Opportunity Score badge
- AI Confidence Score badge
- No excessive metadata

**Core Content** (Always Visible):
- Concept summary card
- Expected reach
- Hook (large, prominent)
- Opening moment
- Thumbnail grid (3 variants, smaller)

**Expandable Sections**:
- Narrative (accordion, collapsed by default)
- Storyboard (accordion, collapsed by default)
- Platform Strategy (accordion, collapsed by default)

**Bottom Action Bar** (Fixed, No Nested Scroll):
- Large "Approve" button (full width, primary)
- 3 secondary actions in grid below (Changes, Regenerate, Reject)
- Active scale transforms for tactile feedback
- Shadow elevation for prominence

### Progressive Disclosure Pattern

**Always Visible**:
- Executive summary
- Hook preview
- Thumbnail concepts

**Collapsed by Default**:
- Narrative blueprint
- Storyboard preview
- Platform strategy

**Why**: Users can make 80% of decisions from the visible content. Detailed information is available on-demand without overwhelming the primary decision flow.

### Mobile Scroll Compliance

✅ **Correct Implementation**:
```tsx
<div className="min-h-screen bg-background pb-32">
  <div className="sticky top-0">Header</div>
  <div className="p-4">Content (naturally scrollable)</div>
  <div className="fixed bottom-0">Actions</div>
</div>
```

❌ **Incorrect** (No nested scroll containers):
- No `overflow-y-auto` containers
- No `h-screen` with internal scrolling
- Single natural page scroll only

### Decision Flow

**Desktop**: Scan summary (10s) → Review hook/thumbnails (20s) → Expand details if needed (30s) → Decide and click action (5s) = **~65 seconds total**

**Mobile**: Scan header/badges (5s) → Review concept/hook (15s) → Check thumbnails (10s) → Expand sections if needed (20s) → Tap Approve (5s) = **~55 seconds total**

Both experiences achieve the sub-60-second target for confident decisions.

### Visual Hierarchy

1. **Primary**: Title, Scores, Hook, Thumbnails, Approve button
2. **Secondary**: Concept, Platforms, Expandable sections
3. **Tertiary**: Metadata, timestamps, platform details

The visual hierarchy guides the user through the decision naturally, with the most critical information receiving the most visual weight.

### Design Inspiration Applied

- **Apple**: Exceptional spacing, minimal noise, progressive disclosure
- **Linear**: Workflow clarity, obvious next actions
- **Airbnb**: Hierarchy, readability, friendly presentation
- **Coinbase**: Trust, confidence in decisions
- **Netflix Content Review**: Content-first, decision-focused
- **Pixar Story Review**: Creative director perspective

### Navigation

**Desktop**: 
- Click review item in Review Center → Opens Creative Review
- Back button returns to Review Queue
- After action (Approve/Reject), returns to Review Queue

**Mobile**:
- Tap review card → Opens MobileCreativeReview
- Back arrow returns to review list
- After action, returns to review list

### Key Success Metric

**Can a user confidently approve or reject a creative proposal in under 60 seconds?**

If yes, the screen succeeds. If no, reduce cognitive load further.

## Spark Studio Rebranding

The product has evolved from "Media OS" to "Spark Studio" - an AI-powered creative operating system.

### Updated Navigation

**Desktop** (Left Sidebar):
- Command (formerly Home)
- Review
- Flow (formerly Pipeline)
- Channels (NEW - core feature)
- Insights
- Studio (formerly Workspace)

**Mobile** (Bottom Navigation, 5 tabs):
- Command
- Review
- Flow
- Insights
- More

### Core Philosophy

Spark Studio treats each Channel as a **Creative DNA Engine** - a living creative identity that powers all AI content generation, not just a folder or category.

## Channel Workspace - Core Identity System

The Channel Workspace is the most important structural screen in Spark Studio. Everything (Producer, Storyboard, Voice, Production, Publishing) inherits from Channel Identity.

### Design Principle

**A Channel is a living creative entity, not a content folder.**

It defines:
- What content is created
- How it looks  
- How it sounds
- How it behaves
- How it performs over time

### Desktop Experience - 8 Core Sections

**Section 1: Channel Overview** (Hero Section)
- Channel name (large, prominent)
- Channel purpose (one sentence)
- Target audience
- Content category
- Growth status (with visual indicator)
- AI Health Score (percentage with badge)
- "Welcome to a living creative entity" feeling

**Section 2: Content DNA** (Core Intelligence Layer)
- Core Topics (pill badges)
- Content Themes (card list)
- Style Direction
- Emotional Tone
- Audience Behavior Patterns
- Winning Formats (success-highlighted cards)
- This is WHAT Spark AI uses to generate content

**Section 3: Brand Bible** (Visual Identity)
- Visual Style Direction
- Color Palette (swatches with hex codes)
- Typography Direction
- Thumbnail Style Rules (numbered list)
- Editing Style Rules
- Reference Examples
- Ensures brand consistency across all content

**Section 4: Character Bible** (Who Appears)
- Character cards (2-column grid)
- Each character includes:
  - Name and role
  - Visual identity description
  - Behavioral traits (pill badges)
  - Appearance references
- Structured character definitions for AI to use

**Section 5: Voice Bible** (CRITICAL)
- Voice sets with preview buttons
- Each voice includes:
  - Name (e.g., Spark_Nigeria_English, Spark_Pidgin, Spark_Yoruba)
  - Accent and language
  - Tone and energy level
  - Speaking style
  - Emotional range
  - Locked status
  - Primary designation
- Highlighted section (accent background/border)
- "Voice Preview" button for each voice
- Defines HOW the channel sounds

**Section 6: Content Performance Memory** (Learning System)
- 2-column grid layout
- Best Performing Hooks (success cards)
- Best Titles (success cards)
- Best Thumbnails
- Failed Content Patterns (destructive cards)
- Audience Retention Insights
- Viral Triggers (accent cards)
- Feeds Spark AI future decisions

**Section 7: Channel Health** (Metrics)
- 5-column metric grid
- Growth Rate
- Engagement Rate
- Retention Score
- Posting Consistency
- AI Optimization Score
- Clean, centered metric display

**Section 8: Quick Actions** (Studio Departments)
- 5-column grid of action buttons
- Create New Series
- Generate Content Idea (Spark AI)
- Create Storyboard
- Run Research
- Generate Voice Script
- Feels like "calling departments in a studio"

### Top Bar Enhancement

**Channel Switcher** (very important):
- Appears in top bar when on Channel pages
- Radio icon + channel name + dropdown
- Allows quick switching between channels
- Replaces workspace selector when active

### Mobile Experience - Control Panel

Mobile is NOT a full workspace - it's a **control panel for 60-second management**.

**Structure**:
- Channel name with status badges
- Growth Snapshot (3-metric grid)
- Latest Content (list with views/time)
- AI Recommendations (Spark AI suggestions)
- Voice Status (primary voice with preview)
- Quick Actions (2x2 grid)

**Capabilities**:
✅ Quick approval
✅ Quick edits
✅ Quick generation triggers
✅ Status monitoring
✅ Performance snapshots

**Exclusions**:
❌ Deep editing
❌ Large tables
❌ Multi-column layouts
❌ Dense dashboards
❌ Full workspace features

**60-Second Management Target**: Users can check status, review AI recommendations, and trigger actions within 60 seconds.

### Visual Style

- Premium Apple-level UI
- Dark mode first
- High spacing (generous padding)
- Calm hierarchy
- Minimal noise
- **Soft glow accents for AI elements** (Voice Bible, AI Recommendations)
- NO crypto styling
- NO gaming UI
- NO dashboard overload

### Design Inspiration Applied

- **Apple**: Ecosystem design clarity, premium polish
- **Notion**: Workspace structure, organized sections
- **Linear**: System hierarchy, clear status
- **Netflix**: Studio production logic, professional feel
- **Pixar**: Creative pipeline thinking, artistic workflow

### Voice Sets - Nigerian Context

The example channel demonstrates localized voice sets:
- **Spark_Nigeria_English**: Primary voice, Nigerian accent, energetic & friendly
- **Spark_Pidgin**: Casual & relatable, Pidgin English
- **Spark_Yoruba**: Warm & cultural, Yoruba/English mix

Each voice is a complete creative identity:
- Locked voices maintain consistency
- Primary voice is the default for all content
- Preview functionality allows testing before use

### Channel as Creative DNA

Every element in the Channel Workspace feeds Spark AI's content generation:

**Content DNA** → What topics and themes to create
**Brand Bible** → How the content should look
**Character Bible** → Who should appear in content
**Voice Bible** → How the content should sound
**Performance Memory** → What has worked and failed
**Channel Health** → Current performance and optimization level

This is not configuration - this is the **living creative identity** that powers autonomous content creation.

### Final Feeling

The screen should communicate:

> "You are inside the operating system of a creative studio, and this Channel is a living media entity powered by Spark AI."

Users should feel like they're managing a living creative brand, not editing a configuration file.
