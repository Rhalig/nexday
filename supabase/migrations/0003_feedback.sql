-- Feedback sent from Help & feedback. Anyone signed in can add their own; nobody can read it back
-- from the app (the team reads it in the dashboard).
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null default 'idea' check (kind in ('idea', 'bug', 'question')),
  message    text not null check (char_length(message) between 3 and 4000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: add your own" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());
