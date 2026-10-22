-- Verified follow-up coverage of nine previously unmatched November candidates.
-- Sources, publisher quality and exclusions:
-- docs/research/2026-remaining-candidates-georgia-news.json
do $seed$
declare item jsonb; link jsonb; article_uuid uuid; person_uuid uuid; publisher_uuid uuid;
begin
  insert into public.organizations(slug,name,description,website_url)
  select slug,name,description,website_url from jsonb_to_recordset('[
  {
    "slug": "the-wiregrass-farmer",
    "name": "The Wiregrass Farmer",
    "website_url": "https://www.thewiregrassfarmer.com/",
    "description": "Local newspaper serving Ashburn and Turner County, Georgia. Established in 1902; listed by the Georgia Press Association."
  },
  {
    "slug": "wtoc",
    "name": "WTOC",
    "website_url": "https://www.wtoc.com/",
    "description": "Savannah, Georgia television newsroom serving the Coastal Empire and Lowcountry."
  }
]'::jsonb)
    as x(slug text,name text,description text,website_url text) on conflict(slug) do nothing;
  insert into public.people(slug,full_name,kind,description,visibility)
    values('madalyn-bierster','Madalyn Bierster','other','Credited reporter in WTOC candidate coverage.','public')
    on conflict(slug) do nothing;
  for item in select value from jsonb_array_elements('[
  {
    "title": "Write-in candidates on the ballot this year",
    "url": "https://www.thewiregrassfarmer.com/2026/09/22/write-in-candidates-on-the-ballot-this-year/",
    "published_on": "2026-09-22",
    "fetched_on": "2026-10-21",
    "publisher": "the-wiregrass-farmer",
    "people": [
      {
        "slug": "andrew-pacetti",
        "role": "Mentioned"
      },
      {
        "slug": "cassandra-easton",
        "role": "Mentioned"
      },
      {
        "slug": "christina-clement",
        "role": "Mentioned"
      },
      {
        "slug": "david-c-byrne",
        "role": "Mentioned"
      },
      {
        "slug": "david-leon-moreland",
        "role": "Mentioned"
      },
      {
        "slug": "deb-broughton-davis",
        "role": "Mentioned"
      },
      {
        "slug": "jacqueline-angela-dacosta",
        "role": "Mentioned"
      },
      {
        "slug": "leland-j-olinger-iii",
        "role": "Mentioned"
      },
      {
        "slug": "milton-j-lofton",
        "role": "Mentioned"
      },
      {
        "slug": "elbert-arthur-bartell",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Georgia’s Senate race heats up as four candidates pitch to Savannah voters",
    "url": "https://www.wtoc.com/2026/04/01/georgias-senate-race-heats-up-four-candidates-pitch-savannah-voters/",
    "published_on": "2026-04-01",
    "fetched_on": "2026-10-21",
    "publisher": "wtoc",
    "people": [
      {
        "slug": "christina-clement",
        "role": "Subject"
      },
      {
        "slug": "mike-collins",
        "role": "Subject"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "madalyn-bierster",
        "role": "Author"
      }
    ]
  }
]'::jsonb)
  loop
    select id into strict publisher_uuid from public.organizations where slug=item->>'publisher';
    insert into public.articles(title,url,visibility,published_on,fetched_on)
      values(item->>'title',item->>'url','public',(item->>'published_on')::date,(item->>'fetched_on')::date)
      on conflict(url) do nothing;
    select id into strict article_uuid from public.articles where url=item->>'url';
    update public.articles set published_on=coalesce(published_on,(item->>'published_on')::date),
      fetched_on=greatest(fetched_on,(item->>'fetched_on')::date) where id=article_uuid;
    for link in select value from jsonb_array_elements(item->'people')
    loop
      select id into strict person_uuid from public.people where slug=link->>'slug';
      insert into public.article_people(article_id,person_id,role)
        values(article_uuid,person_uuid,link->>'role') on conflict(article_id,person_id) do nothing;
    end loop;
    insert into public.article_organizations(article_id,organization_id,role)
      values(article_uuid,publisher_uuid,'Publisher') on conflict(article_id,organization_id) do nothing;
  end loop;
end;
$seed$;
