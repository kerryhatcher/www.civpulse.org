-- Verified November candidate article metadata across seven additional outlets.
-- Evidence and per-candidate search coverage:
-- docs/research/2026-november-expanded-outlet-articles.json
-- Additive only: existing records, visibility, metadata and relationships win.
do $seed$
declare item jsonb; link jsonb; article_uuid uuid; person_uuid uuid; organization_uuid uuid;
begin
  insert into public.organizations(slug,name,description,website_url)
  select slug,name,description,website_url
  from jsonb_to_recordset('[
  {
    "slug": "13wmaz",
    "name": "13WMAZ",
    "website_url": "https://www.13wmaz.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "41nbc",
    "name": "41NBC News",
    "website_url": "https://www.41nbc.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "the-atlanta-journal-constitution",
    "name": "The Atlanta Journal-Constitution",
    "website_url": "https://www.ajc.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "georgia-public-broadcasting",
    "name": "Georgia Public Broadcasting",
    "website_url": "https://www.gpb.org/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "npr",
    "name": "NPR",
    "website_url": "https://www.npr.org/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "wgxa",
    "name": "WGXA News",
    "website_url": "https://wgxa.tv/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "the-macon-newsroom",
    "name": "The Macon Newsroom",
    "website_url": "https://macon-newsroom.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "healthbeat",
    "name": "Healthbeat",
    "website_url": "https://www.healthbeat.org/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "georgia-recorder",
    "name": "Georgia Recorder",
    "website_url": "https://georgiarecorder.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "capitol-beat-news-service",
    "name": "Capitol Beat News Service",
    "website_url": "https://capitol-beat.org/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "associated-press",
    "name": "Associated Press",
    "website_url": "https://apnews.com/",
    "description": "News publisher or credited source in November candidate article research."
  },
  {
    "slug": "the-national-news-desk",
    "name": "The National News Desk",
    "website_url": "https://thenationaldesk.com/",
    "description": "News publisher or credited source in November candidate article research."
  }
]'::jsonb) as x(slug text,name text,description text,website_url text)
  on conflict(slug) do nothing;
  insert into public.people(slug,full_name,kind,visibility)
  select slug,full_name,'candidate','public'
  from jsonb_to_recordset('[
  {
    "slug": "andrew-pacetti",
    "full_name": "Andrew Pacetti"
  },
  {
    "slug": "anissa-m-jones",
    "full_name": "Anissa M. Jones"
  },
  {
    "slug": "austin-scott",
    "full_name": "Austin Scott"
  },
  {
    "slug": "barbara-rivera-holmes",
    "full_name": "Bárbara Rivera Holmes"
  },
  {
    "slug": "brian-strickland",
    "full_name": "Brian Strickland"
  },
  {
    "slug": "calvin-palmer",
    "full_name": "Calvin Palmer"
  },
  {
    "slug": "cassandra-easton",
    "full_name": "Cassandra Easton"
  },
  {
    "slug": "christina-clement",
    "full_name": "Christina Clement"
  },
  {
    "slug": "dale-washburn",
    "full_name": "Dale Washburn"
  },
  {
    "slug": "david-c-byrne",
    "full_name": "David C. Byrne"
  },
  {
    "slug": "david-e-lucas",
    "full_name": "David E. Lucas"
  },
  {
    "slug": "david-leon-moreland",
    "full_name": "David Leon Moreland"
  },
  {
    "slug": "deb-broughton-davis",
    "full_name": "Deb Broughton Davis"
  },
  {
    "slug": "elbert-arthur-bartell",
    "full_name": "Elbert Arthur Bartell"
  },
  {
    "slug": "eric-wilson",
    "full_name": "Eric Wilson"
  },
  {
    "slug": "fitz-johnson",
    "full_name": "Fitz Johnson"
  },
  {
    "slug": "floyd-griffin",
    "full_name": "Floyd Griffin"
  },
  {
    "slug": "greg-dolezal",
    "full_name": "Greg Dolezal"
  },
  {
    "slug": "jacqueline-angela-dacosta",
    "full_name": "Jacqueline Angela DaCosta"
  },
  {
    "slug": "john-king",
    "full_name": "John King"
  },
  {
    "slug": "jon-ossoff",
    "full_name": "Jon Ossoff"
  },
  {
    "slug": "josh-mclaurin",
    "full_name": "Josh McLaurin"
  },
  {
    "slug": "josh-tolbert",
    "full_name": "Josh Tolbert"
  },
  {
    "slug": "justin-laster",
    "full_name": "Justin Laster"
  },
  {
    "slug": "katherine-e-juhan-arnold",
    "full_name": "Katherine E. Juhan-Arnold"
  },
  {
    "slug": "keisha-lance-bottoms",
    "full_name": "Keisha Lance Bottoms"
  },
  {
    "slug": "keisha-sean-waites",
    "full_name": "Keisha Sean Waites"
  },
  {
    "slug": "kelly-esti",
    "full_name": "Kelly Esti"
  },
  {
    "slug": "leland-j-olinger-iii",
    "full_name": "Leland J. Olinger, III"
  },
  {
    "slug": "lindsay-d-holliday",
    "full_name": "Lindsay D. Holliday"
  },
  {
    "slug": "lydia-powell",
    "full_name": "Lydia Powell"
  },
  {
    "slug": "matt-day",
    "full_name": "Matt Day"
  },
  {
    "slug": "mike-collins",
    "full_name": "Mike Collins"
  },
  {
    "slug": "milton-j-lofton",
    "full_name": "Milton J. Lofton"
  },
  {
    "slug": "miriam-paris",
    "full_name": "Miriam Paris"
  },
  {
    "slug": "nikki-porcher",
    "full_name": "Nikki Porcher"
  },
  {
    "slug": "penny-brown-reynolds",
    "full_name": "Penny Brown Reynolds"
  },
  {
    "slug": "peter-hubbard",
    "full_name": "Peter Hubbard"
  },
  {
    "slug": "randy-peters",
    "full_name": "Randy Peters"
  },
  {
    "slug": "richard-woods",
    "full_name": "Richard Woods"
  },
  {
    "slug": "rick-a-williams",
    "full_name": "Rick A. Williams"
  },
  {
    "slug": "rick-jackson",
    "full_name": "Rick Jackson"
  },
  {
    "slug": "sanford-bishop",
    "full_name": "Sanford Bishop"
  },
  {
    "slug": "shelia-edwards",
    "full_name": "Shelia Edwards"
  },
  {
    "slug": "steven-mcneel",
    "full_name": "Steven McNeel"
  },
  {
    "slug": "tangie-herring",
    "full_name": "Tangie Herring"
  },
  {
    "slug": "tanya-miller",
    "full_name": "Tanya Miller"
  },
  {
    "slug": "tim-fleming",
    "full_name": "Tim Fleming"
  },
  {
    "slug": "tracy-wheeler",
    "full_name": "Tracy Wheeler"
  },
  {
    "slug": "tyler-harper",
    "full_name": "Tyler Harper"
  }
]'::jsonb) as x(slug text,full_name text)
  on conflict(slug) do nothing;
  insert into public.people(slug,full_name,kind,description,visibility)
  select slug,full_name,'other','Credited author in candidate news coverage.','public'
  from jsonb_to_recordset('[
  {
    "slug": "monica-diaz-meek",
    "full_name": "Monica Diaz-Meek"
  },
  {
    "slug": "tyrik-wynn",
    "full_name": "Tyrik Wynn"
  },
  {
    "slug": "rebecca-grapevine",
    "full_name": "Rebecca Grapevine"
  },
  {
    "slug": "grant-blankenship",
    "full_name": "Grant Blankenship"
  },
  {
    "slug": "amy-wenk",
    "full_name": "Amy Wenk"
  },
  {
    "slug": "shannon-mccaffrey",
    "full_name": "Shannon McCaffrey"
  },
  {
    "slug": "natalie-mendenhall",
    "full_name": "Natalie Mendenhall"
  },
  {
    "slug": "david-wickert",
    "full_name": "David Wickert"
  },
  {
    "slug": "taylor-gilchrist",
    "full_name": "Taylor Gilchrist"
  },
  {
    "slug": "ross-williams",
    "full_name": "Ross Williams"
  },
  {
    "slug": "greg-bluestein",
    "full_name": "Greg Bluestein"
  },
  {
    "slug": "tucker-sargent",
    "full_name": "Tucker Sargent"
  },
  {
    "slug": "ty-tagami",
    "full_name": "Ty Tagami"
  },
  {
    "slug": "sarah-kallis",
    "full_name": "Sarah Kallis"
  },
  {
    "slug": "drew-kann",
    "full_name": "Drew Kann"
  },
  {
    "slug": "kristi-swartz",
    "full_name": "Kristi Swartz"
  },
  {
    "slug": "riley-bunch",
    "full_name": "Riley Bunch"
  },
  {
    "slug": "caleb-groves",
    "full_name": "Caleb Groves"
  },
  {
    "slug": "cassidy-alexander",
    "full_name": "Cassidy Alexander"
  },
  {
    "slug": "sophia-eppley",
    "full_name": "Sophia Eppley"
  },
  {
    "slug": "patricia-murphy",
    "full_name": "Patricia Murphy"
  },
  {
    "slug": "mark-niesse",
    "full_name": "Mark Niesse"
  },
  {
    "slug": "alander-rocha",
    "full_name": "Alander Rocha"
  },
  {
    "slug": "gena-tripp",
    "full_name": "Gena Tripp"
  },
  {
    "slug": "tia-mitchell",
    "full_name": "Tia Mitchell"
  },
  {
    "slug": "adam-beam",
    "full_name": "Adam Beam"
  },
  {
    "slug": "ariel-schiller",
    "full_name": "Ariel Schiller"
  },
  {
    "slug": "martha-dalton",
    "full_name": "Martha Dalton"
  },
  {
    "slug": "donna-lowry",
    "full_name": "Donna Lowry"
  },
  {
    "slug": "tristan-smith",
    "full_name": "Tristan Smith"
  },
  {
    "slug": "chris-joyner",
    "full_name": "Chris Joyner"
  },
  {
    "slug": "sofi-gratas",
    "full_name": "Sofi Gratas"
  },
  {
    "slug": "tamar-hallerman",
    "full_name": "Tamar Hallerman"
  },
  {
    "slug": "lucinda-warnke",
    "full_name": "Lucinda Warnke"
  },
  {
    "slug": "katharine-tucker",
    "full_name": "Katharine Tucker"
  },
  {
    "slug": "maya-t-prabhu",
    "full_name": "Maya T. Prabhu"
  },
  {
    "slug": "godfrey-hall",
    "full_name": "Godfrey Hall"
  },
  {
    "slug": "michelle-baruchman",
    "full_name": "Michelle Baruchman"
  },
  {
    "slug": "austin-slocumb",
    "full_name": "Austin Slocumb"
  },
  {
    "slug": "bre-anna-sheffield",
    "full_name": "Bre''Anna Sheffield"
  },
  {
    "slug": "liz-fabian",
    "full_name": "Liz Fabian"
  },
  {
    "slug": "laura-corley",
    "full_name": "Laura Corley"
  },
  {
    "slug": "joshua-harrison-williams",
    "full_name": "Joshua Harrison-Williams"
  },
  {
    "slug": "addison-white",
    "full_name": "Addison White"
  },
  {
    "slug": "leah-kincaid",
    "full_name": "Leah Kincaid"
  },
  {
    "slug": "brianna-cook",
    "full_name": "Brianna Cook"
  },
  {
    "slug": "stanley-dunlap",
    "full_name": "Stanley Dunlap"
  },
  {
    "slug": "gloria-ruth-finney",
    "full_name": "Gloria Ruth Finney"
  },
  {
    "slug": "gabriel-kopp",
    "full_name": "Gabriel Kopp"
  },
  {
    "slug": "jeff-amy",
    "full_name": "Jeff Amy"
  },
  {
    "slug": "ray-lewis",
    "full_name": "Ray Lewis"
  },
  {
    "slug": "jordan-stevenson",
    "full_name": "Jordan Stevenson"
  },
  {
    "slug": "ryan-marando",
    "full_name": "Ryan Marando"
  },
  {
    "slug": "ereina-plunkett",
    "full_name": "Ereina Plunkett"
  },
  {
    "slug": "brandon-mcgouirk",
    "full_name": "Brandon McGouirk"
  },
  {
    "slug": "aaleah-mcconnell",
    "full_name": "Aaleah McConnell"
  },
  {
    "slug": "bill-barrow",
    "full_name": "Bill Barrow"
  },
  {
    "slug": "eliza-moore",
    "full_name": "Eliza Moore"
  },
  {
    "slug": "lars-lonnroth",
    "full_name": "Lars Lonnroth"
  },
  {
    "slug": "michelle-l-price",
    "full_name": "Michelle L. Price"
  },
  {
    "slug": "will-weissert",
    "full_name": "Will Weissert"
  },
  {
    "slug": "aaron-waisler",
    "full_name": "Aaron Waisler"
  },
  {
    "slug": "sam-gringlas",
    "full_name": "Sam Gringlas"
  }
]'::jsonb) as x(slug text,full_name text)
  on conflict(slug) do nothing;
  for item in select value from jsonb_array_elements('[
  {
    "title": "Candidates qualify for Georgia House races affecting Middle Georgia voters",
    "url": "https://www.41nbc.com/georgia-house-races-middle-georgia-2026-primary/",
    "published_on": "2026-03-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
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
    "title": "Decision 2024: Meet Anissa Jones, candidate for Georgia House District 143",
    "url": "https://www.41nbc.com/decision-2024-meet-anissa-jones-candidate-for-georgia-house-district-143/",
    "published_on": "2024-10-23",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State Rep. Anissa Jones (D) highlights economic development, affordability ahead of legislative session",
    "url": "https://www.41nbc.com/state-rep-anissa-jones-d-highlights-economic-development-affordability-ahead-of-legislative-session/",
    "published_on": "2026-01-07",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "From operating room to the Gold Dome: How Georgia’s medical lawmakers shape policy",
    "url": "https://www.gpb.org/news/2026/03/24/operating-room-the-gold-dome-how-georgias-medical-lawmakers-shape-policy",
    "published_on": "2026-03-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      },
      {
        "slug": "healthbeat",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "rebecca-grapevine",
        "role": "Author"
      }
    ]
  },
  {
    "title": "U.S. House District 8: Austin Scott to face U.S. Navy veteran in November",
    "url": "https://www.ajc.com/politics/2026/04/us-house-district-8-veteran-georgia-lawmaker-has-no-primary-challenger/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "kelly-esti",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Macon Non-Profit Shifting Lending To Women And Entrepreneurs Of Color",
    "url": "https://www.gpb.org/news/2021/06/24/macon-non-profit-shifting-lending-women-and-entrepreneurs-of-color",
    "published_on": "2021-06-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "How Georgia is helping workers get ahead and businesses grow in the AI era",
    "url": "https://www.ajc.com/opinion/2026/09/labor-day-georgia-workforce-wages/",
    "published_on": "2026-09-07",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "barbara-rivera-holmes",
        "role": "Author and Subject"
      }
    ]
  },
  {
    "title": "Georgia primary ballot set: Here’s who is running for governor, Senate, and other Middle Georgia races",
    "url": "https://www.41nbc.com/georgia-primary-candidates-2026-governor-senate-middle-georgia/",
    "published_on": "2026-03-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "barbara-rivera-holmes",
        "role": "Mentioned"
      },
      {
        "slug": "brian-strickland",
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
        "slug": "david-e-lucas",
        "role": "Mentioned"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "katherine-e-juhan-arnold",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "kelly-esti",
        "role": "Mentioned"
      },
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "randy-peters",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "tracy-wheeler",
        "role": "Mentioned"
      },
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Nonprofit leader challenges Republican incumbent for Georgia labor commissioner",
    "url": "https://www.ajc.com/business/2026/04/race-for-georgia-labor-commissioner-features-five-way-democratic-primary/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "barbara-rivera-holmes",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "amy-wenk",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia election: Here’s who will be on the ballot in November",
    "url": "https://www.ajc.com/politics/2026/06/georgia-election-heres-who-will-be-on-the-ballot-in-november/",
    "published_on": "2026-06-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "shannon-mccaffrey",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Brian Strickland touts his work ethic in his run for Georgia attorney general",
    "url": "https://www.ajc.com/politics/2025/06/brian-strickland-touts-his-work-ethic-in-his-run-for-georgia-attorney-general/",
    "published_on": "2025-06-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "natalie-mendenhall",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Two legislators to face off in November in race for attorney general",
    "url": "https://www.ajc.com/politics/2026/04/four-vie-to-become-georgias-next-attorney-general/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "david-wickert",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia’s next attorney general must defend families, safety and open records",
    "url": "https://www.ajc.com/opinion/2026/09/georgia-attorney-general-election-republican-brian-strickland/",
    "published_on": "2026-09-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Author and Subject"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Tight race for Georgia attorney general becomes a debate over experience",
    "url": "https://www.ajc.com/politics/2026/10/georgia-attorney-general-experience-debate/",
    "published_on": "2026-10-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "david-wickert",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Calvin Dennis Palmer, candidate for Georgia House District 142",
    "url": "https://www.41nbc.com/decision-2024-meet-calvin-dennis-palmer-candidate-for-georgia-house-district-142/",
    "published_on": "2024-10-30",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
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
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State Rep. Dale Washburn vows to continue fight against school zone speed cameras",
    "url": "https://www.41nbc.com/state-rep-dale-washburn-vows-to-continue-fight-against-school-zone-speeding-cameras/",
    "published_on": "2025-04-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "taylor-gilchrist",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Dale Washburn, candidate for Georgia House District 144",
    "url": "https://www.41nbc.com/decision-2024-meet-dale-washburn-candidate-for-georgia-house-district-144/",
    "published_on": "2024-11-01",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Six candidates sign up to run for Middle Georgia Senate seat after prominent Republican steps down",
    "url": "https://www.gpb.org/news/2025/12/23/six-candidates-sign-run-for-middle-georgia-senate-seat-after-prominent-republican",
    "published_on": "2025-12-23",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "ross-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democrats see a path to flipping the Georgia House with these 8 races",
    "url": "https://www.ajc.com/politics/2026/08/democrats-see-a-path-to-flipping-the-georgia-house-with-these-8-races/",
    "published_on": "2026-08-11",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "greg-bluestein",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Forsyth Mayor Eric Wilson announces run for Georgia Senate District 18",
    "url": "https://www.41nbc.com/forsyth-mayor-eric-wilson-georgia-senate-district-18/",
    "published_on": "2025-07-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "tucker-sargent",
        "role": "Author"
      }
    ]
  },
  {
    "title": "May 19th, 2026 Election Results",
    "url": "https://www.41nbc.com/may-19th-2026-election-results/",
    "published_on": "2026-05-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "katherine-e-juhan-arnold",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "kelly-esti",
        "role": "Mentioned"
      },
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "tracy-wheeler",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Statewide candidates to debate at Atlanta Press Club, minus the top of the GOP ticket",
    "url": "https://www.gpb.org/news/2026/09/22/statewide-candidates-debate-at-atlanta-press-club-minus-the-top-of-the-gop-ticket",
    "published_on": "2026-09-22",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      },
      {
        "slug": "capitol-beat-news-service",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "ty-tagami",
        "role": "Author"
      }
    ]
  },
  {
    "title": "PSC candidates aim to energize voters ahead of early voting",
    "url": "https://www.gpb.org/news/2025/10/08/psc-candidates-aim-energize-voters-ahead-of-early-voting",
    "published_on": "2025-10-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ga. Public Service Commission protects consumers from costly liberal mandates",
    "url": "https://www.ajc.com/opinion/2025/09/ga-public-service-commission-protects-consumers-from-costly-liberal-mandates/",
    "published_on": "2025-09-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Author and Subject"
      }
    ]
  },
  {
    "title": "PSC races that could affect your Georgia Power bill are set for November",
    "url": "https://www.ajc.com/politics/2026/04/care-about-your-georgia-power-bill-these-psc-races-could-have-a-big-impact/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "drew-kann",
        "role": "Author"
      },
      {
        "slug": "kristi-swartz",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Floyd Griffin, candidate for Georgia House District 149",
    "url": "https://www.41nbc.com/decision-2024-meet-floyd-griffin-candidate-for-georgia-house-district-149/",
    "published_on": "2024-10-25",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Greg Dolezal highlights legislative record in bid for Georgia Lt. Governor",
    "url": "https://www.41nbc.com/greg-dolezal-highlights-legislative-record-in-bid-for-georgia-lt-governor/",
    "published_on": "2026-04-27",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "2 state senators battle for Georgia lieutenant governor",
    "url": "https://www.ajc.com/politics/2026/04/10-compete-to-become-georgias-next-lieutenant-governor/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "david-wickert",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia lieutenant governor candidates say their race carries weight",
    "url": "https://www.gpb.org/news/2026/08/20/georgia-lieutenant-governor-candidates-say-their-race-carries-weight",
    "published_on": "2026-08-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia has a powerful lieutenant governor. Will it stay that way?",
    "url": "https://www.ajc.com/politics/2026/08/georgia-has-a-powerful-lieutenant-governor-will-it-stay-that-way/",
    "published_on": "2026-08-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "riley-bunch",
        "role": "Author"
      }
    ]
  },
  {
    "title": "King suspends Senate campaign, will seek re-election as Georgia insurance commissioner",
    "url": "https://www.41nbc.com/john-king-ends-senate-campaign-georgia-insurance-commissioner/",
    "published_on": "2025-07-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Takeaways from downballot debates: Six Flags, unemployment and ‘explosive diarrhea.’",
    "url": "https://www.ajc.com/politics/2026/10/georgia-down-ballot-debates-takeaways/",
    "published_on": "2026-10-14",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "barbara-rivera-holmes",
        "role": "Mentioned"
      },
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "katherine-e-juhan-arnold",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-groves",
        "role": "Author"
      },
      {
        "slug": "cassidy-alexander",
        "role": "Author"
      },
      {
        "slug": "sophia-eppley",
        "role": "Author"
      },
      {
        "slug": "amy-wenk",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Former Democratic state lawmaker challenges GOP insurance commissioner",
    "url": "https://www.ajc.com/news/2026/04/democrats-vying-for-state-insurance-commissioner-focus-on-affordability/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "riley-bunch",
        "role": "Author"
      }
    ]
  },
  {
    "title": "John King on bowing out of Senate run: ‘I won’t tarnish my reputation’",
    "url": "https://www.ajc.com/politics/2025/09/john-king-on-bowing-out-of-senate-run-i-wont-tarnish-my-reputation/",
    "published_on": "2025-09-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "greg-bluestein",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Jon Ossoff is writing a new playbook for Democrats in the South",
    "url": "https://www.ajc.com/politics/2026/09/opinion-jon-ossoff-is-writing-a-new-playbook-for-democrats-in-the-south/",
    "published_on": "2026-09-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "patricia-murphy",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Jon Ossoff: Where the Georgia U.S. Senate candidate stands on the issues",
    "url": "https://www.ajc.com/politics/2026/04/jon-ossoff-a-look-at-the-ajcs-coverage/",
    "published_on": "2026-04-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "mark-niesse",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ossoff, Bottoms eye momentum behind historic early voting turnout",
    "url": "https://www.ajc.com/politics/2026/10/ossoff-bottoms-cobb-county-rally/",
    "published_on": "2026-10-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "riley-bunch",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Jon Ossoff swamps Mike Collins in fundraising, reports $42M on hand",
    "url": "https://www.ajc.com/politics/2026/07/jon-ossoff-enters-fall-campaign-with-42m-on-hand/",
    "published_on": "2026-07-15",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "greg-bluestein",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mike Collins vs. Jon Ossoff: The key issues dividing Georgia’s Senate race",
    "url": "https://www.ajc.com/politics/2026/09/mike-collins-vs-jon-ossoff-key-issues-dividing-georgias-senate-race/",
    "published_on": "2026-09-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "greg-bluestein",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Candidate forum puts early education policy center stage",
    "url": "https://www.gpb.org/news/2026/09/29/candidate-forum-puts-early-education-policy-center-stage",
    "published_on": "2026-09-30",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "In Public Service Commission race, candidates converge on ''affordability''",
    "url": "https://www.gpb.org/news/2026/04/29/in-public-service-commission-race-candidates-converge-on-affordability",
    "published_on": "2026-04-29",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia utility commission races test party loyalty after recent power bill hikes",
    "url": "https://www.gpb.org/news/2026/06/08/georgia-utility-commission-races-test-party-loyalty-after-recent-power-bill-hikes",
    "published_on": "2026-06-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "alander-rocha",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Middle Georgia Matters forum gives voters chance to hear from candidates",
    "url": "https://www.41nbc.com/middle-georgia-matters-forum-gives-voters-chance-to-hear-from-candidates/",
    "published_on": "2026-09-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "gena-tripp",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Gwinnett Democrat to challenge Harper as agriculture commissioner",
    "url": "https://www.ajc.com/politics/2026/04/two-democrats-running-to-challenge-harper-as-agriculture-commissioner/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "david-wickert",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Former President Barack Obama to join Sen. Jon Ossoff and Keisha Lance Bottoms at a rally in Georgia",
    "url": "https://www.41nbc.com/former-president-barack-obama-to-join-sen-jon-ossoff-and-keisha-lance-bottoms-at-a-rally-in-georgia/",
    "published_on": "2026-10-19",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "How Keisha Lance Bottoms is making inroads in rural Georgia",
    "url": "https://www.ajc.com/politics/2026/07/how-keisha-lance-bottoms-is-making-inroads-in-rural-georgia/",
    "published_on": "2026-07-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sophia-eppley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Keisha Lance Bottoms: Where the candidate for Georgia governor stands on the issues",
    "url": "https://www.ajc.com/politics/2026/04/keisha-lance-bottoms-a-look-at-the-ajcs-coverage/",
    "published_on": "2026-04-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mark-niesse",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Keisha Lance Bottoms accepts Middle Georgia debate; Rick Jackson has declined",
    "url": "https://www.41nbc.com/keisha-lance-bottoms-accepts-middle-georgia-debate-rick-jacksons-participation-still-pending/",
    "published_on": "2026-08-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Keisha Lance Bottoms to hold town hall in Macon as she campaigns for Georgia governor",
    "url": "https://www.41nbc.com/keisha-lance-bottoms-to-hold-town-hall-in-macon-as-she-campaigns-for-georgia-governor/",
    "published_on": "2026-08-28",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Keisha Lance Bottoms speaks for herself after Tuesday’s debate",
    "url": "https://www.ajc.com/politics/2026/10/keisha-lance-bottoms-speaks-for-herself-after-tuesdays-debate/",
    "published_on": "2026-10-07",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "greg-bluestein",
        "role": "Author"
      },
      {
        "slug": "tia-mitchell",
        "role": "Author"
      },
      {
        "slug": "patricia-murphy",
        "role": "Author"
      },
      {
        "slug": "adam-beam",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Insurance commissioner candidates make their pitch to Democrats in runoff",
    "url": "https://www.ajc.com/politics/2026/06/insurance-commissioner-candidates-make-their-pitch-to-democrats-in-runoff/",
    "published_on": "2026-06-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "riley-bunch",
        "role": "Author"
      }
    ]
  },
  {
    "title": "41NBC’s Tyrik Wynn and Fiona King to moderate Middle Georgia Decides 2026 Candidate Forum",
    "url": "https://www.41nbc.com/41nbcs-tyrik-wynn-and-fiona-king-to-moderate-middle-georgia-decides-2026-candidate-forum/",
    "published_on": "2026-09-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "kelly-esti",
        "role": "Mentioned"
      },
      {
        "slug": "matt-day",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Rick Williams, candidate for Georgia Senate District 25, Republican Primary",
    "url": "https://www.41nbc.com/decision-2024-meet-rick-williams-candidate-for-georgia-senate-district-25-republican-primary/",
    "published_on": "2024-05-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "MWA, MBCIA respond to Brightmark concerns",
    "url": "https://www.41nbc.com/mwa-mbcia-respond-to-brightmark-concerns/",
    "published_on": "2021-12-07",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "ariel-schiller",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Brown beats Holliday in runoff race for Macon Water Authority District 2 seat",
    "url": "https://www.41nbc.com/brown-beats-holliday-race-macon-water-authority-district-2-seat/",
    "published_on": "2022-12-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "tucker-sargent",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon residents share concerns about plastics recycling facility",
    "url": "https://www.41nbc.com/macon-residents-share-concerns-about-plastics-recycling-facility/",
    "published_on": "2021-12-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "ariel-schiller",
        "role": "Author"
      }
    ]
  },
  {
    "title": "A 3-term incumbent faces a political newcomer in the school superintendent race",
    "url": "https://www.ajc.com/education/2026/04/8-candidates-vie-to-be-georgias-next-schools-superintendent/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "martha-dalton",
        "role": "Author"
      }
    ]
  },
  {
    "title": "8 candidates raise their hands to be Georgia’s school superintendent",
    "url": "https://www.ajc.com/education/2026/03/8-candidates-raise-their-hands-to-be-georgias-school-superintendent/",
    "published_on": "2026-03-09",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "martha-dalton",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Can Paperwork Keep Potential Voters From Polls?",
    "url": "http://gpbnews.org/post/can-paperwork-keep-potential-voters-polls",
    "published_on": "2018-10-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mike Collins won the GOP base. Can he convince the rest of the party?",
    "url": "https://www.ajc.com/politics/2026/07/mike-collins-won-the-gop-base-can-he-convince-the-rest-of-the-party/",
    "published_on": "2026-07-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "greg-bluestein",
        "role": "Author"
      }
    ]
  },
  {
    "title": "U.S. House District 2: Bishop seeks 18th term in SW Georgia",
    "url": "https://www.ajc.com/politics/2026/04/us-house-district-2-bishop-avoids-primary-challenge-in-sw-georgia/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "matt-day",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Mike Collins: Where the Georgia U.S. Senate candidate stands on the issues",
    "url": "https://www.ajc.com/politics/2026/04/mike-collins-a-look-at-the-ajcs-coverage/",
    "published_on": "2026-04-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "mark-niesse",
        "role": "Author"
      }
    ]
  },
  {
    "title": "U.S. Senate: Collins and Dooley square off in Georgia Republican runoff",
    "url": "https://www.ajc.com/politics/2026/06/us-senate-collins-and-dooley-square-off-in-georgia-republican-runoff/",
    "published_on": "2026-06-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "shannon-mccaffrey",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ossoff doubles down on anti-corruption message in reelection bid",
    "url": "https://www.ajc.com/politics/2026/06/ossoff-doubles-down-on-anti-corruption-message-in-reelection-bid/",
    "published_on": "2026-06-30",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "greg-bluestein",
        "role": "Author"
      },
      {
        "slug": "tia-mitchell",
        "role": "Author"
      },
      {
        "slug": "patricia-murphy",
        "role": "Author"
      },
      {
        "slug": "adam-beam",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mike Collins touts passage of Laken Riley Act at GOP midterm convention",
    "url": "https://www.ajc.com/politics/2026/09/mike-collins-touts-passage-of-laken-riley-act-at-gop-midterm-convention/",
    "published_on": "2026-09-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
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
        "slug": "tia-mitchell",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Miriam Paris, candidate for Georgia House District 142",
    "url": "https://www.41nbc.com/decision-2024-meet-miriam-paris-candidate-for-georgia-house-district-142/",
    "published_on": "2024-10-29",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
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
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Senate candidate Mike Collins pitches to veterans in Acworth",
    "url": "https://www.gpb.org/news/2026/08/24/senate-candidate-mike-collins-pitches-veterans-in-acworth",
    "published_on": "2026-08-25",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
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
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State Rep. Miriam Paris (D) highlights legislative priorities and International Women’s Day Ceremony at Georgia State Capitol",
    "url": "https://www.41nbc.com/state-rep-miriam-paris-d-highlights-legislative-priorities-and-international-womens-day-ceremony-at-georgia-state-capitol/",
    "published_on": "2026-03-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Lawmakers: Spotlight - School Discipline, Financial Literacy, and Juvenile Justice Reform",
    "url": "https://www.gpb.org/news/2026/03/10/lawmakers-spotlight-school-discipline-financial-literacy-and-juvenile-justice",
    "published_on": "2026-03-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "donna-lowry",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Lawmaker, ex-TV judge face off in Georgia secretary of state race",
    "url": "https://www.ajc.com/politics/2026/04/amid-ongoing-voting-turmoil-nine-compete-for-georgia-secretary-of-state/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-groves",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia midterms will decide who OKs how people vote in a battleground state",
    "url": "https://www.ajc.com/politics/2026/10/georgia-secretary-of-state-2026/",
    "published_on": "2026-10-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-groves",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Candidates for Georgia statewide office face off in Atlanta Press Club debates",
    "url": "https://www.gpb.org/news/2026/10/13/candidates-for-georgia-statewide-office-face-off-in-atlanta-press-club-debates",
    "published_on": "2026-10-13",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Democrats seek ‘crucial third vote’ on PSC",
    "url": "https://www.ajc.com/politics/2026/08/georgia-democrats-seek-crucial-third-vote-on-psc/",
    "published_on": "2026-08-03",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "greg-bluestein",
        "role": "Author"
      },
      {
        "slug": "tia-mitchell",
        "role": "Author"
      },
      {
        "slug": "patricia-murphy",
        "role": "Author"
      },
      {
        "slug": "adam-beam",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Jones County math teacher named Georgia Teacher of the Year",
    "url": "https://www.41nbc.com/jones-county-georgia-teacher-of-year-charm-mapp/",
    "published_on": "2026-06-01",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "tucker-sargent",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Skyview, McKibben Lane Elementary Schools honored for Georgia Milestones growth",
    "url": "https://www.41nbc.com/skyview-mckibben-lane-elementary-schools-honored-georgia-milestones-growth/",
    "published_on": "2025-02-12",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "taylor-gilchrist",
        "role": "Author"
      }
    ]
  },
  {
    "title": "''Lawmakers'' Day 39: Senate debates voting measures, House bans funds for prison gender-affirming care",
    "url": "https://www.gpb.org/news/2025/04/03/lawmakers-day-39-senate-debates-voting-measures-house-bans-funds-for-prison-gender",
    "published_on": "2025-04-03",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      },
      {
        "slug": "tristan-smith",
        "role": "Author"
      }
    ]
  },
  {
    "title": "''Lawmakers'' Day 15: Senate OKs teaching on retirement; Moms Demand Action supports gun switch ban",
    "url": "https://www.gpb.org/news/2026/02/10/lawmakers-day-15-senate-oks-teaching-on-retirement-moms-demand-action-supports-gun",
    "published_on": "2026-02-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      },
      {
        "slug": "tristan-smith",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Republican candidate Rick Jackson campaigns in Perry ahead of election day",
    "url": "https://www.41nbc.com/republican-candidate-rick-jackson-campaigns-in-perry-ahead-of-election-day/",
    "published_on": "2026-05-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "gena-tripp",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Rick Jackson beats Burt Jones for Georgia GOP governor nomination",
    "url": "https://www.41nbc.com/rick-jackson-wins-georgia-governor-republican-runoff/",
    "published_on": "2026-06-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tucker-sargent",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Rick Jackson: My vision for Ga. protects children, pocketbooks, public safety",
    "url": "https://www.ajc.com/opinion/2026/06/rick-jackson-my-vision-for-ga-protects-children-pocketbooks-public-safety/",
    "published_on": "2026-06-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-jackson",
        "role": "Author and Subject"
      }
    ]
  },
  {
    "title": "The $3B candidate: Unpacking Rick Jackson’s vast business empire",
    "url": "https://www.ajc.com/politics/2026/10/here-is-how-rick-jackson-made-his-fortune/",
    "published_on": "2026-10-14",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "chris-joyner",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Bottoms and Jackson face off in gubernatorial town hall debate",
    "url": "https://www.gpb.org/news/2026/10/07/bottoms-and-jackson-face-off-in-gubernatorial-town-hall-debate",
    "published_on": "2026-10-07",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "GOP''s Jackson, Collins win runoffs for governor, Senate to face Bottoms and Ossoff in November",
    "url": "https://www.gpb.org/news/2026/06/16/jackson-collins-win-runoffs-face-bottoms-and-challenge-ossoff-in-november",
    "published_on": "2026-06-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "sarah-kallis",
        "role": "Author"
      },
      {
        "slug": "sofi-gratas",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Black Democrat who outran Georgia GOP for decades is again a top target",
    "url": "https://www.ajc.com/politics/2026/08/republicans-home-in-on-southwest-georgia-district-held-by-black-democrat/",
    "published_on": "2026-08-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "tamar-hallerman",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Monroe County Buc-ee’s, fourth in Georgia, breaks ground. What we know.",
    "url": "https://www.gpb.org/news/2026/04/08/monroe-county-buc-ees-fourth-in-georgia-breaks-ground-what-we-know",
    "published_on": "2026-04-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "georgia-public-broadcasting",
        "role": "Publisher"
      },
      {
        "slug": "the-macon-telegraph",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "lucinda-warnke",
        "role": "Author"
      },
      {
        "slug": "katharine-tucker",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Middle Georgia voters return to polls for state Senate runoff",
    "url": "https://www.ajc.com/politics/2026/02/middle-georgia-voters-return-to-polls-for-state-senate-runoff/",
    "published_on": "2026-02-11",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "maya-t-prabhu",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democrat heads to runoff in Republican-heavy Macon area Georgia Senate seat",
    "url": "https://www.ajc.com/politics/2026/01/democrat-heads-to-runoff-in-republican-heavy-macon-area-georgia-senate-seat/",
    "published_on": "2026-01-21",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "maya-t-prabhu",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Republicans hold Middle Georgia Senate seat after special election runoff",
    "url": "https://www.ajc.com/politics/2026/02/middle-georgia-voters-to-pick-new-state-senator-in-tuesday-runoff/",
    "published_on": "2026-02-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "maya-t-prabhu",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Decision 2024: Meet Tangie Herring, candidate for Georgia House District 145",
    "url": "https://www.41nbc.com/decision-2024-meet-tangie-herring-candidate-for-georgia-house-district-145/",
    "published_on": "2024-10-21",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "monica-diaz-meek",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia House Democrats Hold Community Discussion in Macon",
    "url": "https://www.41nbc.com/georgia-house-democrats-hold-community-discussion-in-macon/",
    "published_on": "2026-10-12",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
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
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "gena-tripp",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Religious leaders gather with Georgia House candidates to urge people to vote",
    "url": "https://www.41nbc.com/religious-leaders-gather-georgia-house-candidates-urge-people-vote/",
    "published_on": "2024-10-29",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "godfrey-hall",
        "role": "Author"
      }
    ]
  },
  {
    "title": "New Georgia law requires 988 hotline on student ID badges",
    "url": "https://www.41nbc.com/new-georgia-law-requires-988-hotline-on-student-id-badges/",
    "published_on": "2026-05-13",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "gena-tripp",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Democrats want to flip the Georgia Legislature. The primary offers a preview.",
    "url": "https://www.ajc.com/politics/2026/04/democrats-want-to-flip-the-georgia-legislature-the-primary-offers-a-preview/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "caleb-groves",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State Rep. Tanya Miller announces candidacy for attorney general",
    "url": "https://www.ajc.com/politics/2025/08/state-rep-tanya-miller-announces-candidacy-for-attorney-general/",
    "published_on": "2025-08-25",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "michelle-baruchman",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia’s biggest deals on data centers should not be made in the dark",
    "url": "https://www.ajc.com/opinion/2026/09/georgia-attorney-general-democrat-tanya-miller/",
    "published_on": "2026-09-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Author and Subject"
      }
    ]
  },
  {
    "title": "UPDATE: Kemp extends Georgia gas tax break, adds diesel penalty waiver",
    "url": "https://www.41nbc.com/update-georgia-gas-tax-suspension-september-2026/",
    "published_on": "2026-10-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "tucker-sargent",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia’s American Journey: Peaches, Peanuts and Pines",
    "url": "https://www.41nbc.com/georgias-american-journey-peaches-peanuts-and-pines/",
    "published_on": "2026-07-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "tyrik-wynn",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Kemp signs agriculture bills, tax relief measures into law",
    "url": "https://www.41nbc.com/kemp-agriculture-bills-georgia-farmers/",
    "published_on": "2026-05-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "austin-slocumb",
        "role": "Author"
      }
    ]
  },
  {
    "title": "How rural Georgians are benefiting from the One Big Beautiful Bill",
    "url": "https://www.ajc.com/opinion/2026/04/how-rural-georgians-are-benefiting-from-the-one-big-beautiful-bill/",
    "published_on": "2026-04-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-atlanta-journal-constitution",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Author and Subject"
      }
    ]
  },
  {
    "title": "Pratt Industries opens Warner Robins factory supporting Georgia farmers",
    "url": "https://www.41nbc.com/pratt-industries-warner-robins-factory-opening/",
    "published_on": "2025-12-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "41nbc",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "bre-anna-sheffield",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Get to know Anissa Jones",
    "url": "https://macon-newsroom.com/13263/uncategorized/get-to-know-anissa-jones/",
    "published_on": "2022-05-03",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Georgia factory making emergency food for children worldwide is back working for USAID",
    "url": "https://macon-newsroom.com/24154/news/georgia-factory-making-emergency-food-for-children-worldwide-is-back-working-for-usaid/",
    "published_on": "2025-03-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-public-broadcasting",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon Water Authority taps political veteran to fill District 1 seat",
    "url": "https://macon-newsroom.com/20709/news/macon-water-authority-taps-political-veteran-to-fill-district-1-seat/",
    "published_on": "2024-04-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "New Ocmulgee Mounds congressional hearing set as UDA agrees to buy Marriott",
    "url": "https://macon-newsroom.com/28054/news/new-ocmulgee-mounds-congressional-hearing-set-as-uda-agrees-to-buy-marriott/",
    "published_on": "2026-06-25",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ga. State Rep. James Beverly will not seek re-election",
    "url": "https://macon-newsroom.com/20446/news/ga-state-rep-james-beverly-will-not-seek-re-election/",
    "published_on": "2024-03-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Hurricane Helene knocked a massive hole in Georgia’s timber industry",
    "url": "https://macon-newsroom.com/23110/news/hurricane-helene-knocked-a-massive-hole-in-georgias-timber-industry/",
    "published_on": "2024-11-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-public-broadcasting",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Middle Georgia Democratic state reps hold community discussion ahead of midterm elections",
    "url": "https://wgxa.tv/news/local/middle-georgia-democratic-state-reps-hold-community-discussion-ahead-of-midterm-elections-local-news-politics-election-voting-mariam-paris-floyd-griffin-tangie-herring-anissa-jones",
    "published_on": "2026-10-13",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
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
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "joshua-harrison-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Final day of Black Prosperity Summit in Macon spotlights access, capital and HBCUs",
    "url": "https://wgxa.tv/news/local/final-day-of-black-prosperity-summit-in-macon-spotlights-access-capital-and-hbcus-robert-scott-albany-state-university-president-historically-black-colleges-and-universities-economic-impact-dollars-money-anissa-jones-representative-district-143-community",
    "published_on": "2026-09-01",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ocmulgee bill gets first test in Congress this week, here''s what it means for Georgia",
    "url": "https://wgxa.tv/news/local/ocmulgee-bill-gets-first-test-in-congress-this-week-heres-what-it-means-for-georgia",
    "published_on": "2026-06-30",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Middle Georgia lawmakers hold Listening Day in Perry to gather input for 2027 session",
    "url": "https://wgxa.tv/news/local/middle-georgia-lawmakers-hold-listening-day-in-perry-to-gather-input-for-2027-session-senate-president-pro-tempore-larry-walker-iii-steven-mcneel-rmacon-sen-david-lucas-dmacon-rep-shaw-blackmon-rbonaire-rep-patty-stinson-dbutler-rep-n",
    "published_on": "2026-08-27",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "david-e-lucas",
        "role": "Mentioned"
      },
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Bárbara Rivera Holmes becomes first Latina to lead Georgia Department of Labor",
    "url": "https://wgxa.tv/news/state-news/barbara-rivera-holmes-becomes-first-latina-to-lead-georgia-department-of-labor-11th-commissioner-of-the-georgia-dol-governor-brian-kemp-history",
    "published_on": "2025-04-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "barbara-rivera-holmes",
        "role": "Mentioned"
      },
      {
        "slug": "leah-kincaid",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Headed To Trump’s Macon Rally? Know The COVID-19 Risk",
    "url": "https://macon-newsroom.com/8461/news/covid-19/headed-to-trumps-macon-rally-know-the-covid-19-risk/",
    "published_on": "2020-10-15",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Lawmakers explore solutions to rising daycare costs affecting families across Georgia",
    "url": "https://wgxa.tv/news/state-news/lawmakers-explore-solutions-to-rising-daycare-costs-impacting-families-across-georgia",
    "published_on": "2024-12-03",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ga. lawmakers plan to ease path to occupational license for workers with criminal records",
    "url": "https://wgxa.tv/news/state-news/ga-lawmakers-plan-to-ease-path-to-occupational-license-for-workers-with-criminal-records",
    "published_on": "2023-01-11",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "stanley-dunlap",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Rep. Washburn discusses plans ahead of 2026 legislative session",
    "url": "https://wgxa.tv/news/state-news/georgia-rep-washburn-discusses-plans-ahead-of-2026-legislative-session",
    "published_on": "2026-01-09",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "gloria-ruth-finney",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Lawmakers discuss job opportunities, public safety, and taxes at Forsyth chamber meeting",
    "url": "https://wgxa.tv/news/local/lawmakers-discuss-job-opportunities-public-safety-and-taxes-at-forsyth-chamber-meeting",
    "published_on": "2025-10-22",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ask Mayor Miller: Road paving relies on SPLOST renewal",
    "url": "https://macon-newsroom.com/23899/uncategorized/ask-mayor-miller-road-paving-relies-on-splost-renewal/",
    "published_on": "2025-01-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Bibb County and others get a clean bill of voting machine health from the state",
    "url": "https://macon-newsroom.com/22134/news/bibb-county-and-others-get-a-clean-bill-of-voting-machine-health-from-the-state/",
    "published_on": "2024-07-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-public-broadcasting",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon resident supports school zone cameras despite $1,000 in fines from speeding tickets",
    "url": "https://wgxa.tv/news/local/macon-resident-supports-school-zone-cameras-despite-1000-in-fines-from-speeding-tickets-dale-washburn-cars-bibb-county-middle-georgia",
    "published_on": "2025-09-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "R.E.M.’s Mike Mills, State Sen. David Lucas among honorees this month",
    "url": "https://macon-newsroom.com/25748/arts-entertainment-2/r-e-m-s-mike-mills-state-sen-david-lucas-among-honorees-this-month/",
    "published_on": "2025-10-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "david-e-lucas",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Portion of Jeffersonville Road to be named for Sen. David Lucas",
    "url": "https://macon-newsroom.com/9049/news/portion-of-jeffersonville-road-to-be-named-for-sen-david-lucas/",
    "published_on": "2020-12-03",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "david-e-lucas",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Middle Georgia REALTORS host Georgia House candidate forum Thursday in Macon",
    "url": "https://wgxa.tv/news/local/middle-georgia-realtors-host-georgia-house-candidate-forum-thursday-in-macon-jackie-applegate-political-action-chair-with-the-middle-georgia-board-of-realtors-real-estate-industry-kari-pollock-bethany-ballard-state-representatives-georgia-house-district",
    "published_on": "2026-08-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
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
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Failed Georgia school voucher bill finds ardent backer in lone Democratic lawmaker",
    "url": "https://macon-newsroom.com/18017/news/failed-georgia-school-voucher-bill-finds-ardent-backer-in-lone-democratic-lawmaker/",
    "published_on": "2023-06-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "ross-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State senator pushes bill to protect Georgia Power customers from rate hikes fueled by data centers",
    "url": "https://macon-newsroom.com/23930/news/government-accountability/state-senator-pushes-bill-to-protect-georgia-power-customers-from-rate-hikes-fueled-by-data-centers/",
    "published_on": "2025-02-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "stanley-dunlap",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Public Service Commission candidate discusses energy rates and data centers",
    "url": "https://wgxa.tv/news/local/georgia-public-service-commission-candidate-discusses-energy-rates-and-data-centers",
    "published_on": "2025-10-23",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "gloria-ruth-finney",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Public Service Commission race heats up over rising electricity bills",
    "url": "https://wgxa.tv/news/local/georgia-public-service-commission-race-heats-up-over-rising-electricity-bills-peter-hubbard-fitz-johnson-democrats-republicans",
    "published_on": "2025-10-14",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "East Macon residents gather to discuss gambling machines, development and voting",
    "url": "https://macon-newsroom.com/22164/news/local/east-macon-neighborhoods-to-meet-monthly-new-commissioner-elect-says/",
    "published_on": "2024-08-06",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia early voting begins for primary runoffs ahead of June 16 Election Day",
    "url": "https://wgxa.tv/news/local/georgia-early-voting-begins-for-primary-runoffs-ahead-of-june-16-election-day-burt-jones-rick-jackson-mike-collins-derek-dooley-josh-mclaurin-nabilah-parks-greg-dozeal-john-f-kennedy-tim-fleming-vernon-jones-dana-barrett-penny-reynolds-marshall-talley-ro",
    "published_on": "2026-06-08",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Dooley campaigns with Kemp in Middle Georgia as lawmakers allege ''pay-to-play politics''",
    "url": "https://wgxa.tv/news/local/dooley-campaigns-with-kemp-in-middle-georgia-as-lawmakers-allege-pay-to-play-politics-derek-dooley-senate-runoff-versus-mike-collins-june-16-governor-brian-kemp-centegix-georgia-politics-democrats-v-republicans-special-session-june-17",
    "published_on": "2026-06-13",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Hundreds gather at downtown Macon ‘No Kings’ protest against Trump administration",
    "url": "https://macon-newsroom.com/27723/community/studentwork/hundreds-gather-at-downtown-macon-no-kings-protest-against-trump-administration/",
    "published_on": "2026-03-28",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "gabriel-kopp",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Senate Republicans push to further restrict trans women in sports",
    "url": "https://wgxa.tv/news/nation-world/georgia-senate-republicans-push-to-further-restrict-trans-women-in-sports-college-swimmer-ncaa-georgia-tech-georgia-high-school-association-burt-jones-transgender-gender-identity-kaitlynn-wheeler-riley-gaines-grace-countie",
    "published_on": "2024-08-28",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      },
      {
        "slug": "associated-press",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "jeff-amy",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Obama to headline rally for Georgia Democrats days ahead of elections",
    "url": "https://wgxa.tv/news/nation-world/president-obama-to-headline-rally-for-georgia-democrats-keisha-lance-bottoms-jon-ossoff-days-ahead-of-2026-midterm-elections-rrt",
    "published_on": "2026-10-21",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      },
      {
        "slug": "the-national-news-desk",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "ray-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Luring passenger rail, Pedestrian safety priorities, Steven Fulbright pavilion",
    "url": "https://macon-newsroom.com/25541/news/luring-passenger-rail-pedestrian-safety-priorities-steven-fulbright-pavilion/",
    "published_on": "2025-08-22",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ask Mayor Miller: Future data center possible, jail reform, river safety",
    "url": "https://macon-newsroom.com/25484/news/ask-mayor-miller-future-data-center-possible-jail-reform-river-safety/",
    "published_on": "2025-07-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "New ‘Freedom’ electric bus hits the streets for USA’s 250th celebration",
    "url": "https://macon-newsroom.com/28071/news/new-freedom-electric-bus-hits-the-streets-for-usas-250th-celebration/",
    "published_on": "2026-07-01",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ossoff''s polished persona comes under attack by Republican opponent",
    "url": "https://wgxa.tv/news/nation-world/georgia-senator-jon-ossoffs-polished-persona-comes-under-attack-by-republican-gop-opponent-mike-collins-2026-midterm-elections",
    "published_on": "2026-10-19",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      },
      {
        "slug": "the-national-news-desk",
        "role": "Source"
      }
    ],
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
        "slug": "ray-lewis",
        "role": "Author"
      }
    ]
  },
  {
    "title": "President Trump to rally in Macon just over a week out from midterm elections",
    "url": "https://wgxa.tv/news/local/president-trump-to-rally-in-macon-just-over-a-week-out-from-midterm-elections-local-news-elections-voting-donald-trump-rick-jackson-mike-collins-jon-ossoff-keisha-lance-bottoms-republican-democrat-middle-georgia",
    "published_on": "2026-10-19",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "jordan-stevenson",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Middle Georgia Matters hosts nonpartisan Macon forum featuring Bottoms; Jackson absent",
    "url": "https://wgxa.tv/news/local/middle-georgia-matters-hosts-nonpartisan-macon-forum-featuring-bottoms-jackson-absent-keisha-lance-rick-mill-hill-community-arts-center-lieutenant-govenor-insurance-commissioner-public-service-us-house-miriam-paris-peter-hubbard-josh-tolbert-republican-d",
    "published_on": "2026-09-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Early voting in Georgia officially underway | Last day to vote early Oct. 30",
    "url": "https://wgxa.tv/news/local/early-voting-in-georgia-officially-underway-last-day-to-vote-early-oct-30-local-news-elections-politics-voting-rick-jackson-keisha-lance-bottoms-jon-ossoff-mike-collins-polling-locations",
    "published_on": "2026-10-13",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "jordan-stevenson",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Early voting begins for Georgia Public Service Commission in special primary election",
    "url": "https://wgxa.tv/news/local/early-voting-begins-for-georgia-public-service-commission-in-special-primary-election-local-news-politics-elected-officials-elections-democracy-voting-middle-georgia",
    "published_on": "2025-05-27",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "jordan-stevenson",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Judge halts MWA grand jury probe of what chairman calls ‘bully group’",
    "url": "https://macon-newsroom.com/15753/news/judge-halts-mwa-grand-jury-probe-of-what-chairman-calls-bully-group/",
    "published_on": "2022-12-02",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Critics say Georgia bill intended to ease school library book bans a ‘slippery slope’",
    "url": "https://macon-newsroom.com/12283/news/critics-say-georgia-bill-intended-to-ease-school-library-book-bans-a-slippery-slope/",
    "published_on": "2022-01-26",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "ross-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "2023 Preview – Part 1: Bicentennial kickoff, $25 million loft project, school sensory rooms, downtown parking changes and new MWA leadership",
    "url": "https://macon-newsroom.com/16236/news/2023-preview-part-1-bicentennial-kickoff-25-million-loft-project-school-sensory-rooms-downtown-parking-changes-and-new-mwa-leadership/",
    "published_on": "2022-12-26",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Flooding votes for the MWA''s runoff election",
    "url": "https://wgxa.tv/news/local/flooding-votes-for-the-mwas-runoff-election",
    "published_on": "2022-12-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "ryan-marando",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ahead of MWA runoff do Maconites care if their elected officials have a criminal past?",
    "url": "https://wgxa.tv/news/local/criminal-past-desmond-brown-lindsay-holliday-mwa-macon-water-authority-run-off-election-runoff-election-district-two-district-2",
    "published_on": "2022-11-09",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "ereina-plunkett",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Grand Jury investigation into Macon Water Authority halted",
    "url": "https://wgxa.tv/news/local/grand-jury-investigation-into-macon-water-authority-halted-mwa-lindsay-holliday-dwight-jones-bill-howell-anissa-frank-patterson-desmond-brown-jeff-michele-parks",
    "published_on": "2022-12-02",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "brandon-mcgouirk",
        "role": "Author"
      }
    ]
  },
  {
    "title": "26 for 2026 Part 1: Costco coming, new tax, President Penny, Dist. 18 Special Election, courtside eats and more to Bragg about",
    "url": "https://macon-newsroom.com/26508/news/26-for-2026-part-1-costco-coming-new-tax-president-penny-dist-18-special-election-courtside-eats-and-more-to-bragg-about/",
    "published_on": "2025-12-22",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Macon-Bibb wants 3 early-voting sites, preps for possible Saturday vote",
    "url": "https://macon-newsroom.com/15661/news/macon-bibb-wants-3-early-voting-sites-preps-for-possible-saturday-vote/",
    "published_on": "2022-11-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "lindsay-d-holliday",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia Juneteenth celebrations break out from Atlanta to Dublin to Valdosta",
    "url": "https://macon-newsroom.com/18139/news/georgia-juneteenth-celebrations-break-out-from-atlanta-to-dublin-to-valdosta/",
    "published_on": "2023-06-19",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "aaleah-mcconnell",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Rep. Mike Collins wins Georgia’s GOP Senate nomination, will face Dem. Sen. Jon Ossoff",
    "url": "https://wgxa.tv/news/nation-world/rep-mike-collins-wins-georgias-gop-senate-nomination-will-face-dem-sen-jon-ossoff",
    "published_on": "2026-06-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      },
      {
        "slug": "associated-press",
        "role": "Source"
      }
    ],
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
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "bill-barrow",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Board of Elections loses legal case against mayor and commissioners",
    "url": "https://macon-newsroom.com/17902/news/board-of-elections-loses-legal-case-against-mayor-and-commissioners/",
    "published_on": "2023-05-25",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "It’s a wrap: Georgia governor signs off on 250-plus bills by deadline",
    "url": "https://macon-newsroom.com/17729/news/its-a-wrap-georgia-governor-signs-off-on-250-plus-bills-by-deadline/",
    "published_on": "2023-05-11",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-recorder",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "stanley-dunlap",
        "role": "Author"
      }
    ]
  },
  {
    "title": "“Blatant conflict of interest” leads to censure of Macon Water Authority board member",
    "url": "https://macon-newsroom.com/12303/news/blatant-conflict-of-interest-leads-to-censure-of-macon-water-authority-board-member/",
    "published_on": "2022-01-28",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ga. Senate bill gives Macon-Bibb clear control to select elections supervisor",
    "url": "https://macon-newsroom.com/16979/news/ga-senate-bill-gives-macon-bibb-clear-control-to-select-elections-supervisor/",
    "published_on": "2023-02-24",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-a-williams",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State unveils plan to boost reading scores at eight Bibb County elementary schools",
    "url": "https://macon-newsroom.com/20367/news/education/state-unveils-plan-to-boost-reading-scores-at-eight-bibb-county-elementary-schools/",
    "published_on": "2024-02-20",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "laura-corley",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State schools superintendent eyes revamped funding approach in 2024 Legislature",
    "url": "https://macon-newsroom.com/19361/news/state-schools-superintendent-eyes-revamped-funding-approach-in-2024-legislature/",
    "published_on": "2023-11-14",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "ross-williams",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Republican Gubernatorial candidate Burt Jones campaigns in Gray ahead of June 16 runoff",
    "url": "https://wgxa.tv/news/local/republican-gubernatorial-candidate-burt-jones-campaigns-in-gray-ahead-of-june-16-runoff-rick-williams-gop-old-clinton-barbecue-house-backed-by-president-donald-trump-lt-middle-georgia-butts-county-jones-petroleum-cut-tax-incentives-abatements-lowering-ta",
    "published_on": "2026-06-04",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "State superintendent visits Southfield to celebrate Constitution Week, cursive writing win",
    "url": "https://wgxa.tv/news/local/state-superintendent-heads-to-southfield-to-celebrate-constitution-week-cursive-writing-win-the-john-hancock-banner-and-proficiency-ribbon-honored-southfieldstate-school-superintendent-richard-woods-visited-macon",
    "published_on": "2026-09-21",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "gloria-ruth-finney",
        "role": "Author"
      }
    ]
  },
  {
    "title": "McNeel defeats Brown for District 18 State Senate seat",
    "url": "https://wgxa.tv/news/local/mcneel-defeats-brown-for-district-18-state-senate-seat",
    "published_on": "2026-02-17",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Macon-Bibb election supervisor urges early voting for District 18 runoff at Macon Mall",
    "url": "https://wgxa.tv/news/local/macon-bibb-election-supervisor-urges-early-voting-for-district-18-runoff-at-macon-mall-office-3661-eisenhower-parkway-suite-mb101-this-week-and-enter-through-the-military-recruitment-side-democrat-lemario-brown-and-republican-steven-mcneel-runoff",
    "published_on": "2026-02-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "steven-mcneel",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ask Mayor Miller: Blight pivot, curbing crime, smart growth, Confederate conversations",
    "url": "https://macon-newsroom.com/22914/news/ask-mayor-miller-blight-fight-pivot-curtailing-crime-smart-growth-confederate-conversations/",
    "published_on": "2024-10-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Ahead of SNAP Pause, Empty Shelves At the Food Bank",
    "url": "https://macon-newsroom.com/25918/news/ahead-of-snap-pause-empty-shelves-at-the-food-bank/",
    "published_on": "2025-10-29",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-public-broadcasting",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "grant-blankenship",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Sen. Warnock, Rep. Bishop visit Ocmulgee site as progress stalls for National Park status",
    "url": "https://macon-newsroom.com/19445/news/sen-warnock-rep-bishop-visit-ocmulgee-site-as-progress-stalls-for-national-park-status/",
    "published_on": "2023-11-21",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      },
      {
        "slug": "georgia-public-broadcasting",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "eliza-moore",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Habitat plans 10 more Napier Heights homes as Bishop touts FY27 funding at build site",
    "url": "https://wgxa.tv/news/local/habitat-plans-10-more-napier-heights-homes-as-bishop-touts-fy27-funding-at-build-site-state-federal-cngressman-stanford-second-congressional-district-macon-milledgeville-for-humanity-bibb-county-napier-heights-duncan-avenue-consuela-sandifer-yolanda-clar",
    "published_on": "2026-09-23",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia voters who question 2020 results could pick state''s next top elections official",
    "url": "https://wgxa.tv/news/local/georgia-voters-who-question-2020-results-could-pick-states-next-top-elections-official-georgia-secretary-of-state-race-brad-raffensperger-successor-vernon-jones-runoff-tim-fleming-election-issues-georgia-voting-laws",
    "published_on": "2026-06-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      }
    ]
  },
  {
    "title": "Georgia state reps analyze rising online child exploitation, calls for safety talks",
    "url": "https://wgxa.tv/news/local/mercer-university-forum-warns-of-rising-online-child-exploitation-calls-for-safety-talks-rob-clifton-tangie-herring-roblox-georgia-attorney-chris-carr-sexual-abuse-lookout-mountain-childrens-advocacy-center-commissioner-district-house-blue-ribbon-study",
    "published_on": "2026-08-05",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "addison-white",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mayor plans more economic development, Hilton demolition and reflects on election, pool season",
    "url": "https://macon-newsroom.com/21607/news/mayor-plans-more-economic-development-hilton-demolition-and-reflects-on-election-pool-season/",
    "published_on": "2024-05-31",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mayor discusses tax breaks and collections, vagrant vandalism, housing",
    "url": "https://macon-newsroom.com/26909/news/mayor-discusses-tax-breaks-and-collections-vagrant-vandalism-housing/",
    "published_on": "2026-03-10",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "the-macon-newsroom",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "liz-fabian",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Washington County Superior Court denies District 128 candidate''s call for new election",
    "url": "https://wgxa.tv/news/local/washington-county-superior-court-dismisses-district-128-candidates-call-for-new-election-ga-state-house-of-representatives-tracy-wheeler-mack-jackson-lawsuit-questions-november-5-2024-election-results-judge-gary-mccorvey-ruling-denies-georgia-case-law",
    "published_on": "2025-02-12",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tracy-wheeler",
        "role": "Mentioned"
      },
      {
        "slug": "leah-kincaid",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Georgia lawmakers react to Minnesota shooting, call for more safety measures for officials",
    "url": "https://wgxa.tv/news/state-news/georgia-lawmakers-react-to-minnesota-shooting-call-for-more-safety-measures-for-officials-vance-boelter-tim-walz-melissa-hortman-john-hoffman-",
    "published_on": "2025-06-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "anissa-m-jones",
        "role": "Mentioned"
      },
      {
        "slug": "dale-washburn",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Mandatory minimum sentences for gang recruitment bill passes Georgia house",
    "url": "https://wgxa.tv/news/local/mandatory-minimum-sentences-for-gang-recruitment-bill-passes-georgia-house-representative-tanya-miller-soo-hong-barry-fleming-governor-brain-kemp-youth",
    "published_on": "2023-03-22",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "wgxa",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "brianna-cook",
        "role": "Author"
      }
    ]
  },
  {
    "title": "President Trump to visit Macon on Saturday, supporting GOP candidates before midterm election",
    "url": "https://www.13wmaz.com/article/news/politics/elections/president-trump-visit-macon-saturday-midterm-elections/93-496eb3e5-9c56-4af2-8f0e-2f3ccb378ad4",
    "published_on": "2026-10-19",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "13wmaz",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "lars-lonnroth",
        "role": "Author"
      }
    ]
  },
  {
    "title": "2026 Georgia Election Guide: Midterms, Central Georgia elections and statewide races",
    "url": "https://www.13wmaz.com/article/news/politics/elections/2026-central-georgia-midterm-governor-election-guide/93-d691b21e-dd26-4b5e-9c33-202f16f6aafa",
    "published_on": "2026-02-26",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "13wmaz",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "greg-dolezal",
        "role": "Mentioned"
      },
      {
        "slug": "josh-mclaurin",
        "role": "Mentioned"
      },
      {
        "slug": "tim-fleming",
        "role": "Mentioned"
      },
      {
        "slug": "penny-brown-reynolds",
        "role": "Mentioned"
      },
      {
        "slug": "brian-strickland",
        "role": "Mentioned"
      },
      {
        "slug": "tanya-miller",
        "role": "Mentioned"
      },
      {
        "slug": "tyler-harper",
        "role": "Mentioned"
      },
      {
        "slug": "katherine-e-juhan-arnold",
        "role": "Mentioned"
      },
      {
        "slug": "john-king",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-sean-waites",
        "role": "Mentioned"
      },
      {
        "slug": "richard-woods",
        "role": "Mentioned"
      },
      {
        "slug": "lydia-powell",
        "role": "Mentioned"
      },
      {
        "slug": "barbara-rivera-holmes",
        "role": "Mentioned"
      },
      {
        "slug": "nikki-porcher",
        "role": "Mentioned"
      },
      {
        "slug": "fitz-johnson",
        "role": "Mentioned"
      },
      {
        "slug": "peter-hubbard",
        "role": "Mentioned"
      },
      {
        "slug": "josh-tolbert",
        "role": "Mentioned"
      },
      {
        "slug": "shelia-edwards",
        "role": "Mentioned"
      },
      {
        "slug": "matt-day",
        "role": "Mentioned"
      },
      {
        "slug": "sanford-bishop",
        "role": "Mentioned"
      },
      {
        "slug": "austin-scott",
        "role": "Mentioned"
      },
      {
        "slug": "kelly-esti",
        "role": "Mentioned"
      },
      {
        "slug": "tracy-wheeler",
        "role": "Mentioned"
      },
      {
        "slug": "calvin-palmer",
        "role": "Mentioned"
      },
      {
        "slug": "miriam-paris",
        "role": "Mentioned"
      },
      {
        "slug": "eric-wilson",
        "role": "Mentioned"
      },
      {
        "slug": "tangie-herring",
        "role": "Mentioned"
      },
      {
        "slug": "randy-peters",
        "role": "Mentioned"
      },
      {
        "slug": "floyd-griffin",
        "role": "Mentioned"
      },
      {
        "slug": "lars-lonnroth",
        "role": "Author"
      }
    ]
  },
  {
    "title": "President Donald Trump rallies with top Republicans in Georgia",
    "url": "https://www.13wmaz.com/article/news/politics/trump-rallies-with-top-republicans-dalton-georgia/85-c4007ba2-343c-4dbb-bad9-75f8bf3df480",
    "published_on": "2026-10-16",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "13wmaz",
        "role": "Publisher"
      },
      {
        "slug": "associated-press",
        "role": "Source"
      }
    ],
    "people": [
      {
        "slug": "mike-collins",
        "role": "Mentioned"
      },
      {
        "slug": "rick-jackson",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "bill-barrow",
        "role": "Author"
      },
      {
        "slug": "michelle-l-price",
        "role": "Author"
      },
      {
        "slug": "will-weissert",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Former President Obama set to rally in Atlanta in advance of the end of early voting",
    "url": "https://www.13wmaz.com/article/news/politics/elections/former-president-obama-set-to-rally-in-atlanta-in-advance-of-the-end-of-early-voting/85-af0790f6-2ea1-421a-a81d-f92ee5ed909a",
    "published_on": "2026-10-18",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "13wmaz",
        "role": "Publisher"
      }
    ],
    "people": [
      {
        "slug": "jon-ossoff",
        "role": "Mentioned"
      },
      {
        "slug": "keisha-lance-bottoms",
        "role": "Mentioned"
      },
      {
        "slug": "aaron-waisler",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Jon Ossoff, usually a head down senator, has found a formula to excite Democrats",
    "url": "https://www.npr.org/2026/08/27/nx-s1-5935282/jon-ossoff-georgia-senate-race",
    "published_on": "2026-08-27",
    "fetched_on": "2026-10-21",
    "organizations": [
      {
        "slug": "npr",
        "role": "Publisher"
      }
    ],
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
        "slug": "sam-gringlas",
        "role": "Author"
      }
    ]
  }
]'::jsonb)
  loop
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
    for link in select value from jsonb_array_elements(item->'organizations')
    loop
      select id into strict organization_uuid from public.organizations where slug=link->>'slug';
      insert into public.article_organizations(article_id,organization_id,role)
      values(article_uuid,organization_uuid,link->>'role') on conflict(article_id,organization_id) do nothing;
    end loop;
  end loop;
end;
$seed$;
