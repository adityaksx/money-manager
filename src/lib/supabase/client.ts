"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient: ReturnType<typeof createClient<any>> | undefined;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    // App rows are typed at the feature layer until generated database types are checked in.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browserClient = createClient<any>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return browserClient;
}
