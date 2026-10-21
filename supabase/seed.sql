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

-- The November 3, 2026 general election, its contests, and its key dates. Key
-- dates are calendar events tagged with the election so they appear on the
-- community calendar as well as the election page.
insert into public.elections (
  id,
  slug,
  name,
  election_date,
  kind,
  description,
  organization_id,
  visibility
)
values (
  'c0000000-0000-4000-8000-000000000001',
  '2026-11-03-general-election',
  'November 3, 2026 General Election',
  '2026-11-03',
  'general',
  'Federal, state, and special offices on the general election ballot in Macon-Bibb County.',
  'a0000000-0000-4000-8000-000000000001',
  'public'
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  election_date = excluded.election_date,
  kind = excluded.kind,
  description = excluded.description,
  organization_id = excluded.organization_id,
  visibility = excluded.visibility;

-- Fictional sample candidates for local development only.
insert into public.people (id, slug, full_name, kind, title, description, visibility)
values
  (
    'b0000000-0000-4000-8000-000000000003',
    'jordan-ellis',
    'Jordan Ellis',
    'candidate',
    null,
    'Sample candidate record for local development.',
    'public'
  ),
  (
    'b0000000-0000-4000-8000-000000000004',
    'riley-chen',
    'Riley Chen',
    'candidate',
    null,
    'Sample candidate record for local development.',
    'public'
  )
on conflict (id) do update set
  slug = excluded.slug,
  full_name = excluded.full_name,
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  visibility = excluded.visibility;

insert into public.contests (id, election_id, office, district, seat, description, partisan, position)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'US Senator',
    null,
    'Class II',
    'United States Senate seat for Georgia.',
    true,
    1
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'State Representative',
    'District 142',
    null,
    'Georgia House of Representatives.',
    true,
    2
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001',
    'School Board Member',
    'District 3',
    null,
    'Bibb County Board of Education.',
    false,
    3
  )
on conflict (id) do update set
  election_id = excluded.election_id,
  office = excluded.office,
  district = excluded.district,
  seat = excluded.seat,
  description = excluded.description,
  partisan = excluded.partisan,
  position = excluded.position;

insert into public.contest_candidates (contest_id, person_id, party, status, position)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'Sample Party',
    'running',
    1
  ),
  (
    'd0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000004',
    null,
    'running',
    2
  )
on conflict (contest_id, person_id) do update set
  party = excluded.party,
  status = excluded.status,
  position = excluded.position;

-- A calendar for the election office so key dates live on the community calendar.
insert into public.calendars (id, organization_id, slug, name, description, visibility)
values (
  'e0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'election-dates',
  'Election Dates',
  'Registration deadlines, early voting windows, and election days.',
  'public'
)
on conflict (id) do update set
  organization_id = excluded.organization_id,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility;

insert into public.events (
  id,
  calendar_id,
  title,
  description,
  starts_at,
  ends_at,
  all_day,
  location,
  election_id,
  election_date_kind,
  visibility
)
values
  (
    'f0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000001',
    'Voter registration deadline',
    'Last day to register to vote in the November 3, 2026 general election.',
    '2026-10-05T00:00:00-04:00',
    null,
    true,
    null,
    'c0000000-0000-4000-8000-000000000001',
    'registration_deadline',
    'public'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000001',
    'Early voting begins',
    'Advanced in-person voting opens at the Macon-Bibb Board of Elections and satellite locations.',
    '2026-10-12T08:30:00-04:00',
    null,
    false,
    'Macon-Bibb County Board of Elections, 3661 Eisenhower Pkwy, Macon, GA 31206',
    'c0000000-0000-4000-8000-000000000001',
    'early_voting',
    'public'
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000001',
    'Early voting ends',
    'Last day of advanced in-person voting before election day.',
    '2026-10-30T17:30:00-04:00',
    null,
    false,
    'Macon-Bibb County Board of Elections, 3661 Eisenhower Pkwy, Macon, GA 31206',
    'c0000000-0000-4000-8000-000000000001',
    'early_voting',
    'public'
  ),
  (
    'f0000000-0000-4000-8000-000000000004',
    'e0000000-0000-4000-8000-000000000001',
    'Absentee ballot request deadline',
    'Last day to request an absentee (mail-in) ballot for the November 3, 2026 general election.',
    '2026-10-30T17:00:00-04:00',
    null,
    false,
    null,
    'c0000000-0000-4000-8000-000000000001',
    'absentee_request_deadline',
    'public'
  ),
  (
    'f0000000-0000-4000-8000-000000000005',
    'e0000000-0000-4000-8000-000000000001',
    'Election day — November 3, 2026',
    'Polls are open 7:00 a.m. – 7:00 p.m. Voters must report to their assigned polling location.',
    '2026-11-03T07:00:00-05:00',
    '2026-11-03T19:00:00-05:00',
    false,
    'Your assigned polling location',
    'c0000000-0000-4000-8000-000000000001',
    'election_day',
    'public'
  )
on conflict (id) do update set
  calendar_id = excluded.calendar_id,
  title = excluded.title,
  description = excluded.description,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  all_day = excluded.all_day,
  location = excluded.location,
  election_id = excluded.election_id,
  election_date_kind = excluded.election_date_kind,
  visibility = excluded.visibility;
