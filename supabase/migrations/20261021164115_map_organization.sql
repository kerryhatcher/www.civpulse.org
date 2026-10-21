-- A map may optionally belong to one organization, and an organization has at
-- most one map (1:1). Deleting the organization keeps the map.

alter table public.maps
  add column organization_id uuid unique
  references public.organizations (id) on delete set null;

comment on column public.maps.organization_id is
  'Optional owning organization. Unique, so an organization has at most one map.';
