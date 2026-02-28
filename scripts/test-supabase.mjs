import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.from("org_mapping").select("*").limit(1);
    if (error) throw error;
    console.log("✓ Supabase connection successful!");
    console.log(data?.length ? `  Found ${data.length} row(s) in org_mapping` : "  Table empty (run 002_seed_data.sql to seed)");
    process.exit(0);
  } catch (err) {
    console.error("✗ Connection failed:", err.message);
    if (err.message?.includes("relation") && err.message?.includes("does not exist")) {
      console.error("  → Run the migrations in Supabase SQL Editor first (001_initial_schema.sql)");
    }
    process.exit(1);
  }
}

test();
