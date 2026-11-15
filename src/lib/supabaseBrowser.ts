'use client';
// Single browser-side Supabase client (public key). Used only to run the
// Google OAuth redirect and read the resulting session on callback.
import { createClient } from '@supabase/supabase-js';

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
  { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } }
);
