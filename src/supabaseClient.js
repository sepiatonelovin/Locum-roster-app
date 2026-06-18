import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This shows up in the browser console, not to the user — it's here so a
  // missing/misnamed environment variable is obvious instead of a silent failure.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env file (locally) or your Netlify site's Environment variables (in production)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
