# Platform API Integration & Adapter Plan

This document maps out the system architecture and authentication parameters for establishing direct publishing and analytics integrations with major social media APIs.

---

## 1. Social Media Platform Scopes & Permissions

Each platform integration relies on secure OAuth 2.0 flows, requesting specific API permissions for automated content publishing and analytics retrieval.

| Platform | Authentication Flow | Required Scopes | Capabilities |
| :--- | :--- | :--- | :--- |
| **YouTube** | Google OAuth 2.0 | `https://www.googleapis.com/auth/youtube.upload`<br>`https://www.googleapis.com/auth/yt-analytics.readonly` | Upload long-form videos and Shorts; pull views, click-through-rates, and retention stats. |
| **TikTok** | TikTok Login Kit OAuth 2.0 | `video.upload`<br>`video.publish`<br>`user.info.stats`<br>`video.list` | Upload vertical video drafts directly to user accounts; publish instantly; retrieve follower stats and views. |
| **Instagram** | Meta Facebook Login Graph API | `instagram_basic`<br>`instagram_content_publish`<br>`instagram_manage_insights` | Auto-publish Reels, feed posts, and carousels; query detailed story reach and profile interactions. |
| **LinkedIn** | Sign In with LinkedIn v2 | `w_member_social`<br>`r_organization_social`<br>`r_liteprofile` | Share professional text and PDF documents; track article post impressions and click metrics. |
| **Twitter/X** | X OAuth 2.0 Auth Code with PKCE | `tweet.read`<br>`tweet.write`<br>`users.read` | Post tweets and threads containing image, video, and text packages; track reply volumes and retweets. |

---

## 2. Token Management and Cryptographic Storage

User-authorized OAuth tokens are highly sensitive. Spark adopts a strict multi-layer security paradigm to store and handle these credentials:

### Secret Storage Blueprint
- **Encryption Algorithm**: Tokens (both `access_token` and `refresh_token`) are encrypted before database insertion using **AES-256-GCM**.
- **Key Separation**: The encryption key is kept inside safe environment variables (e.g. `TOKEN_ENCRYPTION_KEY`) on our secure host environment, completely separated from the main database servers.
- **Auto-Rotation**: Long-lived refresh tokens are used to silently request brand-new access tokens prior to expiration. If the token refresh fails, the status is immediately marked as `disconnected`, prompting the user to reconnect in the UI.

---

## 3. Publisher Engine, Quotas & Rate Limits

When an approved production triggers a scheduled publish job, it passes through the platform adapter queuing engine.

```
+-------------------------------------------------------------+
|                      Scheduler Queue                        |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                    Rate Limit / Quota Check                 |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                     OAuth Token Refresh                     |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                  Multipart Video File Upload                |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                   Final Publish Hook / Pin                  |
+-------------------------------------------------------------+
```

### Quota and Limit Handling
- **YouTube Upload Limits**: Google sets a standard upload limit of 10,000 units/day. Video uploads consume 1,600 units. To mitigate limit issues, Spark queues and staggers video posts, falling back to export packages if limits are reached.
- **LinkedIn/X Post Limits**: LinkedIn limits posts to roughly 100 posts within 24 hours. The adapter limits brand updates to a max of 10 scheduled items per brand day.
- **Meta Graph API**: Enforces call-volume restrictions based on active user counts. Real-time exponential backoff is activated upon receiving API code `17` (user request limit reached).

---

## 4. Resiliency & Retry Logic

API requests can fail due to temporary network timeouts or server-side outages. The Spark publish queue manages this through a robust state machine:

- **Exponential Backoff with Jitter**:
  - Failed upload actions are scheduled for retry: $T_{retry} = 2^{\text{attempt}} \times 1000\text{ms} + \text{random\_jitter}$.
  - Maximum retry attempts: `5`.
- **Idempotency Keys**:
  - All post payloads are sent with unique client-side transaction IDs to prevent duplicate content postings if connection drops mid-request.
- **Fail-Safe Gate**:
  - If a job fails after 5 attempts, the status switches to `Failed`. An alert is sent to the user workspace and logged in the brand's active dashboard.

---

## 5. Publish Logs and Error Diagnostics

Every API interaction registers a timestamped log trace in our internal database `audit_logs` for debug transparency:

### Error Diagnostic Mapping
- `ERR_AUTH_EXPIRED`: OAuth token revoked by user. UI prompts reconnect.
- `ERR_RATE_LIMIT`: Platform rate limit reached. Delaying job by 1 hour.
- `ERR_FILE_FORMAT`: Platform rejected video codec or file size limits. Quality-checks updated.
- `ERR_DRAFT_REJECTED`: Manual account settings blocking automatic publish. Marked as `Export Ready` for manual upload.
