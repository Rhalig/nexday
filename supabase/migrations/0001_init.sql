-- Nexday: initial schema.
-- Rules this file follows:
--   * every user-owned row has user_id, created_at, updated_at and deleted_at (soft delete, so sync can tell
--     "deleted" from "never existed")
--   * row level security is ON for every table; a person can only ever see their own rows
--   * Mac calendar events (EventKit) are NOT stored here. They are read live on the device.
--   * plan limits live in the plans table, not in code, so they can change without an app update

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- plans and subscriptions

create table public.plans (
  id          text primary key,                 -- 'free', 'pro'
  name        text not null,
  price_cents integer not null default 0,
  limits      jsonb not null default '{}'::jsonb, -- {"projects":5,"notes":50,"calendars":1,"ai_per_month":200}; null/absent = unlimited
  sort        integer not null default 0
);

insert into public.plans (id, name, price_cents, limits, sort) values
  ('free', 'Free',        0, '{"projects":5,"notes":50,"calendars":1,"ai_per_month":200}', 0),
  ('pro',  'Nexday Pro', 600, '{"calendars":5}',                                            1);

create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  avatar_url text,
  timezone   text not null default 'UTC',
  -- everything under Settings (work days, lunch, buffers, notification rules...) as one document
  settings   jsonb not null default '{}'::jsonb,
  onboarded  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  plan_id              text not null references public.plans (id) default 'free',
  status               text not null default 'active', -- active | trialing | past_due | canceled
  trial_ends_at        timestamptz,
  current_period_end   timestamptz,
  provider             text,                           -- 'stripe' | 'paddle'
  provider_customer_id text,
  provider_sub_id      text,
  updated_at           timestamptz not null default now()
);

-- AI calls are counted per month so the Gemini free tier is never exhausted by one person
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month   date not null,                               -- first day of the month
  calls   integer not null default 0,
  primary key (user_id, month)
);

-- ---------------------------------------------------------------- content

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  slug       text not null,
  color      text not null default 'var(--acc)',  -- token name or hex
  summary    text not null default '',
  due_date   date,
  status     text not null default 'active',      -- active | archived
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete set null,
  title           text not null,
  notes           text not null default '',
  status          text not null default 'open',    -- open | done
  energy          text not null default 'light',   -- deep | light
  estimate_min    integer,
  -- When it is planned. Null scheduled_start = "No time yet".
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  due_at          timestamptz,
  completed_at    timestamptz,
  rrule           text,                            -- RFC 5545 recurrence, e.g. FREQ=WEEKLY;BYDAY=MO
  source          text not null default 'manual',  -- manual | capture | inbox | note | ai
  source_id       uuid,                            -- inbox item or note it came from
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Events created inside Nexday. Events from Mac Calendar / Google are not copied here.
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  all_day    boolean not null default false,
  location   text,
  url        text,
  kind       text not null default 'blue',   -- work | blue | acc | personal | health
  rrule      text,
  external_source text,                      -- later: 'google' (when Google Calendar is added)
  external_id     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at >= starts_at)
);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  event_id   uuid references public.events (id) on delete set null,
  linked_event_title text,                   -- keeps the link readable for Mac calendar events
  title      text not null default '',
  body       jsonb not null default '[]'::jsonb,  -- editor document (blocks)
  template   text,
  category   text not null default 'ideas',   -- meetings | ideas | personal
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  time_of_day time not null default '09:00',
  length_min  integer not null default 5,
  days        smallint[] not null default '{1,2,3,4,5,6,7}',  -- ISO weekdays, 1 = Monday
  reserve_slot boolean not null default true,  -- keep a slot free on the calendar
  goal_days   integer,                         -- streak goal
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.habit_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  day        date not null,
  done       boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (habit_id, day)
);

create table public.inbox_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source      text not null default 'capture',   -- capture | email | slack | github
  title       text not null,
  meta        text not null default '',
  suggestion  jsonb not null default '{}'::jsonb, -- {kind, when, project, duration, reason}
  state       text not null default 'new',       -- new | accepted | dismissed | snoozed
  snooze_until timestamptz,
  external_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null,                     -- plan_changed | mention | up_next | inbox | habit | sync
  title      text not null,
  body       text not null default '',
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Project sharing (the Share & invite dialog). Rows give another person access to one project.
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,  -- null until the invite is accepted
  email      text not null,
  role       text not null default 'editor',     -- owner | editor | viewer
  status     text not null default 'pending',    -- pending | active
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

-- ---------------------------------------------------------------- indexes (sync pulls "changed since" per table)

create index on public.projects       (user_id, updated_at);
create index on public.tasks          (user_id, updated_at);
create index on public.tasks          (user_id, status, scheduled_start);
create index on public.subtasks       (user_id, updated_at);
create index on public.events         (user_id, updated_at);
create index on public.events         (user_id, starts_at);
create index on public.notes          (user_id, updated_at);
create index on public.habits         (user_id, updated_at);
create index on public.habit_checkins (user_id, updated_at);
create index on public.inbox_items    (user_id, updated_at);
create index on public.notifications  (user_id, updated_at);
create unique index projects_slug_per_user on public.projects (user_id, slug) where deleted_at is null;

-- ---------------------------------------------------------------- updated_at triggers

do $$
declare t text;
begin
  foreach t in array array['profiles','subscriptions','projects','tasks','subtasks','events','notes',
                           'habits','habit_checkins','inbox_items','notifications']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security

alter table public.plans           enable row level security;
alter table public.profiles        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.ai_usage        enable row level security;
alter table public.projects        enable row level security;
alter table public.tasks           enable row level security;
alter table public.subtasks        enable row level security;
alter table public.events          enable row level security;
alter table public.notes           enable row level security;
alter table public.habits          enable row level security;
alter table public.habit_checkins  enable row level security;
alter table public.inbox_items     enable row level security;
alter table public.notifications   enable row level security;
alter table public.project_members enable row level security;

-- plans are public information
create policy plans_read on public.plans for select using (true);

-- profile: own row only
create policy profiles_own on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- subscriptions and AI usage: people can read their own; only the server (service role) writes them
create policy subscriptions_read on public.subscriptions for select using (user_id = auth.uid());
create policy ai_usage_read      on public.ai_usage       for select using (user_id = auth.uid());

-- everything a person creates: own rows only
do $$
declare t text;
begin
  foreach t in array array['tasks','subtasks','events','notes','habits','habit_checkins','inbox_items','notifications']
  loop
    execute format('create policy %I on public.%I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

-- Sharing checks go through these functions. They run with the table owner's rights so the two
-- policies below do not call each other (projects -> members -> projects would loop forever).
create or replace function public.is_project_owner(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and user_id = auth.uid())
$$;
create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
                 where project_id = pid and user_id = auth.uid() and status = 'active')
$$;

-- projects: the owner, plus active members who were invited (read only)
create policy projects_own on public.projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy projects_shared_read on public.projects for select
  using (public.is_project_member(id));

-- members: the project owner manages them; a member can see their own membership
create policy members_owner on public.project_members for all
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy members_self_read on public.project_members for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- new user: profile + free plan

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.subscriptions (user_id, plan_id, status, trial_ends_at)
    values (new.id, 'free', 'trialing', now() + interval '14 days');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
