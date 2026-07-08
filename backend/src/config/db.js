import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file");
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.warn(
    "WARNING: SUPABASE_SERVICE_KEY is not set. Falling back to anon key — " +
    "inserts/updates may be blocked by Row Level Security (RLS). " +
    "Add your service role key from: Supabase Dashboard → Settings → API → service_role"
  );
}

// Use the service role key on the backend to bypass RLS for trusted server operations.
// Never expose this key in the frontend or client-side code.
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

