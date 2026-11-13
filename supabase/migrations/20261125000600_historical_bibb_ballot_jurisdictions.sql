-- These local contests occur in the official Bibb County May 19 export:
-- https://results.sos.ga.gov/cdn/results/Georgia/export-GeneralPrimary51926.json
-- Record the jurisdiction explicitly; presentation must not infer it from a
-- free-form description containing a source URL. Preserve existing districts.
update public.contests c
set district = 'Bibb County'
from public.elections e
where c.election_id=e.id and e.slug='2026-05-19-general-primary'
  and e.election_date='2026-05-19' and c.district is null
  and c.office in (
    'State Court Judge (Hanson)', 'State Court Judge (Lewis)',
    'For Civil/Magistrate Court Judge', 'Macon Water Authority',
    'Macon Water Authority - District 1', 'Macon Water Authority - District 2',
    'Macon Water Authority - District 4', 'BOE - Post 7 - At Large',
    'BOE - Post 8 - At Large'
  );
