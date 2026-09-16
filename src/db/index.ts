import { env } from '../config/env';
import type { Repositories } from './repository';
import { createMemoryRepositories } from './memory';

let repositories: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!repositories) {
    if (env.dbDriver === 'supabase') {
      // Imported lazily so `@supabase/supabase-js` client construction (and
      // its credential check) only happens when actually selected.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createSupabaseRepositories } = require('./supabase') as typeof import('./supabase');
      repositories = createSupabaseRepositories();
      // eslint-disable-next-line no-console
      console.log('[db] using supabase driver');
    } else {
      repositories = createMemoryRepositories();
      // eslint-disable-next-line no-console
      console.log('[db] using in-memory driver');
    }
  }
  return repositories;
}
