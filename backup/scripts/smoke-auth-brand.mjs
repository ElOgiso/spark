/**
 * Production smoke test: Auth + Brand CRUD against live SPARK Supabase.
 * Usage: node scripts/smoke-auth-brand.mjs
 * Reads VITE_* from .env.local (no secrets committed).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) throw new Error("Missing .env.local");
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const use = env.VITE_USE_SUPABASE;

if (use !== "true" || !url || !key) {
  console.error("FAIL: VITE_USE_SUPABASE must be true with URL and publishable key");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Real-looking domain required by Supabase Auth email validation
const email = `spark.smoke.${Date.now()}@gmail.com`;
const password = `SparkSmoke!${Date.now().toString().slice(-6)}aA1`;

const report = { steps: [] };
function ok(step, detail) {
  report.steps.push({ step, ok: true, detail });
  console.log(`OK  ${step}: ${detail}`);
}
function fail(step, detail) {
  report.steps.push({ step, ok: false, detail });
  console.error(`FAIL ${step}: ${detail}`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

// 1) Sign up
{
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) fail("signUp", error.message);
  if (!data.user) fail("signUp", "No user returned");
  ok("signUp", `user ${data.user.id}`);
  // If email confirmation required, session may be null — mark for external confirm
  if (!data.session) {
    report.needsEmailConfirm = true;
    ok("signUp.session", "no session yet (email confirm may be required)");
  } else {
    ok("signUp.session", "session issued");
  }
}

// 2) Sign in (after possible confirm wait handled by caller via SQL)
{
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && /confirm|email/i.test(error.message)) {
    report.emailConfirmBlocked = error.message;
    fail("signIn", `${error.message} — confirm email via Auth settings or SQL email_confirmed_at`);
  }
  if (error) fail("signIn", error.message);
  if (!data.session) fail("signIn", "No session");
  ok("signIn", `session for ${data.user.email}`);
}

const user = (await supabase.auth.getUser()).data.user;
if (!user) fail("getUser", "missing");

// 3) Upsert profile
{
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: "Smoke Director",
        role: "Director",
        email: user.email,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) fail("profile.upsert", error.message);
  ok("profile.upsert", data.id);
}

// 4) Brand create
let brandId;
{
  const { data, error } = await supabase
    .from("brands")
    .insert({
      owner_id: user.id,
      name: "Smoke Brand OS",
      niche: "Smoke Test Niche",
      archetype: "The Verifier",
      purpose: "Prove brand CRUD against live Supabase",
      audience: { primary: "Builders", painPoints: ["demo data"], desires: ["real persistence"] },
      tone: [{ label: "Direct", active: true }],
      content_pillars: [{ label: "Verification", active: true }],
      automation_mode: "balanced",
      review_required: true,
      publish_requires_approval: true,
      autonomous_publishing_enabled: false,
    })
    .select("*")
    .single();
  if (error) fail("brand.create", error.message);
  brandId = data.id;
  ok("brand.create", brandId);
}

// 5) Brand read
{
  const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (error) fail("brand.read", error.message);
  if (data.name !== "Smoke Brand OS") fail("brand.read", "name mismatch");
  ok("brand.read", data.name);
}

// 6) Brand update
{
  const { data, error } = await supabase
    .from("brands")
    .update({ name: "Smoke Brand OS Updated", niche: "Verified Niche" })
    .eq("id", brandId)
    .select("*")
    .single();
  if (error) fail("brand.update", error.message);
  if (data.name !== "Smoke Brand OS Updated") fail("brand.update", "name not updated");
  ok("brand.update", data.name);
}

// 7) List owner brands
{
  const { data, error } = await supabase.from("brands").select("id,name").eq("owner_id", user.id);
  if (error) fail("brand.list", error.message);
  if (!data?.length) fail("brand.list", "empty");
  ok("brand.list", `${data.length} brand(s)`);
}

console.log("\nSMOKE PASS");
console.log(JSON.stringify({ email, brandId, steps: report.steps }, null, 2));
process.exit(0);
