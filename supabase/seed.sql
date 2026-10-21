-- Local-only seed data. Add development fixtures here as the schema grows.

-- Sample civic records: a county election office and its two officials.
insert into public.organizations (id, slug, name, description)
values (
  'a0000000-0000-4000-8000-000000000001',
  'bibb-county-board-of-elections',
  'Bibb County Board of Elections',
  'Administers elections and voter registration for Bibb County, Georgia.'
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description;

insert into public.people (
  id,
  slug,
  full_name,
  kind,
  title,
  email,
  phone,
  fax,
  address_line,
  address_line2,
  city,
  state,
  postal_code,
  visibility
)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'thomas-jackson-gillon-jr',
    'Thomas Jackson Gillon Jr',
    'appointed_official',
    'Election Supervisor',
    'tgillon@maconbibb.us',
    null,
    '(478) 910-2365',
    '3661 Eisenhower Parkway',
    'MB 101',
    'Macon',
    'GA',
    '31206',
    'public'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'yashica-kendrick',
    'Yashica Kendrick',
    'appointed_official',
    'Election Registrar',
    'ykendrick@maconbibb.us',
    '(478) 621-6622',
    '(478) 910-2365',
    '3361 Eisenhower Pkwy',
    'MB 101',
    'Macon',
    'GA',
    '31206',
    'public'
  )
on conflict (id) do update set
  slug = excluded.slug,
  full_name = excluded.full_name,
  kind = excluded.kind,
  title = excluded.title,
  email = excluded.email,
  phone = excluded.phone,
  fax = excluded.fax,
  address_line = excluded.address_line,
  address_line2 = excluded.address_line2,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  visibility = excluded.visibility;

insert into public.person_organizations (person_id, organization_id, role)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'Election Supervisor'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'Election Registrar'
  )
on conflict (person_id, organization_id) do update set
  role = excluded.role;
