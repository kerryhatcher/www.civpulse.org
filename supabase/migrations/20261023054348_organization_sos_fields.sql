-- Optional historical Georgia Secretary of State registration data.
-- Existing organization read/admin-write RLS applies to these columns.
alter table public.organizations
  add column sos_control_number text,
  add column sos_business_type text,
  add column sos_status text,
  add column sos_formation_date date,
  add column sos_last_annual_registration text,
  add column sos_principal_office text,
  add column sos_registered_agent text,
  add column sos_county text,
  add column sos_naics_code text,
  add column sos_officers text,
  add column sos_record_url text;

alter table public.organizations add constraint organizations_sos_record_url_check
  check (sos_record_url is null or sos_record_url ~ '^https://ecorp\.sos\.ga\.gov/[^[:space:]]+$');
comment on column public.organizations.sos_status is 'Status as recorded in source research; not a current verification.';
comment on column public.organizations.sos_last_annual_registration is 'Value as recorded, including year-only registrations.';
