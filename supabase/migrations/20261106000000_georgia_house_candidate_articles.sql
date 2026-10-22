-- Verified coverage for all five Georgia House contests on the site's Bibb ballot.
-- Sources and per-candidate results: docs/research/2026-georgia-house-articles.json.
-- Additive import preserves existing metadata, candidacies, and article associations.
do $seed$
declare item jsonb; link jsonb; article_uuid uuid; person_uuid uuid;
begin
  -- Minimal fallback records keep clean local databases usable; production rows win.
  insert into public.people(slug,full_name,kind,visibility)
  select slug,full_name,'candidate','public'
  from jsonb_to_recordset('[{"slug":"anissa-m-jones","full_name":"Anissa M. Jones","district":"District 143","is_write_in":false},{"slug":"calvin-palmer","full_name":"Calvin Palmer","district":"District 142","is_write_in":false},{"slug":"dale-washburn","full_name":"Dale Washburn","district":"District 144","is_write_in":false},{"slug":"eric-wilson","full_name":"Eric Wilson","district":"District 145","is_write_in":false},{"slug":"floyd-griffin","full_name":"Floyd Griffin","district":"District 149","is_write_in":false},{"slug":"miriam-paris","full_name":"Miriam Paris","district":"District 142","is_write_in":false},{"slug":"randy-peters","full_name":"Randy Peters","district":"District 149","is_write_in":false},{"slug":"tangie-herring","full_name":"Tangie Herring","district":"District 145","is_write_in":false}]'::jsonb)
    as x(slug text,full_name text,district text,is_write_in boolean)
  on conflict (slug) do nothing;
  insert into public.people(slug,full_name,kind,description,visibility)
  select slug,full_name,'other',description,'public'
  from jsonb_to_recordset('[{"slug":"jesse-fraga","full_name":"Jesse Fraga","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."},{"slug":"myracle-lewis","full_name":"Myracle Lewis","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."},{"slug":"alba-rosa","full_name":"Alba Rosa","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."},{"slug":"laura-corley","full_name":"Laura Corley","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."},{"slug":"casey-choung","full_name":"Casey Choung","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."},{"slug":"caleb-slinkard","full_name":"Caleb Slinkard","description":"Credited author in coverage published by The Macon Telegraph or The Macon Melody."}]'::jsonb)
    as x(slug text,full_name text,description text)
  on conflict (slug) do nothing;
  for item in select value from jsonb_array_elements('[
  {
    "title": "Macon has several state House races on the ballot this year. Meet the candidates.",
    "url": "https://www.macon.com/news/politics-government/election/article293751684.html",
    "published_on": "2024-10-11",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "calvin-palmer",
        "role": "Subject"
      },
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "tangie-herring",
        "role": "Subject"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "jesse-fraga",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Five state House races on the ballot in Macon on Election Day. Here’s who won each.",
    "url": "https://www.macon.com/news/politics-government/election/article294650634.html",
    "published_on": "2024-11-06",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "tangie-herring",
        "role": "Subject"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "jesse-fraga",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Time for real leadership: Tangie Herring’s vision for a stronger, safer Middle Georgia | Opinion.",
    "url": "https://www.macon.com/opinion/article294473634.html",
    "published_on": "2024-10-24",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Monroe County school officials wanted big pay hike. Why legislators disapproved.",
    "url": "https://www.macon.com/news/local/education/article304360976.html",
    "published_on": "2025-04-16",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "GA cellphone ban is now law. What it means for Middle Georgia schools",
    "url": "https://www.macon.com/news/local/education/article306465381.html",
    "published_on": "2025-05-15",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "New law bans cellphones, boosts literacy in GA schools. Local lawmakers weigh in",
    "url": "https://www.macon.com/news/local/education/article315643329.html",
    "published_on": "2026-05-12",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia’s school voucher list is out. But a Middle GA lawmaker wants to repeal the program",
    "url": "https://www.macon.com/news/politics-government/article300598289.html",
    "published_on": "2025-02-20",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon ranks high in number of school voucher program applicants, recipients",
    "url": "https://www.macon.com/news/local/education/article311309180.html",
    "published_on": "2025-07-24",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon swim instructor shares water safety tips amid spike in drownings",
    "url": "https://www.macon.com/news/local/article316416242.html",
    "published_on": "2026-07-10",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "alba-rosa",
        "role": "Author"
      }
    ]
  },
  {
    "title": "$22M campus replaces decades-old school facility in Monroe County. See inside.",
    "url": "https://www.macon.com/news/local/education/article311675658.html",
    "published_on": "2025-08-15",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "myracle-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Bibb legislators draw challengers in May 19 primary election",
    "url": "https://maconmelody.com/bibb-legislators-draw-challengers-in-may-19-primary-election/",
    "published_on": "2026-04-23",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "calvin-palmer",
        "role": "Subject"
      },
      {
        "slug": "randy-peters",
        "role": "Subject"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Charter changes, taxes and more: Bibb lawmakers prep for Gold Dome business",
    "url": "https://maconmelody.com/charter-changes-taxes-and-more-bibb-lawmakers-prep-for-gold-dome-business/",
    "published_on": "2026-01-09",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "tangie-herring",
        "role": "Subject"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Speed camera ban bill zooms through state house",
    "url": "https://maconmelody.com/speed-camera-ban-bill-zooms-through-state-house/",
    "published_on": "2025-03-10",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon lawmakers cap session with last-minute deals",
    "url": "https://maconmelody.com/macon-lawmakers-cap-session-with-last-minute-deals/",
    "published_on": "2026-04-09",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "casey-choung",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Here’s what Macon legislators are pushing under the Gold Dome this session",
    "url": "https://maconmelody.com/bibb-county-legislative-delegation-introduces-slew-of-bills-under-gold-dome-in-2025/",
    "published_on": "2025-02-18",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "tangie-herring",
        "role": "Subject"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Subject"
      },
      {
        "slug": "floyd-griffin",
        "role": "Subject"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon Democrat Herring joins Republicans supporting bill that targets trans students",
    "url": "https://maconmelody.com/macon-democrat-herring-joins-republicans-supporting-bill-that-targets-trans-students/",
    "published_on": "2025-03-05",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Subject"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Race for vacant Middle Georgia senate seat ramps up",
    "url": "https://maconmelody.com/race-for-vacant-middle-georgia-senate-seat-ramps-up/",
    "published_on": "2026-01-15",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "eric-wilson",
        "role": "Subject"
      },
      {
        "slug": "casey-choung",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democrats outvote Republicans as Macon-Bibb voters pick school board, water authority seats",
    "url": "https://maconmelody.com/democrats-outvote-republicans-as-macon-bibb-voters-pick-school-board-water-authority-seats/",
    "published_on": "2026-05-20",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "casey-choung",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Will the Macon Mayor get a third term? Legislators to make the final call",
    "url": "https://maconmelody.com/macon-bibb-commissioners-ask-legislators-for-third-term-for-mayor/",
    "published_on": "2025-01-28",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Bibb County reports 64% voter turnout as incumbent candidates dominate local, state house elections",
    "url": "https://maconmelody.com/bibb-county-reports-64-voter-turnout-as-incumbent-candidates-dominate-local-state-house-elections/",
    "published_on": "2024-11-06",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-slinkard",
        "role": "Author"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon-Bibb County releases voting results",
    "url": "https://maconmelody.com/macon-bibb-county-releases-some-early-voting-results/",
    "published_on": "2024-11-05",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-slinkard",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Map redraw could cost Black voters in Bibb, legislators warn",
    "url": "https://maconmelody.com/map-redraw-could-cost-black-voters-in-bibb-legislators-warn/",
    "published_on": "2026-06-16",
    "publisher": "the-macon-melody",
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Subject"
      },
      {
        "slug": "miriam-paris",
        "role": "Subject"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
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
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "randy-peters",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Local Macon event seeks to connect people with candidates",
    "url": "https://www.macon.com/news/local/article317242264.html",
    "published_on": "2026-09-15",
    "publisher": "the-macon-telegraph",
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "casey-choung",
        "role": "Author"
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
      values(article_uuid,person_uuid,link->>'role') on conflict(article_id,person_id) do nothing;
    end loop;
    insert into public.article_organizations(article_id,organization_id,role)
    select article_uuid,id,'Publisher' from public.organizations where slug=item->>'publisher'
    on conflict(article_id,organization_id) do nothing;
    if not exists(select 1 from public.article_organizations ao join public.organizations o on o.id=ao.organization_id
      where ao.article_id=article_uuid and o.slug=item->>'publisher') then
      raise exception 'Required publisher missing: %',item->>'publisher';
    end if;
  end loop;
end;
$seed$;
