import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project-ref") || supabaseAnonKey.includes("your-anon-key")) {
  console.warn(
    "Supabase credentials missing or placeholder. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env (see .env.example)"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
