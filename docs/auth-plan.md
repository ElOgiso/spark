# Authentication and Authorization Plan

This document details the authentication and authorization design prepared for the production transition of the Spark Media Operating System.

---

## 1. Authentication Infrastructure
Spark will leverage **Supabase Auth** as the core authentication provider, which handles JSON Web Tokens (JWTs), password hashing, email verification, and OAuth integrations natively.

### Core Flows
- **Sign Up / Sign In**:
  - Email/Password authentication.
  - Social OAuth logins (Google, GitHub, LinkedIn) for friction-free onboarding.
- **Session Management**:
  - Secure, HTTP-only cookie-based sessions or local storage JWT handling managed by the Supabase SDK client.
- **Profile Initialization**:
  - A PostgreSQL trigger on `auth.users` automatically inserts a matching record into public `profiles` upon signup.

---

## 2. User & Tenant Modeling

### Profile Record
Every authenticated user gets a corresponding `profiles` entry:
- `id` (references `auth.users`)
- `email`
- `full_name`

### Brand Ownership & Multi-Tenancy
Spark works on a **Brand** paradigm (Users operate media brands, not prompts).
- **Owner Relationship**: A `brands` record holds an `owner_id` pointing to the creator profile.
- **Scoping**: All system resources (e.g., `productions`, `review_items`, `publish_jobs`, `assets`, `memory_items`) must include a `brand_id` field.
- **Access Verification**: All select/insert/update operations on scoped tables are protected by brand-ownership validations.

### Team Access & Roles (Future Expansion)
In later phases, brand ownership will expand to collaborative team access:
- **`memberships` Table**:
  - `id` (uuid)
  - `brand_id` (uuid, references `brands`)
  - `user_id` (uuid, references `profiles`)
  - `role` (text) — 'Owner', 'Editor', 'Viewer'
- **Access Guard**: Row level policies will check if `auth.uid()` has an active membership record with appropriate role permissions for the target `brand_id`.

---

## 3. Route Access Control Strategy

Spark's application routing will distinguish between public marketing/legal landing pages and private application dashboards.

### Private Dashboard Routes (Require Authentication)
The following routes must be protected under a client-side middleware or Next.js server component guard. Unauthenticated users are redirected to `/login`:
- `/` or `/dashboard` (Spark main loop)
- `/my-spark` (Brand settings, rules, character setup)
- `/viral-sparks` (Predictive feed)
- `/review` (Creative & production reviews)
- `/calendar` (Schedule and publishing track)
- `/analytics` (Performance stats & learnings)
- `/billing` (Subscription & payment configurations)

### Public Legal & Marketing Routes (Anonymous Access Allowed)
The following routes are indexed and accessible to non-logged-in users:
- `/login` (Sign in page)
- `/signup` (Registration page)
- `/terms` (Terms of service)
- `/privacy` (Privacy policy)

---

## 4. Row Level Security (RLS) Rules Blueprint

To guarantee data segregation between brands, the database level strictly enforces Row Level Security:

```sql
-- Enable RLS on core user and brand content
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: A user can only access their own profile
CREATE POLICY "Users can only read their own profiles."
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can only update their own profiles."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Brands: Owners have full CRUD access; others have no visibility
CREATE POLICY "Owners have full CRUD on their brands."
  ON public.brands FOR ALL
  USING (auth.uid() = owner_id);

-- 3. Scoped Content Policy (e.g. Productions)
-- Requires helper function user_owns_brand() defined in schema plans
CREATE POLICY "Authenticated users can only access their brand's productions."
  ON public.productions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE id = productions.brand_id AND owner_id = auth.uid()
    )
  );
```
