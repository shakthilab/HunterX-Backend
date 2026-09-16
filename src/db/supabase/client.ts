import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

// Lazily constructed so importing this module never throws when running the
// memory driver (no Supabase credentials configured).
//
// Typed as `any`: we have no generated Database schema type (no live
// project to generate one from), and without it @supabase/supabase-js
// infers `never` for every table's row/insert/update shape, which would
// force every query in this driver behind a wall of `as any` casts. A
// single untyped client here keeps the rest of the driver readable; row
// shapes are still checked at the boundary by the mappers in mappers.ts.
let client: any = null;

export function getSupabaseClient(): any {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set when DB_DRIVER=supabase');
    }
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
