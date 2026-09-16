import dotenv from 'dotenv';

dotenv.config();

type DbDriver = 'memory' | 'supabase';

function resolveDbDriver(): DbDriver {
  const explicit = process.env.DB_DRIVER as DbDriver | undefined;
  if (explicit === 'memory' || explicit === 'supabase') return explicit;

  const hasSupabaseCreds = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return hasSupabaseCreds ? 'supabase' : 'memory';
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  dbDriver: resolveDbDriver(),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
