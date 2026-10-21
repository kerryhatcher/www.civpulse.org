-- Official campaign websites researched 2026-10-21 for all 50 November
-- candidates (including certified write-ins). Evidence and unresolved names:
-- docs/research/2026-11-03-campaign-websites.json
-- Replace only missing URLs or the old county-PDF provenance placeholders.
-- Preserve any independently maintained website entered by an admin.
-- No unverified campaign URL is inferred from the candidate's name.
update public.people p
set website_url = verified.campaign_url
from (values
  ('andrew-pacetti', 'https://www.andyforgeorgia.com/'::text),
  ('anissa-m-jones', 'https://www.electanissajones.com/'::text),
  ('austin-scott', 'https://www.scottforga.com/'::text),
  ('barbara-rivera-holmes', 'https://www.barbaraforga.com/home'::text),
  ('brian-strickland', 'https://stricklandforgeorgia.com/'::text),
  ('calvin-palmer', null::text),
  ('cassandra-easton', null::text),
  ('christina-clement', 'https://stateoflocnation.com/'::text),
  ('dale-washburn', 'https://www.washburnforstatehouse.com/'::text),
  ('david-c-byrne', null::text),
  ('david-e-lucas', null::text),
  ('david-leon-moreland', null::text),
  ('deb-broughton-davis', null::text),
  ('elbert-arthur-bartell', 'https://bartellforsenate.com/'::text),
  ('eric-wilson', 'https://www.voteericwilson.com/'::text),
  ('fitz-johnson', 'https://www.friendsforfitz.com/'::text),
  ('floyd-griffin', 'https://floydgriffin.com/'::text),
  ('greg-dolezal', 'https://gregdolezal.com/'::text),
  ('jacqueline-angela-dacosta', null::text),
  ('john-king', 'https://www.votejohnking.com/'::text),
  ('jon-ossoff', 'https://electjon.com/'::text),
  ('josh-mclaurin', 'https://www.joshmclaurin.com/'::text),
  ('josh-tolbert', 'https://www.teamtolbert.com/'::text),
  ('justin-laster', 'https://justinjlaster.com/'::text),
  ('katherine-e-juhan-arnold', 'https://katherineforgeorgia.com/Home'::text),
  ('keisha-lance-bottoms', 'https://www.keishaforgovernor.com/'::text),
  ('keisha-sean-waites', 'https://www.keishawaites.org/'::text),
  ('kelly-esti', 'https://www.kellyesti4congress.com/'::text),
  ('leland-j-olinger-iii', null::text),
  ('lindsay-d-holliday', null::text),
  ('lydia-powell', 'https://www.drlydiapowell.com/'::text),
  ('matt-day', 'https://www.votemattday.com/'::text),
  ('mike-collins', 'https://mikecollinsga.com/'::text),
  ('milton-j-lofton', null::text),
  ('miriam-paris', 'https://www.miriamparisforgeorgia.com/'::text),
  ('nikki-porcher', 'https://www.voteporcher4ga.com/'::text),
  ('penny-brown-reynolds', 'https://www.pennyforgeorgia.com/'::text),
  ('peter-hubbard', 'https://www.peterforgeorgia.com/'::text),
  ('randy-peters', 'https://randypetersforgeorgia.com/'::text),
  ('richard-woods', 'https://www.woodsforsuper.com/'::text),
  ('rick-a-williams', 'https://www.rickwilliamsforgeorgia.com/'::text),
  ('rick-jackson', 'https://rickjackson.com/'::text),
  ('sanford-bishop', 'https://sanfordbishop.com/'::text),
  ('shelia-edwards', 'https://www.shelia4psc.com/'::text),
  ('steven-mcneel', 'https://www.votestevenmcneel.com/'::text),
  ('tangie-herring', 'https://www.tangieforgeorgia.com/'::text),
  ('tanya-miller', 'https://www.tanyaforgeorgia.com/'::text),
  ('tim-fleming', 'https://www.flemingforga.com/'::text),
  ('tracy-wheeler', null::text),
  ('tyler-harper', 'https://tylerharperga.com/'::text)
) as verified(slug, campaign_url)
where p.slug = verified.slug
  and (p.website_url is null or p.website_url in (
    'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf',
    'https://www.maconbibb.us/wp-content/uploads/2026/10/2026-Certified-Write-In-Candidates-for-November-3rd-General-Election_10-15.pdf'
  ))
  and p.website_url is distinct from verified.campaign_url
  and exists (
    select 1 from public.contest_candidates cc
    join public.contests c on c.id = cc.contest_id
    join public.elections e on e.id = c.election_id
    where cc.person_id = p.id and e.slug = '2026-11-03-general-election'
      and e.election_date = date '2026-11-03'
  );
