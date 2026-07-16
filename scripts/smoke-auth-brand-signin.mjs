/**
 * Auth + Brand CRUD using pre-seeded confirmed user (avoids signup rate limits).
 * Credentials are test-only smoke account.
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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = "spark.prod.smoke@gmail.com";
const password = "SparkProdSmoke1!";
const steps = [];
const ok = (step, detail) => {
  steps.push({ step, ok: true, detail });
  console.log(`OK  ${step}: ${detail}`);
};
const fail = (step, detail) => {
  steps.push({ step, ok: false, detail });
  console.error(`FAIL ${step}: ${detail}`);
  console.log(JSON.stringify({ steps }, null, 2));
  process.exit(1);
};

if (env.VITE_USE_SUPABASE !== "true") fail("env", "VITE_USE_SUPABASE must be true");

{
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("signIn", error.message);
  if (!data.session) fail("signIn", "no session");
  ok("signIn", data.user.email);
}

const user = (await supabase.auth.getUser()).data.user;
if (!user) fail("getUser", "missing");

{
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, display_name: "Smoke Director", role: "Director", email: user.email },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) fail("profile.upsert", error.message);
  ok("profile.upsert", data.id);
}

let brandId;
{
  const { data, error } = await supabase
    .from("brands")
    .insert({
      owner_id: user.id,
      name: `Live Brand ${Date.now()}`,
      niche: "Production Wiring",
      archetype: "The Operator",
      purpose: "Verify frontend↔backend brand CRUD",
      audience: { primary: "Maurice", painPoints: ["demo mode"], desires: ["real persistence"] },
      tone: [{ label: "Direct", active: true }],
      content_pillars: [{ label: "OS Loop", active: true }],
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

{
  const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (error) fail("brand.read", error.message);
  ok("brand.read", data.name);
}

{
  const { data, error } = await supabase
    .from("brands")
    .update({ name: "Live Brand Updated", niche: "Verified Persistence" })
    .eq("id", brandId)
    .select("*")
    .single();
  if (error) fail("brand.update", error.message);
  if (data.name !== "Live Brand Updated") fail("brand.update", "name mismatch");
  ok("brand.update", data.niche);
}

{
  const { data, error } = await supabase.from("brands").select("id").eq("owner_id", user.id);
  if (error) fail("brand.list", error.message);
  ok("brand.list", `${data.length} brands`);
}

console.log("\nSMOKE PASS — auth + brand CRUD");
console.log(JSON.stringify({ email, brandId, steps }, null, 2));
