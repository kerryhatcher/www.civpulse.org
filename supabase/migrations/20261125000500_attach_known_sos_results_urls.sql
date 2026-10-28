-- Attach the three user-supplied feeds to the existing, explicitly identified
-- election records. Preserve any URL an administrator has already supplied.
update public.elections e
set results_json_url = source.url
from (values
  ('2026-05-19'::date, '2026-05-19-general-primary',
   'https://results.sos.ga.gov/cdn/results/Georgia/export-GeneralPrimary51926.json'),
  ('2026-02-17'::date, '2026-02-17-georgia-state-senate-district-18-special-runoff',
   'https://results.sos.ga.gov/cdn/results/Georgia/export-Feb1726StateSenateDistrict18.json'),
  ('2026-01-20'::date, '2026-01-20-georgia-state-senate-district-18-special-election',
   'https://results.sos.ga.gov/cdn/results/Georgia/export-January20SpecialElection.json')
) as source(election_date,slug,url)
where e.election_date=source.election_date and e.slug=source.slug
  and e.results_json_url is null;
