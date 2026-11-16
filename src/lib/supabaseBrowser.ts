'use client';
// Single browser-side Supabase client (public key). Used only to run the
// Google OAuth redirect and read the resulting session on callback.
// Created lazily so prerendering during `next build` doesn't crash when the
// env vars are missing. NEXT_PUBLIC_* refs must stay literal so Next inlines them.
import { lazySupabase, requireEnv } from './lazySupabase';

export const supabaseBrowser = lazySupabase(
  () => requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  () =>
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
  { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } }
);
