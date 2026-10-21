-- Organizations: public directory entries managed by admins.
-- Admins are an allowlist; membership is managed with the service role, not by app users.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Allowlist of users allowed to manage organizations.';

alter table public.admins enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

comment on function public.is_admin() is 'True when the current user is in public.admins.';

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can see the admin list"
  on public.admins
  for select
  to authenticated
  using (public.is_admin());

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 40),
  address_line text check (char_length(address_line) <= 200),
  website_url text check (char_length(website_url) <= 500),
  social_url text check (char_length(social_url) <= 500),
  logo_path text check (char_length(logo_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Public directory of community organizations.';

alter table public.organizations enable row level security;

create policy "Organizations are publicly readable"
  on public.organizations
  for select
  using (true);

create policy "Admins can insert organizations"
  on public.organizations
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update organizations"
  on public.organizations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete organizations"
  on public.organizations
  for delete
  to authenticated
  using (public.is_admin());

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

-- Public logo storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Org logos are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'org-logos');

create policy "Admins can upload org logos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'org-logos' and public.is_admin());

create policy "Admins can update org logos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'org-logos' and public.is_admin());

create policy "Admins can remove org logos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'org-logos' and public.is_admin());
