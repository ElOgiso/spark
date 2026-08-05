# Security Rules & Best Practices

This document establishes the mandatory security policies, code review standards, and architectural rules to safeguard user credentials, API keys, and sensitive database records within the Spark environment.

---

## 1. Secrets Management and Environmental Safeguards

**Absolute Rule**: Client-side code must never compile, reference, or store sensitive secrets.

- **Zero API Keys in Version Control**:
  - No database passwords, client secret keys, or API tokens may ever be committed to git repositories or configuration files.
  - All credentials must be loaded at runtime from secured platform environment variables.
- **Client vs Server Key Splitting**:
  - Environment variables prefixed with `NEXT_PUBLIC_` or exposed in client bundles must only contain non-sensitive configurations (e.g., public analytics IDs or public app URLs).
  - High-privilege keys (Supabase Service Role keys, API Keys, Token Encryption secrets) must be loaded exclusively inside server-only runtimes (e.g., API handlers or background cron microservices).

---

## 2. Server-Only Token & Request Handling

- **OAuth Middleware**:
  - User authorization codes must be exchanged for tokens entirely server-side (`/api/auth/callback`).
  - Access and refresh tokens should never return to the browser in raw format. All authorized API tasks (such as uploading to YouTube or posting to TikTok) are processed through server proxy endpoints.
- **Header Security Rules**:
  - API responses must specify strict security headers:
    ```http
    Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
    ```

---

## 3. High-Stakes Action Auditing

Every high-privilege operational change or external social channel post triggers an entry inside the system `audit_logs` database:

### Actions Tracked
1. **OAuth Connection changes**: Connect, reconnect, or disconnect social channels.
2. **Publishing actions**: Scheduled posts executing, successful posts, failed post events, and manual export packaging downloads.
3. **Brand rule updates**: Editing high-retention guidelines or modifying character settings.
4. **Subscription and Billing**: Updating credit cards, initiating checkout, or canceling plans.

### Log Records Structure
Audit logs must capture:
- Dynamic IP address
- Action category tag
- User ID and Brand ID scope
- Modification delta details (excluding raw tokens or private keys)

---

## 4. Console Logging and Error Handling Best Practices

To prevent credentials leaking in error handlers and debug logs:

- **No Secrets in Console Outputs**:
  - You are strictly forbidden from logging token objects, configuration secrets, or raw passwords in server logs or browser console tools.
  - *Example Violation*: `console.log("Tokens retrieved:", tokenPayload);` ❌
  - *Secure Implementation*: `console.log("Tokens refreshed for account ID:", accountId);` ✅
- **Safe, Humble User-Facing Errors**:
  - Error messages shown to users in standard web UI cards must be clear, polite, and completely sanitized of database trace logs or framework stacktraces.
  - *Unsafe UI Message*: `Failed to upload: Knex query error connecting to postgres://admin:***@host...` ❌
  - *Secure UI Message*: `We encountered an issue uploading your video. This is usually due to a temporary connection drop. Please try again.` ✅
- **Server Log Retention**:
  - Standard error logs are kept securely in private logging registers (e.g. Cloud Logging) for debugging purposes, accessible only to authorized administration.
