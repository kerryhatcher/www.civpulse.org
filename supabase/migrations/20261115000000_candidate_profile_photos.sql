-- Official government/campaign photos verified October 22, 2026.
-- Sources and unresolved candidates: docs/research/2026-11-03-candidate-photos.json.
-- Immutable image copies already uploaded to the public person-images bucket.
-- Fill only missing images; preserve photos independently selected by admins.
update public.people p
set image_path = verified.image_path
from (values
  ('elbert-arthur-bartell', 'candidates/2026-10-22/elbert-arthur-bartell.jpg'),
  ('keisha-lance-bottoms', 'candidates/2026-10-22/keisha-lance-bottoms.jpg'),
  ('justin-laster', 'candidates/2026-10-22/justin-laster.jpg'),
  ('andrew-pacetti', 'candidates/2026-10-22/andrew-pacetti.jpg'),
  ('greg-dolezal', 'candidates/2026-10-22/greg-dolezal.jpg'),
  ('josh-mclaurin', 'candidates/2026-10-22/josh-mclaurin.jpg'),
  ('tim-fleming', 'candidates/2026-10-22/tim-fleming.jpg'),
  ('penny-brown-reynolds', 'candidates/2026-10-22/penny-brown-reynolds.png'),
  ('brian-strickland', 'candidates/2026-10-22/brian-strickland.webp'),
  ('tanya-miller', 'candidates/2026-10-22/tanya-miller.jpg'),
  ('tyler-harper', 'candidates/2026-10-22/tyler-harper.jpg'),
  ('john-king', 'candidates/2026-10-22/john-king.jpg'),
  ('keisha-sean-waites', 'candidates/2026-10-22/keisha-sean-waites.png'),
  ('lydia-powell', 'candidates/2026-10-22/lydia-powell.jpg'),
  ('barbara-rivera-holmes', 'candidates/2026-10-22/barbara-rivera-holmes.png'),
  ('nikki-porcher', 'candidates/2026-10-22/nikki-porcher.jpg'),
  ('peter-hubbard', 'candidates/2026-10-22/peter-hubbard.jpg'),
  ('josh-tolbert', 'candidates/2026-10-22/josh-tolbert.png'),
  ('shelia-edwards', 'candidates/2026-10-22/shelia-edwards.jpg'),
  ('matt-day', 'candidates/2026-10-22/matt-day.jpg'),
  ('kelly-esti', 'candidates/2026-10-22/kelly-esti.png'),
  ('steven-mcneel', 'candidates/2026-10-22/steven-mcneel.jpg'),
  ('rick-a-williams', 'candidates/2026-10-22/rick-a-williams.jpg'),
  ('miriam-paris', 'candidates/2026-10-22/miriam-paris.jpg'),
  ('dale-washburn', 'candidates/2026-10-22/dale-washburn.jpg'),
  ('tangie-herring', 'candidates/2026-10-22/tangie-herring.jpg'),
  ('floyd-griffin', 'candidates/2026-10-22/floyd-griffin.jpg'),
  ('mike-collins', 'candidates/2026-10-22/mike-collins.jpg'),
  ('austin-scott', 'candidates/2026-10-22/austin-scott.png'),
  ('anissa-m-jones', 'candidates/2026-10-22/anissa-m-jones.jpg'),
  ('sanford-bishop', 'candidates/2026-10-22/sanford-bishop.jpg'),
  ('jon-ossoff', 'candidates/2026-10-22/jon-ossoff.jpg'),
  ('richard-woods', 'candidates/2026-10-22/richard-woods.jpg'),
  ('david-e-lucas', 'candidates/2026-10-22/david-e-lucas.jpg'),
  ('eric-wilson', 'candidates/2026-10-22/eric-wilson.png'),
  ('fitz-johnson', 'candidates/2026-10-22/fitz-johnson.jpg')
) as verified(slug, image_path)
where p.slug = verified.slug
  and p.image_path is null
  and exists (
    select 1 from public.contest_candidates cc
    join public.contests c on c.id = cc.contest_id
    join public.elections e on e.id = c.election_id
    where cc.person_id = p.id
      and e.slug = '2026-11-03-general-election'
      and e.election_date = date '2026-11-03'
  );
