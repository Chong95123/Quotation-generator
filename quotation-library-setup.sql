-- Run once in Supabase SQL Editor to enable account-synced room models and quotation packages.
create table if not exists public.quotation_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  template_type text not null check (template_type in ('room', 'package')),
  section_name text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotation_templates enable row level security;

drop policy if exists "Users can view their quotation templates" on public.quotation_templates;
create policy "Users can view their quotation templates"
  on public.quotation_templates for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add their quotation templates" on public.quotation_templates;
create policy "Users can add their quotation templates"
  on public.quotation_templates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can edit their quotation templates" on public.quotation_templates;
create policy "Users can edit their quotation templates"
  on public.quotation_templates for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their quotation templates" on public.quotation_templates;
create policy "Users can delete their quotation templates"
  on public.quotation_templates for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.quotation_templates to authenticated;
