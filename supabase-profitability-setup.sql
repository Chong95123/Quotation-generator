-- Run this once in the Supabase SQL Editor before using Dashboard profitability.
-- VO item costs are estimated values entered by the user.
alter table public.vo_items
  add column if not exists unit_cost numeric(12, 2) not null default 0;

create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  cost_type text not null default 'overhead' check (cost_type in ('direct', 'overhead')),
  created_at timestamptz not null default now()
);

alter table public.project_costs enable row level security;

drop policy if exists "Users can view their project costs" on public.project_costs;
create policy "Users can view their project costs"
  on public.project_costs for select to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  ));

drop policy if exists "Users can add their project costs" on public.project_costs;
create policy "Users can add their project costs"
  on public.project_costs for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  ));

drop policy if exists "Users can delete their project costs" on public.project_costs;
create policy "Users can delete their project costs"
  on public.project_costs for delete to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  ));

grant select, insert, delete on public.project_costs to authenticated;
