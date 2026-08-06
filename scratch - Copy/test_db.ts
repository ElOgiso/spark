import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse env
const envContent = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || "";
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Connecting to Supabase...");
  // Query 1 row from accounts table to see the column names
  const { data, error } = await supabase.from("accounts").select("*").limit(1);
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Success! Accounts row data:", data);
  }
}

run();
