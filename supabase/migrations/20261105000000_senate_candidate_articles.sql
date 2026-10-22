-- Verified metadata and per-candidate search outcomes:
-- docs/research/2026-georgia-us-senate-articles.json.
-- Additive import: preserve existing profile details, article metadata, and links.
do $seed$
declare item jsonb; link jsonb; article_uuid uuid; person_uuid uuid;
begin
  -- Production has these candidates; minimal rows also support clean local databases.
  insert into public.people(slug,full_name,kind,visibility)
  select slug,full_name,'candidate','public'
  from jsonb_to_recordset('[{"slug":"jon-ossoff","full_name":"Jon Ossoff","is_write_in":false},{"slug":"mike-collins","full_name":"Mike Collins","is_write_in":false}]'::jsonb)
    as x(slug text,full_name text,is_write_in boolean)
  on conflict (slug) do nothing;
  insert into public.people(slug,full_name,kind,description,visibility)
  select slug,full_name,'other',description,'public'
  from jsonb_to_recordset('[{"slug":"margaret-walker","full_name":"Margaret Walker","description":"Credited author or contributor in coverage published by The Macon Telegraph."},{"slug":"alba-rosa","full_name":"Alba Rosa","description":"Credited author or contributor in coverage published by The Macon Telegraph."},{"slug":"jeremy-chisenhall","full_name":"Jeremy Chisenhall","description":"Credited author or contributor in coverage published by The Macon Telegraph."},{"slug":"myracle-lewis","full_name":"Myracle Lewis","description":"Credited author or contributor in coverage published by The Macon Telegraph."},{"slug":"micah-johnston","full_name":"Micah Johnston","description":"Credited author or contributor in coverage published by The Macon Telegraph and The Macon Melody."},{"slug":"caleb-slinkard","full_name":"Caleb Slinkard","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"evelyn-davidson","full_name":"Evelyn Davidson","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"laura-corley","full_name":"Laura Corley","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"emily-jones","full_name":"Emily Jones","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"rahul-bali","full_name":"Rahul Bali","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"kelda-cubit","full_name":"Kelda Cubit","description":"Credited author or contributor in coverage published by The Macon Melody."},{"slug":"ross-williams","full_name":"Ross Williams","description":"Credited author or contributor in coverage published by The Macon Melody."}]'::jsonb)
    as x(slug text,full_name text,description text)
  on conflict (slug) do nothing;
  for item in select value from jsonb_array_elements('[
  {
    "title": "Op-Ed: Affordable, accessible health care for Middle Georgia",
    "url": "https://www.macon.com/opinion/article245844260.html",
    "published_on": "2020-09-20",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia legislators make 2nd effort to turn Ocmulgee Mounds into a national park, preserve",
    "url": "https://www.macon.com/news/politics-government/article302841764.html",
    "published_on": "2025-03-26",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "margaret-walker",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Issues persist at Dublin Vets hospital that exposed patients to infection, officials say",
    "url": "https://www.macon.com/news/politics-government/article306831526.html",
    "published_on": "2025-05-20",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Subject"
      },
      {
        "slug": "lucinda-warnke",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon-Bibb County to advocate for a railroad stop between Atlanta and Savannah",
    "url": "https://www.macon.com/news/local/article310650140.html",
    "published_on": "2025-07-15",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "alba-rosa",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia senators push for a ‘full’ federal investigation into Bibb County Jail",
    "url": "https://www.macon.com/news/local/article311265190.html",
    "published_on": "2025-07-24",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Subject"
      },
      {
        "slug": "alba-rosa",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ossoff ‘cautiously optimistic’ that Ocmulgee Mounds will become a national park",
    "url": "https://www.macon.com/news/environment/article312215663.html",
    "published_on": "2025-09-23",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Subject"
      },
      {
        "slug": "margaret-walker",
        "role": "Author"
      },
      {
        "slug": "alba-rosa",
        "role": "Contributor"
      }
    ]
  },
  {
    "title": "US senators raise alarm about deaths at a Georgia ICE facility. What to know",
    "url": "https://www.macon.com/news/politics-government/article312226577.html",
    "published_on": "2025-09-23",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Subject"
      },
      {
        "slug": "jeremy-chisenhall",
        "role": "Author"
      }
    ]
  },
  {
    "title": "5 things to know about deaths of 2 ICE detainees in Georgia this year",
    "url": "https://www.macon.com/news/politics-government/article312234351.html",
    "published_on": "2025-09-23",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "jeremy-chisenhall",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Here’s the company that will build an expansion at the Bibb County Jail",
    "url": "https://www.macon.com/news/politics-government/article312241809.html",
    "published_on": "2025-09-24",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "lucinda-warnke",
        "role": "Author"
      }
    ]
  },
  {
    "title": "SNAP cuts threaten free school meals for Macon students. Why advocates are worried",
    "url": "https://www.macon.com/news/local/education/article312326677.html",
    "published_on": "2025-09-30",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Republican candidate defends all-GOP Public Service Commission at Middle GA campaign stop",
    "url": "https://www.macon.com/news/environment/article312614683.html",
    "published_on": "2025-10-23",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "margaret-walker",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democratic governor candidate criticizes Kemp’s response to SNAP pause during Macon visit",
    "url": "https://www.macon.com/news/politics-government/article312709840.html",
    "published_on": "2025-10-30",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "lucinda-warnke",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democrats demand reform after another person dies in Bibb County Jail",
    "url": "https://www.macon.com/news/local/crime/article314558967.html",
    "published_on": "2026-02-03",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "jesse-fraga",
        "role": "Author"
      }
    ]
  },
  {
    "title": "With national attention on Georgia’s U.S. Senate race, Ossoff and Collins meet",
    "url": "https://www.macon.com/news/local/article317253067.html",
    "published_on": "2026-09-19",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Subject"
      },
      {
        "slug": "mike-collins",
        "role": "Subject"
      },
      {
        "slug": "micah-johnston",
        "role": "Author"
      }
    ]
  },
  {
    "title": "I’m just a bill: The legislative process behind creating Georgia’s first national park",
    "url": "https://maconmelody.com/im-just-a-bill-the-legislative-process-behind-creating-georgias-first-national-park/",
    "published_on": "2024-06-25",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-slinkard",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ocmulgee Mounds National Park initiative gains momentum after Senate, House hearings",
    "url": "https://maconmelody.com/ocmulgee-mounds-national-park-initiative-gains-momentum-after-senate-house-hearings/",
    "published_on": "2024-11-20",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "evelyn-davidson",
        "role": "Author"
      },
      {
        "slug": "caleb-slinkard",
        "role": "Author"
      }
    ]
  },
  {
    "title": "See Macon’s Ocmulgee Mounds in a unique way: by lantern light",
    "url": "https://maconmelody.com/see-macons-ocmulgee-mounds-in-a-unique-way-by-lantern-light/",
    "published_on": "2025-03-13",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "micah-johnston",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Short-term vacation rentals will soon be taxed in Bibb County",
    "url": "https://maconmelody.com/short-term-vacation-rentals-will-soon-be-taxed-in-bibb-county/",
    "published_on": "2025-09-03",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon-Bibb County Commission hires companies for jail expansion, new arena",
    "url": "https://maconmelody.com/macon-bibb-county-commission-hires-companies-for-jail-expansion-new-arena/",
    "published_on": "2025-09-24",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon officials optimistic about Ocmulgee Mounds bill despite snag in Senate",
    "url": "https://maconmelody.com/macon-officials-optimistic-about-ocmulgee-mounds-bill-despite-snag-in-senate/",
    "published_on": "2025-12-10",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "casey-choung",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Hurricane Helene relief effort launches for farmers",
    "url": "https://maconmelody.com/hurricane-helene-relief-effort-launches-for-farmers/",
    "published_on": "2026-03-14",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "emily-jones",
        "role": "Author"
      },
      {
        "slug": "rahul-bali",
        "role": "Contributor"
      }
    ]
  },
  {
    "title": "LETTER TO THE EDITOR: Congress must restore protections for dialysis patients",
    "url": "https://maconmelody.com/letter-to-the-editor-congress-must-restore-protections-for-dialysis-patients/",
    "published_on": "2026-06-12",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "kelda-cubit",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democratic voters eclipsed Republicans in Georgia’s election. What happens in Nov.?",
    "url": "https://maconmelody.com/wp-content/uploads/2026/05/052926-mm-eEdition.pdf#page=6",
    "published_on": "2026-05-29",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "ross-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Affordability more than a political buzzword for many Georgia voters",
    "url": "https://maconmelody.com/wp-content/uploads/2026/05/052926-mm-eEdition.pdf#page=2",
    "published_on": "2026-05-29",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "May 19, 2026 Election Results",
    "url": "https://maconmelody.com/051926-election/",
    "published_on": "2026-05-19",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      }
    ]
  }
]'::jsonb)
  loop
    insert into public.articles(title,url,visibility,published_on,fetched_on)
    values(item->>'title',item->>'url','public',(item->>'published_on')::date,date '2026-10-21')
    on conflict (url) do nothing;
    select id into strict article_uuid from public.articles where url=item->>'url';
    update public.articles set published_on=coalesce(published_on,(item->>'published_on')::date),
      fetched_on=greatest(fetched_on,date '2026-10-21') where id=article_uuid;
    for link in select value from jsonb_array_elements(item->'people')
    loop
      select id into strict person_uuid from public.people where slug=link->>'slug';
      insert into public.article_people(article_id,person_id,role)
      values(article_uuid,person_uuid,link->>'role')
      on conflict (article_id,person_id) do nothing;
    end loop;
    insert into public.article_organizations(article_id,organization_id,role)
    select article_uuid,id,'Publisher' from public.organizations where slug=item->>'publisher'
    on conflict (article_id,organization_id) do nothing;
    if not exists(select 1 from public.article_organizations ao join public.organizations o on o.id=ao.organization_id
      where ao.article_id=article_uuid and o.slug=item->>'publisher') then
      raise exception 'Required publisher missing: %',item->>'publisher';
    end if;
  end loop;
end;
$seed$;
