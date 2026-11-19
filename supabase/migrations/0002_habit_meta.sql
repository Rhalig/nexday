-- Habit cards show a few figures (rate, streak, "up next" text) that will later be computed from
-- habit_checkins. Until there is enough history they are kept next to the habit.
alter table public.habits add column if not exists meta jsonb not null default '{}'::jsonb;
