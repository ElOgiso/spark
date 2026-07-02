# Legal & SEO Preparation Plan

This document outlines the SEO configuration and legal policy layouts needed to transition Spark to production securely, ensuring clear public-facing discoverability and absolute confidentiality for private workspace panels.

---

## 1. Legal Requirements & Public Pages

Spark will host compliance documents accessible to search engines and users without authentication.

### Public Pages
- **`/terms` (Terms of Service)**:
  - **Purpose**: Establishes standard licensing bounds, acceptable use policy, ownership rights of AI-generated assets, subscription terms, and liability limits.
  - **Content Sections**:
    - **Asset Ownership**: Users retain all intellectual property rights to finalized videos, voiceovers, and scripts produced by Spark.
    - **Usage Boundaries**: Prohibits deploying automated scraping bots, using Spark services to produce malicious content or automated misinformation, and violating third-party platform terms of service.
    - **AI Model Declarations**: Acknowledges that output recommendations and concepts are generated via predictive modeling and should be verified for factual compliance.
- **`/privacy` (Privacy Policy)**:
  - **Purpose**: Fully details how user data, social media API connection tokens, and character assets are handled, stored, and protected.
  - **Content Sections**:
    - **Data Collection**: Explicitly states what information is read via official YouTube, TikTok, and Instagram OAuth scopes (channel metrics, comments).
    - **Token Encryption**: Commitments to encrypt and store publishing authorization tokens securely server-side.
    - **Retention Limits**: Users can disconnect social channels at any point, resulting in the absolute deletion of stored access tokens from the active database.

---

## 2. SEO Metadata Blueprint

Spark uses a strict separation between public discoverability (marketing, legal, signup) and private data boundaries (application screens).

### Static SEO Tag Structure
Every public page must deliver search engine-friendly metadata to optimize indexing:

- **`title`**: Brand-consistent, structured labels.
  - *Example*: `Spark | AI-Native Media Operating System`
- **`description`**: Clear value proposition.
  - *Example*: `Operate media brands, not prompts. Spark is an AI-native media operating system enabling automated content generation, predictive virality analysis, and cross-channel publishing.`
- **`canonical`**: Hardcoded absolute URL to avoid duplicate content penalties.
  - *Example*: `https://spark.media/terms`
- **`Open Graph (og:title, og:description, og:image)`**: Formatted snippets optimized for shares on LinkedIn, Twitter, and messaging tools.

---

## 3. Crawling Controls & Private Page Security

**Private user data must never leak into search engine search indexes.** 

To prevent this, a strict, system-wide `noindex, nofollow` strategy is applied to all private operational routes.

### Private Routes Tagged for Exclusion:
- `/` or `/dashboard` (Main Spark operating panel)
- `/my-spark` (Brand guidelines, voice configurations, rules)
- `/viral-sparks` (Predictive feed suggestions)
- `/review` (Creative content approval and drafting panels)
- `/calendar` (Social calendar and pending export list)
- `/analytics` (Confidential brand performance stats & learning logs)
- `/billing` (User checkout and active card data)
- `/api/*` (Private endpoint routes)

### Technical Enforcement Methods

#### A. HTML Meta Tag (Page Header)
Every private route rendered must include the following tag in its `<head>` layout:
```html
<meta name="robots" content="noindex, nofollow, noarchive" />
```

#### B. Dynamic robots.txt
A standard `/robots.txt` placed in the static root handles global route exclusions:
```text
User-agent: *
# Allow public pages
Allow: /
Allow: /terms
Allow: /privacy
Allow: /login
Allow: /signup

# Block private dashboards and service interfaces
Disallow: /my-spark
Disallow: /viral-sparks
Disallow: /review
Disallow: /calendar
Disallow: /analytics
Disallow: /more
Disallow: /api/
Disallow: /billing
```

#### C. HTTP Security Headers
Private application responses should return security headers instructing proxies not to cache or parse the contents:
```http
X-Robots-Tag: noindex, nofollow
Cache-Control: private, no-store, max-age=0
```
