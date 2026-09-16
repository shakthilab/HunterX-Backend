-- Arise Backend — initial schema
--
-- ID strategy: primary keys are human-readable `text` ids (e.g. `usr_1001`,
-- `tsk_2001`) rather than generated `uuid`s. This matches the id convention
-- the Arise-Admin frontend's mock data (and its TypeScript types) already
-- use everywhere (User.id, Task.id, Transaction.id, etc.), so the memory
-- driver and this Supabase driver produce interchangeable payloads with no
-- id-format translation layer in the API responses. `uuid` is still used
-- internally where nothing external ever observes the value (none of the
-- tables below need that, so plain `text` ids are used throughout).
--
-- Table coverage note: `user_activity_log` isn't in the "must create" list
-- in the project brief, but the `User.activityLog` field is part of the
-- exact User shape the frontend expects, so it's added here alongside
-- user_badges / user_reward_claims / user_feedback_tickets. `top_referrers`
-- is implemented as a query over `referral_activity` (grouped by referrer)
-- rather than its own table/view, since every field on TopReferrer is a
-- simple aggregate of ReferralActivity rows — see
-- src/db/supabase/dashboardRepository.ts. `referral_activity` doubles as the
-- source for ReferralOverview for the same reason.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (admins and regular app users share this table; role='admin' is what
-- gates access to every /admin/* endpoint).
-- ---------------------------------------------------------------------------
create table if not exists users (
  id text primary key,
  hunter_id text not null unique,
  display_name text not null,
  email text not null unique,
  avatar_url text,
  level integer not null default 1,
  xp integer not null default 0,
  rank text not null check (rank in ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic')),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  dragon_stage integer not null default 0,
  height_cm numeric not null,
  weight_kg numeric not null,
  bmi numeric not null,
  status text not null default 'active' check (status in ('active', 'banned')),
  ban_reason text,
  auth_provider text not null check (auth_provider in ('email', 'google', 'apple')),
  role text not null default 'user',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  jti text primary key,
  user_id text not null references users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_refresh_tokens_user_id on refresh_tokens (user_id);

create table if not exists user_activity_log (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  task_title text not null,
  completed_at timestamptz not null,
  xp_earned integer not null,
  verification_status text not null check (verification_status in ('approved', 'pending', 'rejected'))
);
create index if not exists idx_user_activity_log_user_id on user_activity_log (user_id);

create table if not exists user_badges (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  description text not null,
  earned_at timestamptz not null
);
create index if not exists idx_user_badges_user_id on user_badges (user_id);

create table if not exists user_reward_claims (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  reward_name text not null,
  type text not null check (type in ('coupon', 'cosmetic', 'xp_boost')),
  claimed_at timestamptz not null
);
create index if not exists idx_user_reward_claims_user_id on user_reward_claims (user_id);

create table if not exists user_feedback_tickets (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  subject text not null,
  message text not null,
  rating integer,
  status text not null check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_feedback_tickets_user_id on user_feedback_tickets (user_id);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null,
  tag text not null,
  image_url text,
  type text not null check (type in ('daily', 'weekly', 'monthly', 'one_time')),
  is_default_daily boolean not null default false,
  recurrence_days text[],
  start_date timestamptz,
  end_date timestamptz,
  level_target integer,
  target_value numeric not null,
  target_unit text not null,
  allows_partial boolean not null default false,
  xp_partial integer,
  xp_reward integer not null,
  verification_method text not null check (verification_method in ('manual', 'gps_tracked', 'health_sync', 'photo_review')),
  verification_config jsonb not null default '{}'::jsonb,
  reward_eligibility text not null check (reward_eligibility in ('standard', 'bonus', 'premium')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists task_completions (
  id text primary key,
  task_id text not null references tasks (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  user_name text not null,
  date timestamptz not null,
  value_achieved numeric not null,
  verification_status text not null check (verification_status in ('approved', 'pending', 'rejected'))
);
create index if not exists idx_task_completions_task_id on task_completions (task_id);

create table if not exists pending_reviews (
  id text primary key,
  task_id text not null references tasks (id) on delete cascade,
  task_title text not null,
  user_id text not null references users (id) on delete cascade,
  user_name text not null,
  submitted_value numeric not null,
  submitted_unit text not null,
  submitted_at timestamptz not null,
  verification_method text not null check (verification_method in ('manual', 'gps_tracked', 'health_sync', 'photo_review')),
  gps_session_summary text,
  photo_url text,
  flag_reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);
create index if not exists idx_pending_reviews_status on pending_reviews (status);

-- ---------------------------------------------------------------------------
-- Billing / growth (transactions, referrals, coupons)
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id text primary key,
  user_name text not null,
  plan text not null,
  amount numeric not null,
  status text not null check (status in ('paid', 'failed', 'pending', 'refunded')),
  date timestamptz not null,
  method text not null
);
create index if not exists idx_transactions_date on transactions (date desc);

create table if not exists referral_activity (
  id text primary key,
  referrer_id text references users (id) on delete set null,
  referrer_name text not null,
  referee_name text not null,
  status text not null check (status in ('signed_up', 'converted', 'pending')),
  date timestamptz not null
);
create index if not exists idx_referral_activity_date on referral_activity (date desc);

create table if not exists coupons (
  id text primary key,
  code text not null unique,
  tier text not null,
  status text not null check (status in ('redeemed', 'unredeemed', 'expired'))
);

create table if not exists coupon_activity (
  id text primary key,
  code text not null,
  partner text not null,
  user_name text not null,
  action text not null check (action in ('issued', 'redeemed', 'expired')),
  date timestamptz not null
);
create index if not exists idx_coupon_activity_date on coupon_activity (date desc);
