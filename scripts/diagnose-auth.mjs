/**
 * Diagnose login flow: sign in with anon key (like the app) and fetch profile.
 * Run: node scripts/diagnose-auth.mjs
 * Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY in .env
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, "..", ".env"), "utf8");
  env.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
} catch {}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function diagnose() {
  const email = "bm@hertz.demo";
  const password = "demo123";

  console.log("1. Signing in with", email, "...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    console.error("   FAILED:", authError.message);
    process.exit(1);
  }
  console.log("   OK — session user id:", authData.user?.id);

  console.log("2. Fetching user_profiles for", authData.user.id, "...");
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, role, display_name, branch")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("   FAILED:", profileError.message);
    process.exit(1);
  }
  if (!profile) {
    console.error("   FAILED: No profile row found. Run: npm run seed:users");
    process.exit(1);
  }
  if (!profile.role) {
    console.error("   FAILED: Profile exists but role is null");
    process.exit(1);
  }

  console.log("   OK — profile:", profile);
  console.log("\nLogin flow works. If the app still fails, check browser console for [Auth] errors.");
}

diagnose().catch((e) => {
  console.error(e);
  process.exit(1);
});
