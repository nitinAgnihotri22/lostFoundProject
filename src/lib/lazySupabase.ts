// Lazily-created Supabase clients
// -------------------------------------------------
// Creating a client at module load crashes `next build` when env vars are
// absent at build time ("supabaseUrl is required"). These helpers defer
// creation until the client is first used (i.e. at request time), while
// keeping the same `client.from(...)` / `client.auth...` call style.

import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Set it in .env.local (local) or your host's Variables (e.g. Railway).`);
  }
  return value;
}

export function lazySupabase(
  getUrl: () => string,
  getKey: () => string,
  options?: SupabaseClientOptions<'public'>
): SupabaseClient {
  let client: SupabaseClient | undefined;
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      client ??= createClient(getUrl(), getKey(), options);
      const value = Reflect.get(client, prop, client);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}
