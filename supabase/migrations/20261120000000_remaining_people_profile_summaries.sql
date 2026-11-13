-- Official-source summaries for the remaining people, reviewed 2026-10-23.
-- Provenance: docs/research/remaining-people-summaries-2026-10-23.json
-- Previously updated candidates and officials are excluded.
-- Exact-description guard preserves subsequent admin edits.
update public.people p
set description = verified.description
from (values
  ('d4f231ab-80e9-41ed-8272-d3ab0581ea8c'::uuid, 'a-j-hopkins', 'Environmental Compliance Manager — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'A.J. Hopkins is listed as environmental compliance manager with Macon Water Authority.'),
  ('193ab161-b068-4953-bf3a-edd3680d4fb2'::uuid, 'aaleah-mcconnell', 'Credited author in candidate news coverage.', 'Journalist whose Georgia Recorder reporting has appeared in The Macon Newsroom.'),
  ('3a75a284-0abb-4b7e-895f-1fe3037bb3f8'::uuid, 'abbie-price', 'Safe Kids of Central Georgia coordinator listed on the Macon-Bibb County Health Department''s current team page.

Source: https://northcentralhealthdistrict.org/macon-bibb-county-health-department/', 'Safe Kids of Central Georgia coordinator listed on the Macon-Bibb County Health Department''s current team page.'),
  ('d8509af6-f52d-41c3-aa5d-50a55128e45c'::uuid, 'abby-aiello', 'Macon community organizer who co-founded Macon Rising with She Keene and Elizabeth Lott in early 2025. The coalition organizes civic education, community engagement, and peaceful demonstrations. February 2026 reporting also identifies Aiello as a Macon Rising co-founder.

Sources: https://maconmelody.com/?p=10671 ; https://www.wpganews.com/2026/02/11/former-vice-president-kamala-harris-visit-macon-book-event/', 'Macon-based nonprofit development professional whose LinkedIn biography lists her as National Kidney Foundation vice president for field corporate development.'),
  ('0ba1fba2-2299-435b-892b-61d1d3e690e4'::uuid, 'adam-beam', 'Credited author in candidate news coverage.', 'Deputy politics editor at The Atlanta Journal-Constitution, with experience covering government for The Associated Press.'),
  ('0558b48d-7203-4c7e-a6fb-b8c91402e510'::uuid, 'adam-dudynsky', 'Listed as Maintenance / Auto Mechanic of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Adam Dudynsky is listed as Maintenance / Auto Mechanic of Rescue Mission of Middle Georgia.'),
  ('40f94b63-a448-44ab-8a03-5600d5d141ae'::uuid, 'addison-white', 'Credited author in candidate news coverage.', 'Has contributed WGXA reporting on economic opportunity and community issues in Middle Georgia.'),
  ('48637d86-f846-41cf-87c9-34aeff461480'::uuid, 'adelaide-bush-kirk', 'Listed as Regional Disaster Officer for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Regional disaster officer for the American Red Cross Georgia Region, overseeing preparedness and disaster-response programs.'),
  ('86640542-a976-4225-8489-c6eae510855e'::uuid, 'alander-rocha', 'Credited author in candidate news coverage.', 'Atlanta-based Georgia Recorder journalist who previously reported for KFF Health News and The Red & Black.'),
  ('b77ee34e-3302-4794-ace7-dc5d22563373'::uuid, 'alba-rosa', 'Credited author or contributor in coverage published by The Macon Telegraph.', 'Local courts reporter for The Telegraph in Macon and a Florida International University journalism graduate.'),
  ('bfc28d2d-ca86-4550-a027-2481b66ad57d'::uuid, 'alex-gallimore', 'Listed as Moderator-elect by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Alex Gallimore is listed as Moderator-elect by the Cooperative Baptist Fellowship of Georgia.'),
  ('1392243f-aa0e-4644-a7a9-9c3190828a8f'::uuid, 'alex-habersham', 'Program Partner — Habersham Downtown Dreams Initiative.

Sources (reviewed October 23, 2026): https://newtownmacon.com/business-resources/downtown-diversity-initiative/', 'Alex Habersham is listed as program partner with Habersham Downtown Dreams Initiative.'),
  ('e6991351-6846-40f3-8cfd-1b1d5a4436eb'::uuid, 'alex-mason', 'Director of Development — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Alex Mason is listed as director of development with Greater Macon Chamber of Commerce.'),
  ('8577c8ea-49f2-4a12-998a-2b684c941fd7'::uuid, 'alex-morrison', 'Executive Director — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/

Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Alex Morrison is listed as executive director with Macon-Bibb County Urban Development Authority.'),
  ('244606a3-c973-4583-8e3b-a4070d33948a'::uuid, 'alfred-sams', 'Listed as Member-at-Large on the Executive Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Alfred Sams is listed as Member-at-Large on the Executive Board of Rescue Mission of Middle Georgia.'),
  ('424c75fd-1904-4e4a-b101-0be2db4786f1'::uuid, 'algernon-wallace', 'Director of Engineering — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Algernon Wallace is listed as director of engineering with Macon Water Authority.'),
  ('2bb1efaa-974f-4dc7-b674-73981ed684db'::uuid, 'ali-sulko', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Contributed reporting to The Macon Melody’s coverage of Bibb County’s education sales-tax referendum.'),
  ('99585943-8b7e-49cf-8030-397ba73b189f'::uuid, 'alicia-doherty', 'Listed as Regional Executive for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Regional executive of the American Red Cross Georgia Region, with experience in volunteer services and blood collections.'),
  ('7124cac6-6864-4ede-8c08-9db9db6a9bd5'::uuid, 'alisha-neal', 'Chief Financial Officer — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Chief Financial Officer — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Alisha Neal is listed as chief financial officer with Piedmont Macon Medical Center.'),
  ('325fd432-9b80-473e-bec9-87611050bb58'::uuid, 'alison-bender', 'Identified as Brookdale Resource Center director in an October 2024 county account of its mural project. The role is historical; current employment has not been verified.

Source: https://www.maconbibb.us/mvppaintinghellohouse/', 'Identified as Brookdale Resource Center director in an October 2024 county account of its mural project.'),
  ('8b54a64f-c296-46d1-b0ba-68665c850e33'::uuid, 'allie-osborne', 'Listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Allie Osborne is listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia.'),
  ('f13ca925-0e90-496b-a606-d68cf01043f7'::uuid, 'alton-howard', 'Associate Member; Fort Valley Council Member — Peach County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Alton Howard is listed as associate member; Fort Valley council member with Peach County at the Middle Georgia Regional Commission.'),
  ('a5e68c35-a21a-49bf-b11b-26263f5dcab6'::uuid, 'alveta-watkins', 'Assistant Deputy Chief of Juvenile — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Alveta Watkins is listed as assistant deputy chief of juvenile with Macon Judicial Circuit District Attorney’s Office.'),
  ('5dbfe4bc-0880-44a5-a12d-30c7eb7a1750'::uuid, 'alvin-lindsey', 'Secretary — Middle Georgia Community Food Bank.
Source (reviewed October 23, 2026): https://mgcfb.org/about-us/', 'Alvin Lindsey is listed as secretary with Middle Georgia Community Food Bank.'),
  ('a51b8359-349b-42bb-8818-ec6d2e3eb943'::uuid, 'amanda-cook', 'Listed as Office Manager at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Amanda Cook is listed as Office Manager at Centenary United Methodist Church.'),
  ('63bf665b-aa18-42aa-a518-b21ca32d4609'::uuid, 'amanda-dougherty', 'Listed as Family Event Coordinator by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-staff/ (verified October 23, 2026; the published roster does not specify a term date).', 'Amanda Dougherty is listed as Family Event Coordinator by Jay''s HOPE Foundation.'),
  ('0638b88f-72c7-48aa-9de1-ab3091c6cfbb'::uuid, 'amy-ethridge', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Amy Ethridge is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('fc5a928c-12b3-43bf-a498-628f910a306b'::uuid, 'amy-hartley', 'Chief Probation Officer — State Court of Bibb County.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/state-court/', 'Amy Hartley is listed as chief probation officer with State Court of Bibb County.'),
  ('2cb8d9ee-5f29-4dc0-a7e2-14ab7ef96b65'::uuid, 'amy-wenk', 'Credited author in candidate news coverage.', 'Consumer brands reporter for The Atlanta Journal-Constitution.'),
  ('9d5308e2-d509-4ad6-9a96-617be61b7f8e'::uuid, 'andrea-crutchfield', 'Chief Appraiser — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/about-us', 'Andrea Crutchfield is listed as chief appraiser with Macon-Bibb County Board of Tax Assessors.'),
  ('93844e64-ec27-4cdc-8cf4-4a066d94f486'::uuid, 'andrea-johnson', 'Listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Andrea Johnson is listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('1d82f832-817b-450c-8f93-723f8ea6bcfe'::uuid, 'angelia-hoomes', 'Secretary of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Secretary of the Macon-Bibb Democratic Committee.'),
  ('bf009b0a-5f70-44a1-88fb-bc72fb6601ad'::uuid, 'angie-walker', 'Executive Director, Human Resources — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Executive Director, Human Resources — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Angie Walker is listed as executive director, human resources with Piedmont Macon Medical Center.'),
  ('63b3bc0a-27e1-45f7-b32f-570baded26f6'::uuid, 'annette-anderson', 'Finance Assistant — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Annette Anderson is listed as finance assistant with NewTown Macon.'),
  ('8eb409b3-a982-43d8-88bf-7fdba6711c33'::uuid, 'anthony-howard', 'Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Anthony Howard is listed as board member with Main Street Macon Board.'),
  ('80fc9ed2-5f39-47a7-aac7-75602222dd48'::uuid, 'ariel-schiller', 'Credited author in candidate news coverage.', 'Has reported on local government, elections, and community issues for 41NBC.'),
  ('bf4450d9-b836-4582-9242-c46ff1bafcbe'::uuid, 'asha-ellen', 'Executive Director — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Asha Ellen is listed as executive director with Keep Macon-Bibb Beautiful.'),
  ('872311b0-97f1-4a6c-84b8-f7c83efd312c'::uuid, 'ashleigh-coats', 'Board Chair — Crisis Line & Safe House of Central Georgia.
Source (reviewed October 23, 2026): https://cl-sh.org/who-we-are/', 'Ashleigh Coats is listed as board chair with Crisis Line & Safe House of Central Georgia.'),
  ('4a7f9ed5-23d7-4bf7-8d09-07bcc240a305'::uuid, 'ashley-copelan', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Ashley Copelan is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('3a9206b5-0098-4420-be87-341b69dfc139'::uuid, 'ashley-haynes', 'Listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Ashley Haynes is listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('c4e1a83c-1619-43d8-898a-016c9cc2bed7'::uuid, 'austin-slocumb', 'Credited author in candidate news coverage.', 'Reports on community events and local news for 41NBC.'),
  ('d16d6611-0285-4b58-aeab-263dac7d1bcc'::uuid, 'autumn-vangunten', 'Board Secretary — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Autumn VanGunten is listed as board secretary with Macon Arts Alliance.'),
  ('3774da3a-309f-421c-a84c-ac19847746e5'::uuid, 'baleigh-fleming', 'Operations and Finance Director — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Baleigh Fleming is listed as operations and finance director with Macon-Bibb County Industrial Authority.'),
  ('0e6a187a-ac50-4240-877a-460693564412'::uuid, 'barbara-boyer', 'Board Vice Chair — Bibb County Board of Elections.

Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Barbara Boyer is listed as board vice chair with Bibb County Board of Elections.'),
  ('34deeec3-b175-4307-b2fd-524d281f5551'::uuid, 'barbara-durham', 'Development Director — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Barbara Durham is listed as development director with Rescue Mission of Middle Georgia.'),
  ('51c35ff2-a730-494d-b901-8424c5823382'::uuid, 'barneika-williams', 'Listed as Resident Manager by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Barneika Williams is listed as Resident Manager by Ronald McDonald House of Central and Southwest Georgia.'),
  ('68540d8e-de0f-4ec3-991f-ab328cfecd0e'::uuid, 'barrie-miller-howard', 'Chief Financial Officer — Tubman African American Museum.
Source (reviewed October 23, 2026): https://tubmanmuseum.com/museum-staff/', 'Barrie Miller-Howard is listed as chief financial officer with Tubman African American Museum.'),
  ('f3dc4590-4079-456d-bcc2-970d2f4c3ed9'::uuid, 'beth-coon', 'Beth Coon is listed as president of the Pilot Club of Jones County in the Georgia District of Pilot International''s 2023-24 club-president roster. This documents the historical leadership role; it does not establish the current officeholder.

Source: https://pilotgeorgia.org/wp-content/uploads/2023/08/ga-district-club-presidents-2023-24.pdf', 'Beth Coon is listed as president of the Pilot Club of Jones County in the Georgia District of Pilot International''s 2023-24 club-president roster.'),
  ('fee0d9e3-6d63-4f84-9738-e7e19f2d7746'::uuid, 'beth-dunwody', 'Listed as Spiritual Director at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Beth Dunwody is listed as Spiritual Director at Centenary United Methodist Church.'),
  ('1568d78d-a5a6-46de-b20c-d2acca1bbe1e'::uuid, 'betsy-fitzgerald', 'President and CEO — Big Brothers Big Sisters of the Heart of Georgia.
Source (reviewed October 23, 2026): https://bbbsga.org/our-team/', 'President and CEO of Big Brothers Big Sisters of the Heart of Georgia.'),
  ('702c634e-3459-4239-ab95-fe2a3f29a975'::uuid, 'beverly-olson', 'Board Secretary — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Beverly Olson is listed as board secretary with Rescue Mission of Middle Georgia.'),
  ('6884a46b-09a1-4172-ab29-2e14e8baffb4'::uuid, 'bill-argo', 'Listed as Member-at-Large on the Executive Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Bill Argo is listed as Member-at-Large on the Executive Board of Rescue Mission of Middle Georgia.'),
  ('cbff8f95-9b37-4d50-be0f-2fe0451d8ddb'::uuid, 'bill-barrow', 'Credited author in candidate news coverage.', 'Atlanta-based Associated Press reporter covering U.S. politics.'),
  ('6532b9a5-269d-45b7-9642-89e1262ed875'::uuid, 'bill-fulger', 'Director of Construction — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Bill Fulger is listed as director of construction with NewTown Macon.'),
  ('5391a959-42a9-47d6-a60f-e6e4f5f82e2d'::uuid, 'bill-torpy', 'Credited author in candidate news coverage.', 'Contributes columns to The Atlanta Journal-Constitution after retiring from its staff in December 2025.'),
  ('00729334-a531-4023-9e5f-f2a9a7155f60'::uuid, 'blair-train', 'Listed as Development Administrative Assistant by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Blair Train is listed as Development Administrative Assistant by Ronald McDonald House of Central and Southwest Georgia.'),
  ('ad11e450-e094-4606-a5e4-4cf23558c668'::uuid, 'blake-lisenby', 'Secretary of the Community Foundation of Central Georgia''s 2026-27 executive committee. The official board roster lists his county as Bibb.

Source: https://cfcga.org/about/board-of-directors/', 'Secretary of the Community Foundation of Central Georgia''s 2026-27 executive committee.'),
  ('109058d3-2a8d-4264-9188-9bd3bce0e70c'::uuid, 'blake-sharpton', 'Listed as president of Macon Civic Club Inc. in the FY2024 Form 990 officer roster reproduced by philanthropy.org. This is a filing-year affiliation; current office has not been verified.

Source: https://philanthropy.org/990/report/582087373/macon-civic-club-inc', 'Butler Snow attorney focused on public finance, lending, and economic development. He leads its public finance practice group.'),
  ('f0830777-1425-4899-9005-05e67c41ec3f'::uuid, 'blake-sullivan', 'Board Vice Chair — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Blake Sullivan is listed as board vice chair with Rescue Mission of Middle Georgia.'),
  ('423e4404-30df-45de-b379-d7b244cbd941'::uuid, 'bo-parrott', 'Commercial Appraisal Manager — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/about-us', 'Bo Parrott is listed as commercial appraisal manager with Macon-Bibb County Board of Tax Assessors.'),
  ('62411b98-f5c2-41b3-b54f-4d4671093f8b'::uuid, 'bob-brown', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Bob Brown is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('5b68645a-51f7-4c31-bc99-c9f294ff0e78'::uuid, 'bob-hatcher', 'Treasurer — Middle Georgia Community Food Bank.
Source (reviewed October 23, 2026): https://mgcfb.org/about-us/', 'Bob Hatcher is listed as treasurer with Middle Georgia Community Food Bank.'),
  ('0b1d7ca7-34f8-4707-bd9c-80f2e234ec65'::uuid, 'bob-king', 'Named in Rebuilding Macon''s published 2025 board roster as Board Chair. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Bob King appears on Rebuilding Macon''s 2025 board roster as board chair.'),
  ('b8656cc6-e077-4c79-ab52-8cd31e7b31e0'::uuid, 'bob-meloche', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Bob Meloche is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('3d1ce37a-43e6-4552-bac5-b8887a462fc9'::uuid, 'bonnie-carlson', 'Board Vice Chair — Crisis Line & Safe House of Central Georgia.
Source (reviewed October 23, 2026): https://cl-sh.org/who-we-are/', 'Bonnie Carlson is listed as board vice chair with Crisis Line & Safe House of Central Georgia.'),
  ('6134ccf9-b236-4b53-851e-9e78ce149af4'::uuid, 'brad-michael', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Brad Michael is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('ec8b4187-9282-4594-93dc-c14ad98486e1'::uuid, 'brandi-simpson-miller', 'Historian — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Brandi Simpson Miller is listed as historian with Keep Macon-Bibb Beautiful.'),
  ('3aaba1c1-2907-4e09-bb7e-6bd1a5df0b7b'::uuid, 'brandon-elam', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Brandon Elam appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('3dda72dc-aadb-4df6-89c9-7db03bb27056'::uuid, 'brandon-mcgouirk', 'Credited author in candidate news coverage.', 'Reported for WGXA on the 2022 grand-jury investigation involving Macon Water Authority.'),
  ('e6a534a0-6ef3-4a22-8acc-35dff3ce06bb'::uuid, 'brant-bailey', 'Associate Member — Crawford County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Brant Bailey is listed as associate member with Crawford County at the Middle Georgia Regional Commission.'),
  ('37e443ee-57e7-4fdd-b78d-a6d45f5ecc99'::uuid, 'bre-anna-sheffield', 'Credited author in candidate news coverage.', '41NBC reporter with experience in reporting, editing, and digital media; a Fort Valley State University graduate.'),
  ('8efada63-b71c-47fc-a380-36428b77fc04'::uuid, 'bre-yanna-johnson', 'Director of Marketing and Strategic Partnerships — Big Brothers Big Sisters of the Heart of Georgia.
Source (reviewed October 23, 2026): https://bbbsga.org/our-team/', 'Director of marketing and strategic partnerships at Big Brothers Big Sisters of the Heart of Georgia.'),
  ('574164b3-17d1-487e-97cc-03dde9e50d33'::uuid, 'brenda-anthony', 'Listed as Custodian by Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Brenda Anthony is listed as Custodian by Highland Hills Baptist Church.'),
  ('574439cc-6a86-4e63-ab35-7b388e57f597'::uuid, 'brenda-usry', 'Listed as Financial Manager / Executive Administrative Assistant by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Brenda Usry is listed as Financial Manager / Executive Administrative Assistant by Ronald McDonald House of Central and Southwest Georgia.'),
  ('2dbf0a85-5e57-4ab7-be14-e03c6518c396'::uuid, 'brenda-youmas', 'Associate Judge and Magistrate — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'Brenda Youmas is listed as associate judge and magistrate with Bibb County Civil and Magistrate Court.'),
  ('275ad756-197f-423d-a97a-89b5d5d1f192'::uuid, 'brent-lanford', 'Chief Information Officer at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Chief Information Officer at the Middle Georgia Regional Commission.'),
  ('c86b91bd-5ad7-4320-972c-aa8168707f3c'::uuid, 'brianna-cook', 'Credited author in candidate news coverage.', 'Has contributed WGXA reporting on Georgia’s child-care costs and state policy.'),
  ('4e0d5dcc-ed1a-4826-ace5-3e8dedc277fc'::uuid, 'brittani-marks', 'Identified as Jones County Sheriff''s Office administrative coordinator in the February 2025 article. That title is historical; a later public professional profile describes a move into public information work.

Sources: https://www.gpb.org/news/2025/02/14/these-macon-laws-prohibit-homeless-camps-arrests-are-rare-heres-why ; https://www.linkedin.com/in/brittani-marks-1991-/', 'Works with the Jones County Sheriff’s Office, as identified in her public professional biography.'),
  ('0d475d37-c541-42a1-b2b7-ab048b9906da'::uuid, 'brittany-hadley', 'Finance Director — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Brittany Hadley is listed as finance director with Macon Housing Authority.'),
  ('43f7e38e-5d87-46b2-b405-9bfef633e7ee'::uuid, 'brooks-corwin', 'Development Associate — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Brooks Corwin is listed as development associate with Macon Arts Alliance.'),
  ('4f203f62-8406-4def-85a5-d0f693c20858'::uuid, 'bryan-nichols', 'Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Bryan Nichols is listed as board member with Main Street Macon Board.'),
  ('935bc07c-eb76-4aff-913d-c79c10484a48'::uuid, 'bryanna-hollis', 'Portfolio Manager — NewTown Macon. Portfolio Manager — NewTown Loans, LLC.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Bryanna Hollis is listed as portfolio manager with NewTown Macon.'),
  ('ecb8a797-07be-4416-9b72-7113098b3dca'::uuid, 'buddy-glawson', 'Listed as Director on the Board of Directors of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Buddy Glawson is listed as Director on the Board of Directors of Rescue Mission of Middle Georgia.'),
  ('2842e18d-4296-459b-a6ff-f7fb46898245'::uuid, 'caitlin-brown', 'Listed as Moderator by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).

Pastor / Minister of Service & Community at Highland Hills Baptist Church (listed by the church as Caitlin Childers Brown). Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Caitlin Brown is listed as Moderator by the Cooperative Baptist Fellowship of Georgia.'),
  ('0cde29fe-9c2d-4b3f-a8e2-d86196618ce7'::uuid, 'caleb-groves', 'Credited author in candidate news coverage.', 'Political reporter for The Atlanta Journal-Constitution covering voting, democracy, and state government.'),
  ('4b1a6ced-5cb9-48a3-b2b6-a2301b33374a'::uuid, 'caleb-slinkard', 'Credited author or contributor in coverage published by The Macon Melody.', 'Former managing editor of The Macon Melody who announced his departure for The New York Times in May 2025.'),
  ('68e42cd7-0bc7-420a-a5c6-ac8720968ebc'::uuid, 'cam-bishop', 'Listed as Organist by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Cam Bishop is listed as Organist by First Baptist Church of Christ at Macon.'),
  ('852a9ffa-3ebc-40bb-bc1c-a692ee9cdd7e'::uuid, 'cameron-schroeder', 'Listed as Intern by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).

Church Secretary / Ministry Associate at Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Cameron Schroeder is listed as Intern by the Cooperative Baptist Fellowship of Georgia.'),
  ('f938c92d-3ac5-4516-9f8c-04cbcecda0b5'::uuid, 'camille-kittrell', 'Listed as Bookkeeper by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Camille Kittrell is listed as Bookkeeper by First Baptist Church of Christ at Macon.'),
  ('f8a3d8c9-6fe8-4974-86db-c314eeb735a2'::uuid, 'candler-bennett', 'Controller — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Candler Bennett is listed as controller with NewTown Macon.'),
  ('37982c47-62ee-4342-a4e7-f723218c1eb3'::uuid, 'cara-heard', 'Listed as Events Manager by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Cara Heard is listed as Events Manager by Ronald McDonald House of Central and Southwest Georgia.'),
  ('8c7444fa-bd68-4abb-9802-bb55eb8a5179'::uuid, 'carl-tims', 'President and chief executive officer of United Way of Central Georgia, as listed in its current official staff directory.

Source: https://unitedwaycg.org/our-staff', 'President and chief executive officer of United Way of Central Georgia.'),
  ('f22766d5-3fb9-4436-a31b-9b943f4ae315'::uuid, 'carla-dillard-homer', 'Listed as Chief Operating Officer for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Chief operating officer for the American Red Cross Georgia Region, overseeing regional operations and resources.'),
  ('e4a600c1-5bb7-4726-9e7c-57177502872a'::uuid, 'carlos-mccloud', 'Non-public Member — Macon-Bibb County; Executive Committee, Macon-Bibb County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/', 'Carlos McCloud is listed as non-public member with Macon-Bibb County; Executive Committee, Macon-Bibb County at the Middle Georgia Regional Commission.'),
  ('198888fd-75ca-43a9-87c5-1f477ee1511f'::uuid, 'carolyn-crayton', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Carolyn Crayton is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('47112cf9-a52a-4490-ba3a-af779d8cd6d2'::uuid, 'carolyn-glover', 'Carolyn Glover is listed as president of the Pilot Club of Macon in the Georgia District of Pilot International''s 2023-24 club-president roster. This documents the historical leadership role; it does not establish the current officeholder.

Source: https://pilotgeorgia.org/wp-content/uploads/2023/08/ga-district-club-presidents-2023-24.pdf', 'Carolyn Glover is listed as president of the Pilot Club of Macon in the Georgia District of Pilot International''s 2023-24 club-president roster.'),
  ('d66eca81-64e9-48e3-9c81-b35d8662de42'::uuid, 'carrie-ingoldsby', 'VP for Student Affairs and Dean of Students — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Carrie Ingoldsby is listed as vice president for student affairs and dean of students with Wesleyan College.'),
  ('31664e1e-0933-4d65-8644-9543ed378686'::uuid, 'carrie-owen', 'Identified as Development Director serving the Salvation Army''s Central Georgia / Macon ministry. Source: https://www.salvationarmyusa.org/usa-southern-territory/georgia/central-georgia/red-kettle-sponsorship-program/ (reviewed October 23, 2026).', 'Identified as Development Director serving the Salvation Army''s Central Georgia / Macon ministry.'),
  ('cad07c97-4d52-4f77-b653-3fa04be964b5'::uuid, 'carrie-robinson', 'Board Member — Macon-Bibb County Design Review Board.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Carrie Robinson is listed as board member with Macon-Bibb County Design Review Board.'),
  ('ad69bb9a-c1d0-4818-be41-2d1092b51919'::uuid, 'casey-choung', 'Credited author of articles published by The Macon Telegraph.', 'Community reporter for The Macon Melody and a Boston University graduate.'),
  ('bfe6d1c9-09bb-4a59-bb85-f549a84ebb59'::uuid, 'casey-walker-jr', 'Operations Officer — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Casey Walker Jr. is listed as operations officer with Macon-Bibb County Emergency Management Agency.'),
  ('f10d8e51-3816-47c6-8b02-3b85985793dc'::uuid, 'cass-hatcher', 'Chief executive officer of River Edge Behavioral Health since February 2, 2023. His official biography describes leadership in behavioral-health services and supportive-housing development. CFCG''s 2026-27 roster also lists him on its executive committee with responsibility for Grants.

Sources: https://river-edge.org/about/message-from-the-ceo ; https://cfcga.org/about/board-of-directors/', 'Serves on the Community Foundation of Central Georgia’s 2026–27 executive committee, overseeing grants.'),
  ('c818f457-dc57-4524-bf28-6edb2e90709c'::uuid, 'cassandra-washington', 'Board Member — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Cassandra Washington is listed as board member with Macon-Bibb County Industrial Authority.'),
  ('6bfdda00-6b26-46b6-b3d2-612c972d7583'::uuid, 'cassidy-alexander', 'Credited author in candidate news coverage.', 'Education reporter for The Atlanta Journal-Constitution, previously with The Daytona Beach News-Journal.'),
  ('a4d9d245-159a-4faf-b21d-00342037d4c3'::uuid, 'cathy-barnes', 'Advocacy Coordinator — Central Georgia CASA.
Source (reviewed October 23, 2026): https://www.cgcasa.org/about', 'Cathy Barnes is listed as advocacy coordinator with Central Georgia CASA.'),
  ('6f83efd0-9007-4846-a87d-e9a6fad522ed'::uuid, 'cedrick-jenkins', 'Director of Sewer Conveyance — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Cedrick Jenkins is listed as director of sewer conveyance with Macon Water Authority.'),
  ('4367ebac-bf25-43c6-8a8a-e13c16d73bf7'::uuid, 'chad-harvey', 'Listed as Board Member at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Chad Harvey is listed as Board Member at Centenary Community Ministries, Inc.'),
  ('08e1b583-faed-4991-bf2f-9e9b4ec80e2e'::uuid, 'chad-tyler', 'Non-public Member — Monroe County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Chad Tyler is listed as non-public member with Monroe County at the Middle Georgia Regional Commission.'),
  ('1c516628-7968-406e-869c-7ced8f2cde9e'::uuid, 'chako-scott', 'Women’s Program Director — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Chako Scott is listed as women’s program director with Rescue Mission of Middle Georgia.'),
  ('bbf5fb21-1d17-433f-95c9-a68467428f70'::uuid, 'chante-drumgold', 'Chief Court Management Clerk — Bibb County Clerk of Superior Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/superior-court/clerk-of-superior-court/', 'Chante’ Drumgold is listed as chief court management clerk with Bibb County Clerk of Superior Court.'),
  ('cbe760bb-87c9-4b4f-9bcb-2ee425254391'::uuid, 'charise-stephens-merriweather', 'Board Member — Macon-Bibb County Pedestrian Safety Review Board. Director of Small Business Affairs — Macon-Bibb County Office of Small Business Affairs.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/pedestrian-safety-review-board-to-host-2026-safety-summit/ ; https://www.maconbibb.us/small-business-affairs/', 'Charise Stephens-Merriweather is listed as board member with Macon-Bibb County Pedestrian Safety Review Board.'),
  ('4838755d-db05-4b73-9c6f-a0a0157bd487'::uuid, 'charity-lucas', 'Bike Walk Macon''s education and engagement manager. She joined its staff in 2026 after volunteering on traffic-calming projects.

Source: https://www.bikewalkmacon.com/ourteam', 'Bike Walk Macon''s education and engagement manager.'),
  ('9838a34f-70cf-40fc-929c-9c71741f664a'::uuid, 'charla-ivey', 'Program Director — The Peyton Anderson Foundation.
Source (reviewed October 23, 2026): https://www.peytonanderson.org/about/staff/', 'Charla Ivey is listed as program director with The Peyton Anderson Foundation.'),
  ('3a4c000b-77e0-4ca8-a24f-81e8c1555c2c'::uuid, 'charles-gray', 'Non-public Member — Putnam County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Charles Gray is listed as non-public member with Putnam County at the Middle Georgia Regional Commission.'),
  ('3e4786df-fb2f-4d7c-a219-192cd541b5f3'::uuid, 'charles-ladson', 'Exhibits Manager — Museum of Arts and Sciences.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Charles Ladson is listed as exhibits manager with Museum of Arts and Sciences.'),
  ('f218652e-f3ad-4ab6-9a29-4a3a35b9be93'::uuid, 'charles-pope', 'Listed as Men''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Charles Pope is listed as Men''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('40426008-2f41-40a5-a9ae-500100c0eeab'::uuid, 'charlie-barton', 'Listed as Maintenance Supervisor by Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Charlie Barton is listed as Maintenance Supervisor by Highland Hills Baptist Church.'),
  ('c0aeb873-9877-4705-ad39-e3dafe78cee9'::uuid, 'charlie-griffis', 'Listed as Director on the Board of Directors of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Charlie Griffis is listed as Director on the Board of Directors of Rescue Mission of Middle Georgia.'),
  ('006d92d2-a5dd-4f62-8aca-9101d593c08c'::uuid, 'charlie-l-cantrell', 'Board Chairman — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Charlie L. Cantrell is listed as board chairman with Rescue Mission of Middle Georgia.'),
  ('e20cea75-00b0-48c7-8d6c-1721a15d6750'::uuid, 'charlotte-arline', 'Executive Assistant to CEO — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Charlotte Arline is listed as executive assistant to CEO with Macon Housing Authority.'),
  ('fbde127c-5d44-4212-89a8-d20c8afa9fc5'::uuid, 'cheferre-young', 'Chief Judge — Macon-Bibb County Juvenile Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/juvenile-court/', 'Chéferre Young is listed as chief judge with Macon-Bibb County Juvenile Court.'),
  ('b6ccca27-5f4a-45f5-9898-3d42874cb998'::uuid, 'chelsea-madden', 'Credited author of articles published by The Macon Telegraph.', 'Service journalism reporter for McClatchy, covering practical information for Middle Georgia readers.'),
  ('b015a617-9755-4e2c-8a28-c244efa961ef'::uuid, 'chenza-stokes', 'Project Manager — The Peyton Anderson Foundation.
Source (reviewed October 23, 2026): https://www.peytonanderson.org/about/staff/', 'Chenza Stokes is listed as project manager with The Peyton Anderson Foundation.'),
  ('b5fef66d-db23-402d-920c-464ee05f1fd5'::uuid, 'chloe-napier', 'Listed as Past Board President by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Chloe Napier is listed as Past Board President by Loaves and Fishes Ministry of Macon.'),
  ('da6889cb-3937-4a2c-8a39-70ddedc058c7'::uuid, 'chris-c-patterson', 'Chief Deputy — Bibb County Sheriff''s Office.

Sources (official rosters reviewed October 22, 2026): https://bibbsheriff.us/

Profile photo source: https://bibbsheriff.us/', 'Chris C. Patterson is listed as chief deputy with Bibb County Sheriff''s Office.'),
  ('7ad29d15-5c1e-4b54-b71e-5d2c439f0849'::uuid, 'chris-childers', 'Listed as Director, Community and Corporate Engagement by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Chris Childers is listed as Director, Community and Corporate Engagement by Ronald McDonald House of Central and Southwest Georgia.'),
  ('f2bd420b-c192-44bc-ae9b-0dfebceff1cb'::uuid, 'chris-floore', 'Macon-Bibb County''s chief communications officer, confirmed in an August 2026 county announcement. Quoted in the February 2025 homelessness article.

Sources: https://www.maconbibb.us/chris-floore-named-chief-communicator-of-the-year-by-national-public-relations-organization/ ; https://www.gpb.org/news/2025/02/14/these-macon-laws-prohibit-homeless-camps-arrests-are-rare-heres-why

Chief Communications Officer — Macon-Bibb County Office of Communications.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/communications/

Profile photo source: https://www.maconbibb.us/county-manager/chris-floore/', 'Macon-Bibb County''s chief communications officer, confirmed in an August 2026 county announcement.'),
  ('2a9496ee-8dc3-4304-a5f7-a868262532a6'::uuid, 'chris-howard', 'Secretary — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Chris Howard is listed as secretary with Keep Macon-Bibb Beautiful.'),
  ('04ccacea-4648-4a22-b7dd-4615101dacde'::uuid, 'chris-joyner', 'Credited author in candidate news coverage.', 'Politics editor at The Atlanta Journal-Constitution, with a background in investigative reporting and government ethics coverage.'),
  ('79b9707e-5098-4f9e-9e51-22440622f245'::uuid, 'chris-lones', 'Listed as Men''s Program Lead Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Chris Lones is listed as Men''s Program Lead Facilitator of Rescue Mission of Middle Georgia.'),
  ('f7e23ea7-7216-453a-adaa-1cf9ffef2829'::uuid, 'chris-mcguire', 'Secretary-Treasurer — Museum of Aviation Foundation.
Source (reviewed October 23, 2026): https://museumofaviation.org/about/leadership/board-of-directors/', 'Chris McGuire is listed as secretary-treasurer with Museum of Aviation Foundation.'),
  ('845be3af-7bff-4677-b73d-30c6b2d93927'::uuid, 'chris-r-sheridan', 'Listed as Director on the Board of Directors of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Chris R. Sheridan is listed as Director on the Board of Directors of Rescue Mission of Middle Georgia.'),
  ('91dd80ad-554a-4735-83f1-c98b33503782'::uuid, 'chris-snow', 'Listed as 2026 Board Secretary by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Chris Snow is listed as 2026 Board Secretary by Ronald McDonald House of Central and Southwest Georgia.'),
  ('d82a41c9-2c86-43bb-9a04-8f4e9d33c889'::uuid, 'christi-dykes', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Christi Dykes appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('b59554bb-c339-446a-9a70-687c745a8dca'::uuid, 'christie-johnson', 'Listed as Development Director by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-staff/ (verified October 23, 2026; the published roster does not specify a term date).', 'Christie Johnson is listed as Development Director by Jay''s HOPE Foundation.'),
  ('cf20430f-cbc5-46dc-9d9d-efd9452c77c8'::uuid, 'christina-porter', 'Listed as Development Assistant of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Christina Porter is listed as Development Assistant of Rescue Mission of Middle Georgia.'),
  ('54809261-a72d-49ca-b1c0-de90ce7b097f'::uuid, 'christopher-tsavatewa', 'Chair of the Macon-Bibb County Board of Health, holding its underserved and elderly advocate seat.

Source: https://northcentralhealthdistrict.org/board-of-health/', 'Chair of the Macon-Bibb County Board of Health, holding its underserved and elderly advocate seat.'),
  ('df59f879-5c65-486a-a0da-17065875dc49'::uuid, 'christy-henry', 'Executive Director — Family Counseling Center of Central Georgia.
Source (reviewed October 23, 2026): https://www.maconbibb.us/griefsupportsession41626/', 'Christy Henry is listed as executive director with Family Counseling Center of Central Georgia.'),
  ('60f10c19-7f55-4e1c-89da-16c9ea4034b4'::uuid, 'christy-iuliucci', 'Finance Director — Macon-Bibb County Finance Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/finance/meet-the-director/

Profile photo source: https://www.maconbibb.us/finance/meet-the-director/', 'Christy Iuliucci is listed as finance director with Macon-Bibb County Finance Department.'),
  ('14584e0d-b8ea-4dc8-9a95-801456b1796f'::uuid, 'christy-keeth', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('217d991f-c3d1-469c-85d3-dec5f3340751'::uuid, 'christy-price', 'Listed as Childcare Coordinator by Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Christy Price is listed as Childcare Coordinator by Highland Hills Baptist Church.'),
  ('6ba73216-1982-425a-adb7-15db3d76fbfe'::uuid, 'christy-scott', 'Director of Housing Services — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Christy Scott is listed as director of housing services with Macon Housing Authority.'),
  ('cbfaf994-c8a2-4a67-a7ed-8b9b7e35ec23'::uuid, 'cindy-gaskins', 'Listed as Executive Director by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-staff/ (verified October 23, 2026; the published roster does not specify a term date).', 'Cindy Gaskins is listed as Executive Director by Jay''s HOPE Foundation.'),
  ('ebcb62e8-eafd-45ce-b0ba-65861c79529b'::uuid, 'cindy-tengelsen', 'Office Manager — Macon-Bibb Citizen Advocacy.
Source (reviewed October 23, 2026): https://www.maconbibbcitizenadvocacy.org/contact-us/board-and-staff/', 'Cindy Tengelsen is listed as office manager with Macon-Bibb Citizen Advocacy.'),
  ('7827853e-1685-4d0b-af1a-a3e3131b1447'::uuid, 'claire-cox', 'Macon civic advocate and documented co-founder of Georgia Women (And Those Who Stand With Us), formed in 2017. Reporting describes the group''s advocacy on issues affecting women and families, including paid family leave. She was identified as its president in 2019; that historical title does not confirm a current office.

Sources: https://www.gpb.org/news/2018/03/08/women-in-georgia-and-across-the-nation-are-running-for-office-in-record-numbers ; https://www.gpb.org/news/2019/07/19/protesters-gather-in-macon-under-threat-of-ice-raids', 'Georgia Women leader involved in the 2017–18 effort to eliminate Georgia’s sales tax on menstrual products.'),
  ('b76dbeab-ceb8-4fe9-b066-e89d6bb2a82f'::uuid, 'claire-paris', 'Chief Medical Officer — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Chief Medical Officer — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Claire Paris is listed as chief medical officer with Piedmont Macon Medical Center.'),
  ('bf0d6d1b-c1ff-41e2-a041-7658956d37d0'::uuid, 'cleve-cunningham', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Cleve Cunningham is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('3931f603-12f9-4cb9-92e9-c5b741bd1c45'::uuid, 'connie-pursiful', 'Listed as Administrative Assistant by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Connie Pursiful is listed as Administrative Assistant by First Baptist Church of Christ at Macon.'),
  ('fe8507a4-eba0-479e-921e-1722f738f48e'::uuid, 'courtney-erikson', 'Board Vice President — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Courtney Erikson is listed as board vice president with Macon Milledgeville Regional Habitat for Humanity.'),
  ('0777cf49-2e4f-4c95-b02a-1f2f0b4b1cbb'::uuid, 'courtney-sinclair', 'Listed as Evening Manager by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Courtney Sinclair is listed as Evening Manager by Ronald McDonald House of Central and Southwest Georgia.'),
  ('e560058c-18f1-4aca-8b89-5342931e9ce1'::uuid, 'craig-mcmahan', 'Listed as Preacher-in-Residence by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Craig McMahan is listed as Preacher-in-Residence by First Baptist Church of Christ at Macon.'),
  ('3ce4a3f7-298a-4358-bb32-71f3a4ac0004'::uuid, 'craig-ross', 'Chief Executive Officer — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Profile photo source: https://mbcta.net/board/', 'Craig Ross is listed as chief executive officer with Macon-Bibb County Transit Authority.'),
  ('57513c83-ad98-4071-b0f7-57133b4725e9'::uuid, 'crystal-jones', 'Chief Judge — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'Crystal Jones is listed as chief judge with Macon-Bibb County Municipal Court.'),
  ('eea7b0c0-844a-4462-b54f-cb4bb3f361b1'::uuid, 'curtis-hertwig', 'Board treasurer and secretary of Bike Walk Macon, as listed on its current team page.

Source: https://www.bikewalkmacon.com/ourteam', 'Board treasurer and secretary of Bike Walk Macon.'),
  ('5a20803b-3a32-4aab-9e01-f288d6590891'::uuid, 'curtis-owens', 'Listed as Maintenance Assistant of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Curtis Owens is listed as Maintenance Assistant of Rescue Mission of Middle Georgia.'),
  ('c02830dc-01d3-4a58-aeac-71b1454746e4'::uuid, 'curtis-roundtree', 'Listed as Driver of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Curtis Roundtree is listed as Driver of Rescue Mission of Middle Georgia.'),
  ('05944966-040d-4999-b09c-f7e5967384b5'::uuid, 'cynde-m-dickey', 'Chair of the Community Foundation of Central Georgia''s 2026-27 executive committee. The official board roster lists her county as Crawford.

Source: https://cfcga.org/about/board-of-directors/', 'Chair of the Community Foundation of Central Georgia''s 2026-27 executive committee.'),
  ('6bd10d93-ad61-4e2d-bd95-71a60d4424b0'::uuid, 'cynthia-t-adams', 'Chief of Appeals — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Cynthia T. Adams is listed as chief of appeals with Macon Judicial Circuit District Attorney’s Office.'),
  ('f2151a5a-1294-4096-81be-e1f6114b1fb4'::uuid, 'd-elaine-fitzgerald', 'Human Resources Director — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'D. Elaine Fitzgerald is listed as human resources director with Macon-Bibb County Planning and Zoning Commission.'),
  ('45052500-267c-45a5-879e-016e6b3e3472'::uuid, 'dan-riley', 'Named in Rebuilding Macon''s published 2025 board roster as Board Secretary. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Dan Riley appears on Rebuilding Macon''s 2025 board roster as board secretary.'),
  ('88937b79-6887-4470-a804-346d9e19e273'::uuid, 'daniel-potter', 'Listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Daniel Potter is listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('86209346-9704-47e6-a38d-4240edd361af'::uuid, 'danielle-taylor', 'Listed as Board Treasurer at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Danielle Taylor is listed as Board Treasurer at Centenary Community Ministries, Inc.'),
  ('b6c23d2d-3e7e-4722-949f-a27be03ee72c'::uuid, 'darius-d-maynard', 'Director of Programs and Strategic Initiatives at the Community Foundation of Central Georgia, managing competitive grants and other initiatives and working with local nonprofits.

Source: https://cfcga.org/about/our-team/', 'Director of Programs and Strategic Initiatives at the Community Foundation of Central Georgia, managing competitive grants and other initiatives and working with local nonprofits.'),
  ('37e50528-53ec-48ad-be90-96b71a014382'::uuid, 'darrell-bridges', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Darrell Bridges is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('e26cb6a0-ce53-41b9-84cf-5b255312ca8d'::uuid, 'david-clance', 'Listed as Bargain Center Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'David Clance is listed as Bargain Center Manager of Rescue Mission of Middle Georgia.'),
  ('c6b7a61f-15ab-46db-a3ce-894d2238268e'::uuid, 'david-cozart', 'Public contact for the Kiwanis Club of Macon''s Teen Driving Roadeo, as listed on the program''s official contact page. This documented program role does not establish a club-wide officer title.

Source: https://www.maconteendrivingroadeo.com/contact.htm', 'Public contact for the Kiwanis Club of Macon''s Teen Driving Roadeo, as listed on the program''s official contact page.'),
  ('31effe83-a589-459d-ac90-3af549fdce8b'::uuid, 'david-danzie', 'Commissioner — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html

Board Chairman — Middle Georgia Community Food Bank.
Source (reviewed October 23, 2026): https://mgcfb.org/about-us/

2027 Festival Chair — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'David Danzie is listed as commissioner with Macon Housing Authority.'),
  ('89b563cf-b0d3-4e55-a855-d1560221f7f9'::uuid, 'david-gowan', 'Listed on the Macon-Bibb County Board of Health in its school superintendent/designee seat.

Source: https://northcentralhealthdistrict.org/board-of-health/', 'Listed on the Macon-Bibb County Board of Health in its school superintendent/designee seat.'),
  ('b4f1071a-185f-41e7-aba9-c6fc8555a64c'::uuid, 'david-hank-ashley', 'Sheriff and Constable of Civil and Magistrate Court — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'David Hank Ashley is listed as sheriff and constable of civil and magistrate court with Bibb County Civil and Magistrate Court.'),
  ('15cc4778-e82d-4a97-a31e-c6b3c4ee1932'::uuid, 'david-hollingsworth', 'Legal Counsel — Museum of Aviation Foundation.
Source (reviewed October 23, 2026): https://museumofaviation.org/about/leadership/board-of-directors/', 'David Hollingsworth is listed as legal counsel with Museum of Aviation Foundation.'),
  ('7bf74394-2fb8-4c7e-8452-b2d9c4164f0e'::uuid, 'david-mccain', 'Board Chair — Central Georgia CASA.
Source (reviewed October 23, 2026): https://www.cgcasa.org/about', 'David McCain is listed as board chair with Central Georgia CASA.'),
  ('518f750e-2ecb-46dc-92fd-d12b404fe77d'::uuid, 'david-sumrall', 'David Sumrall previously chaired the Bibb County Republican Party. The county officers page retains his earlier chair listing: https://bibb.gop/bibb-county-gop-officers/ . Michael Neisler is the current chair, as confirmed by the Civic Pulse administrator on October 22, 2026 and listed at https://www.gagop.org/bibb-county . Dates of Sumrall''s term have not been verified.', 'David Sumrall previously chaired the Bibb County Republican Party.'),
  ('51e0f71f-5d68-45f6-aa65-7e3a70ae3070'::uuid, 'david-wickert', 'Credited author in candidate news coverage.', 'Atlanta Journal-Constitution reporter covering the state budget, public finance, and voting issues.'),
  ('caecdee3-4ad8-4b44-9adb-f338146bf479'::uuid, 'dawn-burns', 'Vice President of Operations — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Dawn Burns is listed as vice president of operations with Rescue Mission of Middle Georgia.'),
  ('e5bc3154-91ef-4cc2-9b63-0e6e7a9f7b62'::uuid, 'dealvah-simms', 'Judge — Macon-Bibb County Juvenile Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/juvenile-court/', 'DeAlvah Simms is listed as judge with Macon-Bibb County Juvenile Court.'),
  ('8519c547-076e-4d8c-bc7a-2c75141489f1'::uuid, 'debbie-thomason', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('4669e433-4990-4c92-90e1-264f6d08b684'::uuid, 'deborah-macmillan', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Deborah MacMillan is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('21b2e980-774c-4a24-82ca-6490963e297f'::uuid, 'deborah-mallott', 'Sister Deborah Mallott is identified as director of Depaul USA Daybreak in February 2026 reporting. She succeeded Sister Theresa Sullivan in 2024.

Sources: https://www.wpganews.com/2026/02/27/macon-shelter-hosts-annual-sleepout-fundraiser-amid-rise-street-homelessness/ ; https://maconmelody.com/daybreaks-sister-theresa-touched-the-lives-of-macons-vulnerable/', 'Daughter of Charity with a background in social work, chaplaincy, and administering community and hospice programs in Kenya.'),
  ('877f5899-05ed-4f58-9176-9d84e98216e5'::uuid, 'debra-clapp', 'Listed as Financial Administrator at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Debra Clapp is listed as Financial Administrator at Centenary United Methodist Church.'),
  ('67d29fde-1394-41d7-a545-1642b5539f05'::uuid, 'debra-singleton', 'Listed as Board Secretary by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Debra Singleton is listed as Board Secretary by Loaves and Fishes Ministry of Macon.'),
  ('58b2edbf-2e6e-4e12-a58b-25f4a5727e9f'::uuid, 'denise-y-vanzant', 'IT and Office Manager — Tubman African American Museum.
Source (reviewed October 23, 2026): https://tubmanmuseum.com/museum-staff/', 'Denise Y. Vanzant is listed as IT and office manager with Tubman African American Museum.'),
  ('403c4d4f-9457-4889-ac6e-aad7f2480e23'::uuid, 'dennis-hasty', 'Listed as Transitional House / Community Garden Manager at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Manages Centenary Community Ministries’ transitional house and community garden, supporting residents in recovery.'),
  ('8b877a7f-07bc-49cd-86b8-b53d54214546'::uuid, 'derek-thomas', 'Executive Director — Rebuilding Macon.
Source (reviewed October 23, 2026): https://www.rebuildingmacon.org/team', 'Derek Thomas is listed as executive director with Rebuilding Macon.'),
  ('eb386353-d41f-4bd2-ab1e-4377375630f7'::uuid, 'devita-parnell', 'Listed as Congregational Life Chair by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Devita Parnell is listed as Congregational Life Chair by the Cooperative Baptist Fellowship of Georgia.'),
  ('7f133166-826e-49e5-b655-6c095c72e7dd'::uuid, 'diana-sutton', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Diana Sutton is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('b8411b00-e6fe-43d7-ba77-d87d331cf687'::uuid, 'dominique-johnson', 'Board Vice Chair — Community Partnership — Bibb County Family Connection.
Source (reviewed October 23, 2026): https://bibbcommunitypartnership.org/who-we-are/board/', 'Dominique Johnson is listed as board vice chair with Community Partnership.'),
  ('3ca2afdf-5219-49f8-97f0-bd01eebf610e'::uuid, 'don-carter', 'Non-public Member — Monroe County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Don Carter is listed as non-public member with Monroe County at the Middle Georgia Regional Commission.'),
  ('515dfe64-1f73-4793-9043-d44409da0227'::uuid, 'donna-lowry', 'Credited author in candidate news coverage.', 'Journalist and host of Georgia Public Broadcasting’s Lawmakers and Lawmakers: Beyond the Dome.'),
  ('8d3754d0-3a07-4946-8341-c8013af11d45'::uuid, 'douglas-r-pearson', 'VP and Dean of Students for Macon — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Douglas R. Pearson is listed as vice president and dean of students for Macon with Mercer University.'),
  ('405d05c4-a504-4de4-8127-96f6b542556e'::uuid, 'drew-kann', 'Credited author in candidate news coverage.', 'Enterprise reporter at The Atlanta Journal-Constitution covering climate and environmental issues.'),
  ('3d659ed6-8ed5-4630-be96-d9bceff1dc39'::uuid, 'dusty-fuller', 'Listed as Facilities Manager by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Dusty Fuller is listed as Facilities Manager by First Baptist Church of Christ at Macon.'),
  ('969db5fb-2edb-4886-b65a-8a507744a9dc'::uuid, 'dwight-frederick', 'VP of Business Operations and Finance / CFO — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Dwight Frederick is listed as vice president of business operations and finance / CFO with Wesleyan College.'),
  ('9251b22b-fd6c-448e-8c7e-f42f0df6f87c'::uuid, 'dylan-baldwin', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Dylan Baldwin appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('ee66ca0c-f515-4c2e-8dea-e3a97c28b68a'::uuid, 'dylan-bowden', 'Listed as Missions Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Dylan Bowden is listed as Missions Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('2bd3c404-cd01-4916-bbe4-3c9d01324f55'::uuid, 'earnestine-denise-wilson', 'Political Director of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Political Director of the Macon-Bibb Democratic Committee.'),
  ('1dd84c0c-0d54-4b0b-bd30-ae0e9b8764ce'::uuid, 'edna-ruiz', 'Public Relations Specialist — Macon-Bibb County Office of Communications.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/communications/', 'Edna Ruiz is listed as public relations specialist with Macon-Bibb County Office of Communications.'),
  ('03b421bd-fc92-4090-9a6b-fc8483aea91b'::uuid, 'eduardo-guerra', 'Administrative Assistant — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Eduardo Guerra is listed as administrative assistant with Macon-Bibb County Emergency Management Agency.'),
  ('843384e4-9692-406c-a253-08f288604222'::uuid, 'eliza-moore', 'Credited author in candidate news coverage.', 'Journalist whose reporting on housing, health, and Georgia politics has appeared in The Macon Newsroom.'),
  ('b309940b-a86a-4d4c-a1c3-dc8b0f969fd5'::uuid, 'elizabeth-hammock', 'Executive Director — Central Georgia CASA.
Source (reviewed October 23, 2026): https://www.cgcasa.org/about', 'Elizabeth Hammock is listed as executive director with Central Georgia CASA.'),
  ('4409ed0a-f3e0-4bdc-8dd5-2ed5c45defb0'::uuid, 'elizabeth-larkins', 'Chief Nursing Officer — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Chief Nursing Officer — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Elizabeth Larkins is listed as chief nursing officer with Piedmont Macon Medical Center.'),
  ('c95f30ac-a0b5-42c9-83ee-6dbde38c4469'::uuid, 'elizabeth-lott', 'Macon civic organizer identified as a co-founder of Macon Rising alongside Abby Aiello and She Keene when the coalition launched in early 2025. Its work includes civic education and collective action supporting democracy.

Source: https://maconmelody.com/?p=10671', 'Ordained minister, writer, and consultant who spent 25 years in congregational ministry and helps faith communities steward their buildings.'),
  ('b1daed17-70d7-426b-aa10-cb649939ddb7'::uuid, 'elizabeth-schorr', 'Listed as Marketing by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Elizabeth Schorr is listed as Marketing by Ronald McDonald House of Central and Southwest Georgia.'),
  ('f9de5ca8-cc50-4fb2-a09f-48e7cbf7e470'::uuid, 'ellie-johnson', 'Senior Outreach Manager — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Ellie Johnson is listed as senior outreach manager with Macon Milledgeville Regional Habitat for Humanity.'),
  ('57e52e5c-44d4-4e39-a2da-1e4f945d41db'::uuid, 'elliott-dunwody', 'Listed as Video Production at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Elliott Dunwody is listed as Video Production at Centenary United Methodist Church.'),
  ('a70418ca-7854-4175-97b8-f74c6361576a'::uuid, 'ember-bishop-bentley', 'Board Member — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Ember Bishop Bentley is listed as board member with Macon-Bibb County Industrial Authority.'),
  ('7c39ab0c-c1d8-417b-946e-c367b98463ae'::uuid, 'emily-allmond', 'Director of education and outreach at Historic Macon Foundation. Her listed responsibilities include education programs, marketing, membership, and serving as staff contact for Rose Hill Cemetery.

Source: https://historicmacon.org/contact', 'Director of education and outreach at Historic Macon Foundation.'),
  ('e44618cf-0be4-46e2-a4f4-97108a964266'::uuid, 'emily-hopkins', 'Executive director of Historic Macon Foundation, beginning February 2, 2026. Previously NewTown Macon''s vice president of external affairs and Main Street manager, she led downtown programming, partnerships, and engagement. Knight Foundation''s NewTown grantee story documents her earlier role.

Sources: https://historicmacon.org/contact ; https://www.41nbc.com/emily-hopkins-historic-macon-executive-director/ ; https://knightfoundation.org/articles/grantee-story/newtown-macon/', 'Executive director of Historic Macon Foundation, beginning February 2, 2026.'),
  ('cc496279-d558-4fbc-a621-388bf453e91c'::uuid, 'emily-jones', 'Credited author or contributor in coverage published by The Macon Melody.', 'WABE climate reporter covering environmental issues and environmental justice through a partnership with Grist.'),
  ('9c3da83b-1f67-4eaf-aa0d-2f7bd924ad0c'::uuid, 'emily-richardson-dion', 'Listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Emily Richardson-Dion is listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia.'),
  ('306b2963-316c-4610-950b-2437bb65ba93'::uuid, 'ereina-plunkett', 'Credited author in candidate news coverage.', 'Reported for WGXA on voter concerns during the 2022 Macon Water Authority runoff.'),
  ('4e4eace2-a38d-4563-bfb7-9f676e1b3ed0'::uuid, 'eric-hefner', 'Listed as treasurer of Macon Civic Club Inc. in ProPublica Nonprofit Explorer''s FY2025 filing record. The return was filed January 13, 2026. Current office has not been independently verified.

Source: https://projects.propublica.org/nonprofits/organizations/582087373', 'Stratford Academy alumnus recognized in 2017 for longstanding volunteer service to the school.'),
  ('a4fba3f9-93b0-4fc3-b735-2ca1440ac6c1'::uuid, 'eric-manson', 'Commissioner — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html', 'Eric Manson is listed as commissioner with Macon Housing Authority.'),
  ('fc063f54-da7b-4666-9765-b78ace75e99f'::uuid, 'erin-hawkins', 'Board President — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Erin Hawkins is listed as board president with Macon Arts Alliance.'),
  ('0488a70b-7b56-460c-bebf-00a756fc4f4a'::uuid, 'erin-keller', 'Chief of staff and vice president for development at NewTown Macon. Her work includes fundraising, grants, donor relationships, and Business Improvement District management. Knight Foundation''s NewTown Macon grantee story features her perspective on downtown revitalization.

Sources: https://newtownmacon.com/our-work/staff/ ; https://knightfoundation.org/articles/grantee-story/newtown-macon/

Chief of Staff and VP for Development — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Chief of staff and vice president for development at NewTown Macon.'),
  ('3f45371d-2ea1-4170-9432-af35deb1c0db'::uuid, 'ethan-brown', 'Listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).

Pastor / Minister of Care & Discipleship at Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Ethan Brown is listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia.'),
  ('3c37b080-5227-4b11-ab42-cd3fbf3c553f'::uuid, 'ethiel-garlington', 'Commissioner — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html', 'Ethiel Garlington is listed as commissioner with Macon Housing Authority.'),
  ('3178dbc6-c9c5-40a9-9dff-c7f391da733f'::uuid, 'eva-balkcom', 'Listed as Food Pantry Coordinator by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Eva Balkcom is listed as Food Pantry Coordinator by Loaves and Fishes Ministry of Macon.'),
  ('03eafdf9-65ea-4786-b19a-f6f5144918d6'::uuid, 'evelyn-davidson', 'Credited author or contributor in coverage published by The Macon Melody.', 'Features editor at The Macon Melody, previously a community reporter and editor of Christopher Newport University’s student newspaper.'),
  ('d7993dbf-a765-4f12-8063-2d2f6f200568'::uuid, 'everett-verner', 'Executive Director — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/our-purpose/

Profile photo source: https://maconlandbank.org/our-purpose/', 'Everett Verner is listed as executive director with Macon-Bibb County Land Bank Authority.'),
  ('a3459bea-a2f8-4f83-b0d6-e2c3b8983343'::uuid, 'felicia-parks', 'Vice President of Customer Care — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Felicia Parks is listed as vice president of customer care with Macon Water Authority.'),
  ('4bdd819a-cb98-4aae-a6fc-0e5e19c0c3c3'::uuid, 'fran-lugo-camera', 'Finance Director — Big Brothers Big Sisters of the Heart of Georgia.
Source (reviewed October 23, 2026): https://bbbsga.org/our-team/', 'Finance director at Big Brothers Big Sisters of the Heart of Georgia.'),
  ('604c48d3-e621-4054-9741-a3af49389dd2'::uuid, 'francis-butch-sementilli-iii', 'Zoning Director — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Francis Butch Sementilli III is listed as zoning director with Macon-Bibb County Planning and Zoning Commission.'),
  ('491cd5a4-ce66-496e-ad18-a422fd63a4bd'::uuid, 'frank-evans', 'Director of Maintenance — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Frank Evans is listed as director of maintenance with Macon Water Authority.'),
  ('4edcb8da-5ad0-40de-a148-d71d37f60199'::uuid, 'frank-malloy', 'Listed as Director on the Board of Directors of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Frank Malloy is listed as Director on the Board of Directors of Rescue Mission of Middle Georgia.'),
  ('82e1f94e-35b5-41e9-a4be-4d73ecb41007'::uuid, 'g-boone-smith-iv', 'Listed as secretary of Macon Civic Club Inc. in ProPublica Nonprofit Explorer''s FY2025 filing record under the name G Boone Smith IV. The return was filed January 13, 2026. Current office has not been independently verified.

Source: https://projects.propublica.org/nonprofits/organizations/582087373', 'Served on the Community Foundation of Central Georgia’s board, as documented in its 2018 Form 990.'),
  ('e8d46dad-7ddc-4cb2-8681-2908db69a904'::uuid, 'gabriel-kopp', 'Credited author of articles published by The Macon Telegraph.', 'Editorial intern at The Macon Melody, writing fact-check briefs and reporting projects after graduating from Mercer University in 2026.'),
  ('129e0bb3-8503-41e8-bc8e-a1ca51fb313d'::uuid, 'gail-mansfield', 'Director of Finance — The Peyton Anderson Foundation.
Source (reviewed October 23, 2026): https://www.peytonanderson.org/about/staff/', 'Gail Mansfield is listed as director of finance with The Peyton Anderson Foundation.'),
  ('ae08d37f-defa-4ea7-8590-43c7f25002f6'::uuid, 'garrett-l-williams', 'Scout Executive and CEO — Central Georgia Council, Scouting America.
Source (reviewed October 23, 2026): https://www.centralgeorgiacouncil.org/staff/

President — 100 Black Men of Macon-Middle Georgia.
Source (reviewed October 23, 2026): https://www.maconbibb.us/100-black-men-call-for-people-to-join-them-in-working-with-children/', 'Garrett L. Williams is listed as scout executive and CEO with Central Georgia Council, Scouting America.'),
  ('2dd1a2ca-ad77-4829-8f2c-9974a511e289'::uuid, 'garrett-reid', 'Listed as Regional Donor Services Executive for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Regional donor services executive for the American Red Cross Georgia Region, overseeing blood-drive operations.'),
  ('3236f04d-2140-4989-963f-9cac796ff1f6'::uuid, 'gary-sanders', 'Associate Member — Putnam County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Gary Sanders is listed as associate member with Putnam County at the Middle Georgia Regional Commission.'),
  ('4b182fb5-c924-4fc5-809d-dfe6417652f0'::uuid, 'gary-wheat', 'President and CEO — Visit Macon.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Gary Wheat is listed as president and CEO with Visit Macon.'),
  ('a48b7a86-21d4-4211-b4fc-1d7ba17e5d15'::uuid, 'gary-wilson', 'Project Manager — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Gary Wilson is listed as project manager with Macon-Bibb County Industrial Authority.'),
  ('e8c05b93-6f08-4bd2-bdff-4ac7ddd221f8'::uuid, 'gena-tripp', 'Credited author in candidate news coverage.', '41NBC reporter and Middle Georgia native whose interests include education, neighborhood development, and arts and culture.'),
  ('ca5cb31c-aafb-4001-b9f6-e292fe2fb90f'::uuid, 'george-crawley', 'Program Coordinator — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'George Crawley is listed as program coordinator with Keep Macon-Bibb Beautiful.'),
  ('8cde54b0-b205-4014-8d21-592e9acd5d58'::uuid, 'george-e-slappey', 'Non-public Member — Houston County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'George E. Slappey is listed as non-public member with Houston County at the Middle Georgia Regional Commission.'),
  ('4e860448-c769-4af7-8c44-7666a34ca43e'::uuid, 'george-mccommon', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'George McCommon is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('2888753c-c095-4dc5-87cf-ccd9b098f6de'::uuid, 'george-suarez', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'George Suarez is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('ff22eace-940c-4a51-9fbc-f9bb83b021ef'::uuid, 'george-thomas-jr', 'Board Member — Macon-Bibb County Design Review Board.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/

Director of Leasing & Office — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'George Thomas Jr. is listed as board member with Macon-Bibb County Design Review Board.'),
  ('93d415bd-bba7-4e41-864a-feec4c9959f3'::uuid, 'georgia-canipe', 'Chief financial officer of the Community Foundation of Central Georgia. A CPA, she oversees the foundation''s financial and administrative operations. Her CFCG biography also lists service on Historic Macon Foundation''s board.

Source: https://cfcga.org/about/our-team/', 'Chief financial officer of the Community Foundation of Central Georgia.'),
  ('50697eb8-1856-4e6f-ad0c-a447bc730d41'::uuid, 'gerald-carper', 'Listed as Organist by Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Gerald Carper is listed as Organist by Highland Hills Baptist Church.'),
  ('4721c28d-736a-4fe8-b82a-616689b5f182'::uuid, 'ginny-lane-sheridan', 'Curator — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Ginny Lane Sheridan is listed as curator with Macon Arts Alliance.'),
  ('5ab6dfa8-7c92-4bf5-b542-7e0f35d46ba1'::uuid, 'gloria-ruth-finney', 'Credited author in candidate news coverage.', 'Has contributed WGXA reporting on Georgia legislation and state policy.'),
  ('ec92e077-d82d-46f4-8e11-e7f0a07d26d1'::uuid, 'godfrey-hall', 'Credited author in candidate news coverage.', 'Has contributed local education and community reporting to 41NBC.'),
  ('e5c37bfa-c824-43ab-b22f-90ad3f6e2d47'::uuid, 'grace-howell', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Grace Howell appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('07b5e6b8-a7bf-410b-8a56-4a09f33166b7'::uuid, 'grant-blankenship', 'Credited author of articles published by The Macon Telegraph.', 'Georgia Public Broadcasting editor and reporter based in Macon.'),
  ('ab45f37e-e0dc-4e58-9ad2-c3fab4a2166b'::uuid, 'grant-herndon', 'Identified as a Macon-Bibb code-enforcement officer in the February 2025 article. Current employment is unverified.

Source: https://www.gpb.org/news/2025/02/14/these-macon-laws-prohibit-homeless-camps-arrests-are-rare-heres-why', 'Sergeant and sworn code-enforcement specialist with Macon-Bibb County’s Code Enforcement department.'),
  ('7093e4d8-b4dc-4f9a-9940-43c192aa89f5'::uuid, 'greg-bluestein', 'Credited author in candidate news coverage.', 'Chief political reporter at The Atlanta Journal-Constitution and cohost of its Politically Georgia podcast.'),
  ('318bba02-672d-4347-952f-b97ed62bd812'::uuid, 'greg-boike', 'Director of Planning and Public Administration at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Director of Planning and Public Administration at the Middle Georgia Regional Commission.'),
  ('4a7db785-82d7-47ba-a125-950b24aadcc8'::uuid, 'greg-brooks', 'Listed as Kitchen Supervisor of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Greg Brooks is listed as Kitchen Supervisor of Rescue Mission of Middle Georgia.'),
  ('7d5af2ec-2df1-4da4-9cd6-fe44df424590'::uuid, 'greg-maddox', 'Listed as Lawn Maintenance of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Greg Maddox is listed as Lawn Maintenance of Rescue Mission of Middle Georgia.'),
  ('6fb6662c-1ed3-40b2-b42e-960181231d21'::uuid, 'gregory-glover', 'Treasurer — Community Partnership — Bibb County Family Connection.
Source (reviewed October 23, 2026): https://bibbcommunitypartnership.org/who-we-are/board/', 'Gregory Glover is listed as treasurer with Community Partnership.'),
  ('853a82e8-2e19-492e-b9cd-bda7b4237d80'::uuid, 'gregory-l-brown', 'Planning Director — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/

Chair of the Macon-Bibb County Pedestrian Safety Review Board, identified as Greg Brown in county reporting.
Source: https://www.maconbibb.us/pedestrian-safety-summit-highlights-progress-partnerships-and-continued-work/', 'Gregory L. Brown is listed as planning director with Macon-Bibb County Planning and Zoning Commission.'),
  ('13d402da-14e0-40f9-8587-da8868ba491f'::uuid, 'gregory-turner', 'Second Vice Chair for Membership of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Second Vice Chair for Membership of the Macon-Bibb Democratic Committee.'),
  ('b93267aa-b550-4d4b-bf3d-f83a2dcb7d0b'::uuid, 'gwenette-westbrooks', 'Civil-rights leader also known as Gwen Westbrooks. Elected president of the Georgia NAACP State Conference in October 2025 after nearly 13 years leading the Macon branch. The current Georgia NAACP leadership page lists her as state president and identifies her Macon-Bibb branch affiliation.

Sources: https://www.georgianaacp.org/leadership ; https://www.41nbc.com/newly-elected-georgia-naacp-president-gwenette-westbrooks-outlines-goals/', 'President of the Georgia NAACP, whose work focuses on civil rights and civic engagement.'),
  ('962f08e0-0ed4-41b4-9dbe-3ad52773e5c3'::uuid, 'hal-greer', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Hal Greer is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('8dc6a700-53ee-4c31-ba19-573e37ecb52c'::uuid, 'haley-purvis', 'Digital Content Manager — NewTown Macon. Secretary & NewTown Macon Liaison — Downtown Macon Community Association.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/ ; https://newtownmacon.com/business-resources/dmca/', 'Haley Purvis is listed as digital content manager with NewTown Macon.'),
  ('81d0ebee-718d-484b-9612-3be8be29a0a9'::uuid, 'hannah-jett-theus', 'Director, Marketing and Fulfillment — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Hannah Jett Theus is listed as director, marketing and fulfillment with International Cherry Blossom Festival.'),
  ('1467dfbf-6e3d-4db9-b615-92900372e40a'::uuid, 'hannah-jones', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Coauthored The Telegraph’s reporting on how Bibb and Houston county residents voted in the November 2022 election.'),
  ('3572dc37-b570-4127-b60d-e8cc4bc0302e'::uuid, 'harold-blevins', 'Director of Information Technologies — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Harold Blevins is listed as director of information technologies with Macon Water Authority.'),
  ('805c9406-7467-4621-b953-58375481f67f'::uuid, 'harold-tessendorf', 'Listed as Missions Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Harold Tessendorf is listed as Missions Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('c17ef11f-9349-43d1-bd78-2aa2b5e33f9f'::uuid, 'harold-young', 'Executive Director and Special Events Manager — Tubman African American Museum.
Source (reviewed October 23, 2026): https://tubmanmuseum.com/museum-staff/', 'Harold Young is listed as executive director and special events manager with Tubman African American Museum.'),
  ('51c6312d-1ed0-4046-a388-2011f52b98ef'::uuid, 'harriet-steele', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Harriet Steele is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('85250cfb-a1b1-45ad-972c-8502e6386413'::uuid, 'harry-patel', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('4f68e919-fbd1-43b7-855c-597ae5137819'::uuid, 'heather-carmichael', 'Office Administrator — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Heather Carmichael is listed as office administrator with Macon-Bibb County Industrial Authority.'),
  ('c9b60a5a-af1f-466b-a30b-c2b71a9eb338'::uuid, 'henderson-carswell', 'Colonel — Bibb County Sheriff''s Office.

Sources (official rosters reviewed October 22, 2026): https://bibbsheriff.us/

Profile photo source: https://bibbsheriff.us/', 'Henderson Carswell is listed as colonel with Bibb County Sheriff''s Office.'),
  ('2055efbd-81e6-4321-a7c7-67699a493006'::uuid, 'henry-keating', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Coauthored The Telegraph’s reporting on how Bibb and Houston county residents voted in the November 2022 election.'),
  ('6e4a6592-4f96-48c5-825f-8b39389b65c5'::uuid, 'holly-hoyle', 'Interim Clerk of Court — State Court of Bibb County.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/state-court/', 'Holly Hoyle is listed as interim clerk of court with State Court of Bibb County.'),
  ('6d125c22-3757-4fa7-8e0d-b53bb4f4eb37'::uuid, 'holly-long', 'Listed as Executive Director for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Executive director of the American Red Cross Central Midwest Georgia chapter, with a background in tourism and community partnerships.'),
  ('7e5ffd43-8b97-4756-baae-f33bc6e3043e'::uuid, 'holly-reeves', 'Board Treasurer — Crisis Line & Safe House of Central Georgia.
Source (reviewed October 23, 2026): https://cl-sh.org/who-we-are/', 'Holly Reeves is listed as board treasurer with Crisis Line & Safe House of Central Georgia.'),
  ('1f0372b5-eaf7-477e-991f-e0ec8605e4ca'::uuid, 'holly-williams', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('58af7d5f-7973-4fd7-8f44-66b0dbec539e'::uuid, 'howard-chris-davis', 'Board Chairman — Museum of Aviation Foundation.
Source (reviewed October 23, 2026): https://museumofaviation.org/about/leadership/board-of-directors/', 'Chairman of the Museum of Aviation Foundation’s board of directors, retired from Northrop Grumman Defense Systems.'),
  ('96e602d5-a42b-4774-9b64-694b75b0afdb'::uuid, 'howard-holleman', 'Treasurer of the Community Foundation of Central Georgia''s 2026-27 executive committee. The official board roster lists his county as Bibb.

Source: https://cfcga.org/about/board-of-directors/', 'Treasurer of the Community Foundation of Central Georgia''s 2026-27 executive committee.'),
  ('cf3a5132-1e01-40f7-ac6b-1d114ba8e2dc'::uuid, 'hunter-godsey', 'Listed as Church Administrator by Mulberry Street United Methodist Church. Source: https://www.mulberrymethodist.org/our-staff (verified October 23, 2026).', 'Hunter Godsey is listed as Church Administrator by Mulberry Street United Methodist Church.'),
  ('29740a71-7f9f-451b-aede-fc823e872aac'::uuid, 'ike-e-mack', 'Board President — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'Ike E. Mack is listed as board president with Macon-Bibb County Economic Opportunity Council.'),
  ('07932dda-b718-400e-b07c-f807675edeeb'::uuid, 'isaac-campuzano', 'Business Development Officer — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Isaac Campuzano is listed as business development officer with NewTown Macon.'),
  ('6fd90ab5-60a2-4e09-9a4b-e41d96ac84fe'::uuid, 'isaac-grant', 'Board Vice President — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'Isaac Grant is listed as board vice president with Macon-Bibb County Economic Opportunity Council.'),
  ('40addf0d-a363-4870-9dd2-f24c0081f923'::uuid, 'ivey-hall', 'Executive Director — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Ivey Hall is listed as executive director with Macon Milledgeville Regional Habitat for Humanity.'),
  ('a6e6f202-a9aa-4fb4-9416-6d0d074cdff7'::uuid, 'j-r-olive', 'VP of Operations and Strategic Initiatives — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'J.R. Olive is listed as vice president of operations and strategic initiatives with Greater Macon Chamber of Commerce.'),
  ('599fefa4-25ee-425b-b139-8d8e54c9e73f'::uuid, 'jack-varnell', 'Listed as Senior Pastor by Mulberry Street United Methodist Church. Source: https://www.mulberrymethodist.org/our-staff (verified October 23, 2026).', 'Jack Varnell is listed as Senior Pastor by Mulberry Street United Methodist Church.'),
  ('6c3c39b6-9b91-4770-b123-2825555f064e'::uuid, 'jackie-curtis', 'Director of Programs — Big Brothers Big Sisters of the Heart of Georgia.
Source (reviewed October 23, 2026): https://bbbsga.org/our-team/', 'Director of programs at Big Brothers Big Sisters of the Heart of Georgia.'),
  ('7b7e6112-aa22-481e-97d1-8c8c57e4b6da'::uuid, 'jacob-patton', 'Named as a Macon-Bibb County Hospital Authority board member in April 16, 2026 reporting.

Source: https://maconmelody.com/who-runs-macons-biggest-hospital-the-answer-is-complicated/', 'CEO of All-State Electrical and a member of NewTown Macon’s board of directors.'),
  ('d5862ab0-55ca-4f33-9982-66a11223a62f'::uuid, 'jaime-kaplan', 'Listed as Special Events Coordinator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Jaime Kaplan is listed as Special Events Coordinator of Rescue Mission of Middle Georgia.'),
  ('f54888ba-f927-4dd1-bfba-5ecfb7ead377'::uuid, 'jake-hall', 'Former executive director of United Way of Central Georgia''s United to End Homelessness initiative. September 2026 GPB reporting confirms the program ended after grant funding expired and identifies Hall as heading Root Analytics, which conducted Macon''s 2026 homeless census.

Sources: https://www.unitedwaycg.org/news/dr-jake-hall-named-executive-director-united-end-homelessness ; https://www.gpb.org/news/2026/09/02/amid-downtown-business-concerns-macon-mulls-stricter-rules-for-the-homeless', 'Former executive director of United Way of Central Georgia''s United to End Homelessness initiative.'),
  ('3c80e2f7-a9ed-4162-a4ff-5a2504d333cb'::uuid, 'james-fritze', 'President and chief executive officer of NewTown Macon. A CPA, he joined NewTown as chief financial officer in 2018. His responsibilities include organizational leadership, planning, board management, and major grants and gifts. Bike Walk Macon''s team page also lists him on its advisory board.

Sources: https://newtownmacon.com/our-work/staff/ ; https://www.bikewalkmacon.com/ourteam

President and CEO — NewTown Macon. Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/ ; https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'President and chief executive officer of NewTown Macon.'),
  ('25a915ef-6895-47a4-b358-523e1c187332'::uuid, 'james-l-bumpus', 'Board Member — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'James L. Bumpus is listed as board member with Macon-Bibb County Economic Opportunity Council.'),
  ('380422c9-8040-445f-89c9-b8fd14e86c4e'::uuid, 'james-smith', 'Listed as Transitional House / Facilities Manager in Centenary''s church and community-ministry staff listings. Source: https://www.centenarymacon.org/our-team ; https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'James Smith is listed as Transitional House / Facilities Manager in Centenary''s church and community-ministry staff listings.'),
  ('f380c532-f1e2-4f81-b1b4-3b7f7b4a118a'::uuid, 'jamie-walden', 'Board Secretary — Crisis Line & Safe House of Central Georgia.
Source (reviewed October 23, 2026): https://cl-sh.org/who-we-are/', 'Jamie Walden is listed as board secretary with Crisis Line & Safe House of Central Georgia.'),
  ('dfb3d5f3-d8fb-4e5d-9bcf-6f812031ddc7'::uuid, 'jane-moore', 'Listed as Community Garden Contact by Mulberry Street United Methodist Church. Source: https://www.mulberrymethodist.org/serve (verified October 23, 2026).', 'Jane Moore is listed as Community Garden Contact by Mulberry Street United Methodist Church.'),
  ('6dec31d2-3340-44ea-90ca-3dd60505cb0d'::uuid, 'jane-wilson', 'Listed as Tutor by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-staff/ (verified October 23, 2026; the published roster does not specify a term date).', 'Jane Wilson is listed as Tutor by Jay''s HOPE Foundation.'),
  ('9f0e68a8-295d-400f-b68d-e8f1cf77c4d3'::uuid, 'janet-lawson', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Janet Lawson is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('745808f0-5930-4ea8-9d3c-03cce0a2aa60'::uuid, 'janet-wright', 'Listed as Executive Director by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Janet Wright is listed as Executive Director by Loaves and Fishes Ministry of Macon.'),
  ('6ead91d8-84fa-4140-a3fc-30356120b2d3'::uuid, 'janice-ross', 'Clerk of Commission — Macon-Bibb County Clerk of Commission.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/clerk-of-commission/meet-the-clerk/', 'Janice Ross is listed as clerk of commission with Macon-Bibb County Clerk of Commission.'),
  ('4451f3a0-ec71-4a50-a32a-39ad8d75d1c6'::uuid, 'janita-hickenbotham', 'Human Resources Director — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Janita Hickenbotham is listed as human resources director with Macon Housing Authority.'),
  ('06fc303b-13e8-4b28-87cf-36cb7121726c'::uuid, 'jaquana-barnes-mosley', 'Treasurer Elect — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Jaquana Barnes Mosley is listed as treasurer elect with Keep Macon-Bibb Beautiful.'),
  ('e6ebb615-1a56-4409-9e79-cf9a7990d832'::uuid, 'jarad-zellner', 'Director of Water Treatment — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Jarad Zellner is listed as director of water treatment with Macon Water Authority.'),
  ('f0aa7029-6cd8-4293-b323-3f8db0574909'::uuid, 'jason-beck', 'Vice President of Programs — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Jason Beck is listed as vice president of programs with Rescue Mission of Middle Georgia.'),
  ('937fd349-e887-4773-ba4c-bd9f63b1eb28'::uuid, 'jason-gaskins', 'Listed as Board President by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Jason Gaskins is listed as Board President by Jay''s HOPE Foundation.'),
  ('cec734fb-649c-4fbe-ab9e-9522bf09afe3'::uuid, 'jeane-easom', 'Commission Chairwoman — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Jeane Easom is listed as commission chairwoman with Macon-Bibb County Planning and Zoning Commission.'),
  ('3dccec6e-f578-4b7b-aafa-1a1391dea9a8'::uuid, 'jed-jessup', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Jed Jessup is listed as Board Member by Jay''s HOPE Foundation.'),
  ('2763bb10-c94d-4962-baf9-2489be796bea'::uuid, 'jef-flournoy', 'Listed as vice president of Macon Civic Club Inc. in ProPublica Nonprofit Explorer''s FY2025 filing record. The return was filed January 13, 2026. Current office has not been independently verified.

Source: https://projects.propublica.org/nonprofits/organizations/582087373', 'Serves on the Piedmont Grand Opera House’s board of directors in Macon.'),
  ('ceae376e-9acc-4402-8d20-3c0ab0f3bd92'::uuid, 'jef-fraley', 'Macon civic volunteer whose public professional profile lists service as president of the Kiwanis Club of Macon from October 2021 through September 2022. This is a historical leadership role and does not identify the current club president.

Source: https://www.linkedin.com/in/jefraley', 'Macon civic volunteer whose professional biography records service as Kiwanis Club of Macon president from 2021 to 2022.'),
  ('1832332b-d634-4cf5-bd0e-c0147c7aea3a'::uuid, 'jeff-amy', 'Credited author in candidate news coverage.', 'Associated Press statehouse reporter covering Georgia politics and state government.'),
  ('6e94077c-c1a2-4a0a-b628-2b831b88b1ec'::uuid, 'jeff-battcher', 'Board Chair — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html', 'Jeff Battcher is listed as board chair with Macon Housing Authority.'),
  ('141b3f21-ac1c-48f4-8477-dad1bfd47b44'::uuid, 'jeff-bruce', 'Director of Exhibitions — Tubman African American Museum.
Source (reviewed October 23, 2026): https://tubmanmuseum.com/museum-staff/', 'Jeff Bruce is listed as director of exhibitions with Tubman African American Museum.'),
  ('efaaad6d-c48e-4716-a4fe-cbbafad8bc27'::uuid, 'jeff-thompson', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Jeff Thompson is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('5b1d316e-2005-4b1b-901c-cb0ef2af6936'::uuid, 'jeffrey-c-ruggieri', 'Executive Director — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Jeffrey C. Ruggieri is listed as executive director with Macon-Bibb County Planning and Zoning Commission.'),
  ('8bd7fa7e-0367-4b89-9e74-03754bb58628'::uuid, 'jen-marshall', 'Director of Investor Relations — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Jen Marshall is listed as director of investor relations with Greater Macon Chamber of Commerce.'),
  ('76d8f7a0-c6f9-4766-897c-270e16ef08ce'::uuid, 'jennifer-adrien', 'Listed as 2026 Past Board Chair by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Jennifer Adrien is listed as 2026 Past Board Chair by Ronald McDonald House of Central and Southwest Georgia.'),
  ('a5a48cf2-7aa9-40ad-9237-15992eb714d5'::uuid, 'jennifer-bronner', 'Chief Financial Officer — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Jennifer Bronner is listed as chief financial officer with Greater Macon Chamber of Commerce.'),
  ('3898a904-13ea-40e2-9245-02ea9de15007'::uuid, 'jennifer-heleski', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Jennifer Heleski is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('1ab170d2-028c-490d-ad09-179a05b12390'::uuid, 'jennifer-roberts', 'Listed as 2026 Board Vice Chair by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Jennifer Roberts is listed as 2026 Board Vice Chair by Ronald McDonald House of Central and Southwest Georgia.'),
  ('9fe3b9a3-ed41-4cfb-8bac-7d44ed0a2c19'::uuid, 'jennifer-sellers', 'Financial and Family Services Manager — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Jennifer Sellers is listed as financial and family services manager with Macon Milledgeville Regional Habitat for Humanity.'),
  ('e2f0e82d-ef7e-4c4c-bc8b-9fe41da652e3'::uuid, 'jenny-o-neal', 'Director of Finance and Administration — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Jenny O’Neal is listed as director of finance and administration with International Cherry Blossom Festival.'),
  ('68b557a5-9c8a-4f0b-8b16-b63389fbf851'::uuid, 'jeremy-chisenhall', 'Credited author or contributor in coverage published by The Macon Telegraph.', 'Georgia editor for McClatchy, overseeing its Macon and Columbus newsrooms.'),
  ('624cf74c-6433-40e7-9533-3f16865645e7'::uuid, 'jeremy-johnson', 'Assistant Deputy Chief — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Jeremy Johnson is listed as assistant deputy chief with Macon Judicial Circuit District Attorney’s Office.'),
  ('47af64cf-05e2-450c-98b9-87130e74b88d'::uuid, 'jeremy-raines', 'Director of Outreach — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Jeremy Raines is listed as director of outreach with Macon Judicial Circuit District Attorney’s Office.'),
  ('0967c54f-2afa-47eb-b16e-fe7111f9366d'::uuid, 'jeremyah-foster', 'Communications Director of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Communications Director of the Macon-Bibb Democratic Committee.'),
  ('361dc7eb-2069-48aa-a91c-36f3a800e26d'::uuid, 'jerome-sinclair', 'Magistrate Judge — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'Jerome Sinclair is listed as magistrate judge with Bibb County Civil and Magistrate Court.'),
  ('8e802c01-1d08-4d78-b1f7-fd81719edbed'::uuid, 'jesse-fraga', 'Credited author of articles published by The Macon Telegraph.', 'Telegraph journalist whose work includes breaking news, crime, elections, and community accountability.'),
  ('a48c2a22-7780-49d3-bf46-8522146a3cb1'::uuid, 'jessica-asbell-oravec', 'Listed as Endowment Management Board Chair by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Jessica Asbell Oravec is listed as Endowment Management Board Chair by the Cooperative Baptist Fellowship of Georgia.'),
  ('f0a0a7e4-f4ac-449f-82dc-1e7cc6ccac42'::uuid, 'jessica-plante', 'Development Manager — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Jessica Plante is listed as development manager with Macon Housing Authority.'),
  ('cfbce0e7-3f6a-43e8-a5fd-8302c56c4a0f'::uuid, 'jessica-sizemore-deen', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Jessica Sizemore Deen is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('eaed1454-bf20-4d02-b148-fbd98299c33e'::uuid, 'jessica-tucker', 'Director of President’s Office and Trustee Relations — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Jessica Tucker is listed as director of president’s office and trustee relations with Wesleyan College.'),
  ('4dbda243-e095-4b00-84d2-4f0af4347e53'::uuid, 'jessica-walden', 'President and CEO — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Jessica Walden is listed as president and CEO with Greater Macon Chamber of Commerce.'),
  ('f176b83c-49f3-436c-9928-9d15c0ddbb1b'::uuid, 'jessie-boler', 'Listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Jessie Boler is listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('7c120708-0d08-4cff-934a-06d505fa5e33'::uuid, 'jill-deskins', 'Listed as Regional Volunteer Services Officer for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Regional volunteer services officer for the American Red Cross Georgia Region, supporting its volunteer network.'),
  ('904918e5-481f-4449-a9b8-b146ca4f9b26'::uuid, 'jill-vanderhoek', 'Executive Director — Community Partnership — Bibb County Family Connection.
Source (reviewed October 23, 2026): https://bibbcommunitypartnership.org/who-we-are/board/', 'Jill Vanderhoek is listed as executive director with Community Partnership.'),
  ('bf2d0fbf-6c69-4922-9ad0-29ce962d02aa'::uuid, 'jim-greenhouse', 'Executive Director — Museum of Arts and Sciences.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Jim Greenhouse is listed as executive director with Museum of Arts and Sciences.'),
  ('836ec619-3344-41ea-b929-0dea6acee4a7'::uuid, 'jim-manley', 'Board Treasurer — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Jim Manley is listed as board treasurer with Macon Milledgeville Regional Habitat for Humanity.'),
  ('ddaad83a-7231-4ef8-8d64-8ed2949692e5'::uuid, 'jim-montgomery', 'Executive Director — Macon-Bibb Mayor’s Literacy Alliance.
Source (reviewed October 23, 2026): https://www.maconbibb.us/literacy-week-macon-bibb-2026/', 'Jim Montgomery is listed as executive director with Macon-Bibb Mayor’s Literacy Alliance.'),
  ('9c7d69b6-20ea-44f2-94f0-dc187e610bff'::uuid, 'jim-tessmer', 'Macon Kiwanis member identified as club secretary in Mercer University Athletics'' staff biography. The biography says he joined the downtown Macon club in 1987 and served as lieutenant governor in 2000-01. The club website also lists his Mercer email. The secretary role is attributed to the undated biography; a current officer term has not been independently confirmed.

Sources: https://mercerbears.com/staff-directory/jim-tessmer/119 ; https://maconkiwanis.org/', 'Macon Kiwanis member identified as club secretary in Mercer University Athletics'' staff biography.'),
  ('ea90f008-40b7-4900-a9b4-60bed79f73f4'::uuid, 'jimmy-daniels', 'Chief Associate Judge — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'Jimmy Daniels is listed as chief associate judge with Bibb County Civil and Magistrate Court.'),
  ('3c9743c3-f7f6-4f45-b337-02c1d191e556'::uuid, 'joan-cabral', 'Listed as Front Desk at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Joan Cabral is listed as Front Desk at Centenary Community Ministries, Inc.'),
  ('85e3b79f-3848-4ab2-bc5c-440596e72d49'::uuid, 'joann-fowler', 'Resident Commissioner — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html', 'JoAnn Fowler is listed as resident commissioner with Macon Housing Authority.'),
  ('dc1ee34f-45cc-42ba-b3cc-98752efa90bf'::uuid, 'jody-claborn', 'Deputy Chief Appraiser — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/about-us', 'Jody Claborn is listed as deputy chief appraiser with Macon-Bibb County Board of Tax Assessors.'),
  ('9032d3cb-13e7-4a89-af97-7a5e5b6a7195'::uuid, 'jody-long', 'Listed as Director of Development by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Jody Long is listed as Director of Development by Ronald McDonald House of Central and Southwest Georgia.'),
  ('70e724b4-a20d-4fbf-abd9-3e5383eb5bd8'::uuid, 'joel-grist', 'Listed as Board President by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Joel Grist is listed as Board President by Loaves and Fishes Ministry of Macon.'),
  ('8a7fcbbe-0188-4f64-9360-c7e44cf5ab77'::uuid, 'john-a-patterson', 'Senior VP for University Advancement — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'John A. Patterson is listed as senior vice president for university advancement with Mercer University.'),
  ('d0ff4e3a-ddde-46fa-b841-c5bd254a5122'::uuid, 'john-colquitt', 'Listed as Men''s Program Intake Coordinator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'John Colquitt is listed as Men''s Program Intake Coordinator of Rescue Mission of Middle Georgia.'),
  ('0b2b499a-95df-4d71-a14e-f74fccfe660d'::uuid, 'john-hayes', 'Engineering Director — Macon-Bibb County Engineering Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/engineering/

Profile photo source: https://www.maconbibb.us/engineering/', 'John Hayes is listed as engineering director with Macon-Bibb County Engineering Department.'),
  ('24c3c3ec-70f2-4f57-b34f-eeb5c73d6ee1'::uuid, 'john-mckibben', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('34a1842c-da01-406a-9aa1-734cf770bccd'::uuid, 'johnnetta-anderson', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('d305c6f1-bb3e-40da-a085-69788beaed3c'::uuid, 'johnny-cohen', 'Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Johnny Cohen is listed as board member with Main Street Macon Board.'),
  ('25580be0-cae9-4bee-9b2e-fe26a1211bd3'::uuid, 'jolynn-allgood', 'Director of Human Resources — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Jolynn Allgood is listed as director of human resources with Wesleyan College.'),
  ('6a30503e-0767-4998-ad76-0ab2e5b38ff9'::uuid, 'jon-hawk', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Jon Hawk is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('7712a6fe-7506-4a5a-8426-3817d35825b3'::uuid, 'jonathan-adams', 'Board Member — Crisis Line & Safe House of Central Georgia.
Source (reviewed October 23, 2026): https://cl-sh.org/who-we-are/', 'Jonathan Adams is listed as board member with Crisis Line & Safe House of Central Georgia.'),
  ('a61fe149-2dda-4be8-9168-efc3abcbd1aa'::uuid, 'jonathan-barlow', 'Listed as Missions Team Chair by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Jonathan Barlow is listed as Missions Team Chair by the Cooperative Baptist Fellowship of Georgia.'),
  ('005b836e-3697-4b40-8259-e1fc67c76f07'::uuid, 'jonathan-shuster', 'Executive Committee Vice Chair — Downtown Macon Community Association.

Sources (reviewed October 23, 2026): https://newtownmacon.com/business-resources/dmca/', 'Jonathan Shuster is listed as executive committee vice chair with Downtown Macon Community Association.'),
  ('83b050ca-e288-49b9-bd27-899553ae1c31'::uuid, 'jordan-stevenson', 'Credited author in candidate news coverage.', 'WGXA digital executive producer and University of Georgia journalism graduate, previously a digital content producer at FOX28 in Savannah.'),
  ('f9b615e0-bc0a-476c-84a2-362c902df7d0'::uuid, 'joshua-harrison-williams', 'Credited author in candidate news coverage.', 'WGXA reporter and multimedia journalist, with prior internships in radio, sports broadcasting, and investigative journalism.'),
  ('5daad566-bc21-401e-b964-8f0462bd5eb4'::uuid, 'joveta-turner', 'Interim Human Resources Director — Macon-Bibb County Human Resources Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/human-resources/

Profile photo source: https://www.maconbibb.us/human-resources/', 'Joveta Turner is listed as interim human resources director with Macon-Bibb County Human Resources Department.'),
  ('58e549ff-e574-4551-b731-3b258d26fd07'::uuid, 'joy-carr', 'Associate Member — Jones County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Joy Carr is listed as associate member with Jones County at the Middle Georgia Regional Commission.'),
  ('948f9a2a-003e-4423-8628-55c763716fac'::uuid, 'joy-king', 'Listed as Board Vice President by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Joy King is listed as Board Vice President by Loaves and Fishes Ministry of Macon.'),
  ('c7722e85-5068-4240-9384-73c5c35a5af6'::uuid, 'juanita-grey', 'Board of Equalization Staff — Bibb County Clerk of Superior Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/superior-court/clerk-of-superior-court/', 'Juanita Grey is listed as board of equalization staff with Bibb County Clerk of Superior Court.'),
  ('be94939e-fe23-40a6-8226-949170fdfb16'::uuid, 'juawn-a-jackson', 'Parliamentarian of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Parliamentarian of the Macon-Bibb Democratic Committee.'),
  ('912dd36c-794a-4e32-ad15-6907b94ef73f'::uuid, 'judy-sherling', 'Associate Member — Twiggs County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Judy Sherling is listed as associate member with Twiggs County at the Middle Georgia Regional Commission.'),
  ('549c7757-b0d0-4ad5-a779-9f6fc4b7ef3d'::uuid, 'julia-adele-callahan', 'Julia Adele Callahan is a Macon small business owner, cofounder of Middle Georgia 4 Choice, and First Vice Chair of the Macon-Bibb Democratic Committee. She is running for Bibb County Democratic Party chair. She founded Dream Clean Housekeeping Company in 2023 and advocates for jail accountability, accessible elections, reproductive healthcare, and safe, inclusive schools.', 'First vice chair of the Macon-Bibb Democratic Committee, small business owner, and cofounder of Middle Georgia 4 Choice.'),
  ('2a8f55dd-9821-4a73-837e-c67ea05479cb'::uuid, 'julia-davis', 'Senior VP for Administration and Finance — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Julia Davis is listed as senior vice president for administration and finance with Mercer University.'),
  ('a1f97743-e213-46bd-8b92-ce7936bf0dd9'::uuid, 'julia-meredith', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Julia Meredith is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('30763714-8de4-4a4b-abc6-bb09ffd03c09'::uuid, 'julia-wood', 'Senior vice president of development and donor services at the Community Foundation of Central Georgia. She joined CFCG in 2008 and helps donors and advisors establish charitable funds.

Source: https://cfcga.org/about/our-team/', 'Senior vice president of development and donor services at the Community Foundation of Central Georgia.'),
  ('43c5da23-5a8e-4659-a6e9-f686ad679855'::uuid, 'julie-darragh', 'Listed as Board Member at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Julie Darragh is listed as Board Member at Centenary Community Ministries, Inc.'),
  ('e9334bc0-4e35-4aad-9316-553f6557bf23'::uuid, 'julie-long', 'Listed as Pastor by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Julie Long is listed as Pastor by First Baptist Church of Christ at Macon.'),
  ('d51539c1-8a60-4d56-b7d3-e535c1ad1e49'::uuid, 'julie-moore', 'Assistant County Manager for Macon-Bibb County. The county’s newer employee-recognition report uses this title; her older leadership biography describes budget and strategic planning responsibilities.

Sources: https://www.maconbibb.us/county-manager/julie-moore/ ; https://www.maconbibb.us/employeerecognition122222/

Profile photo source: https://www.maconbibb.us/county-manager/julie-moore/', 'Assistant County Manager for Macon-Bibb County.'),
  ('0e87ccd1-a4b7-4cbb-af3b-2b9fcdf0e0e8'::uuid, 'julie-wilkerson', 'Executive Director — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Julie Wilkerson is listed as executive director with Macon Arts Alliance.'),
  ('2bea306d-3225-4258-b491-a3acd260a2fc'::uuid, 'justin-hollingsworth', 'Legal Counsel — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Justin Hollingsworth is listed as legal counsel with Keep Macon-Bibb Beautiful.'),
  ('c21a3e58-528e-4967-8fa3-b3d54e9a9823'::uuid, 'justin-safley', 'Listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Justin Safley is listed as Congregational Life by the Cooperative Baptist Fellowship of Georgia.'),
  ('046620e0-d5cb-428c-8832-0f1330415c3f'::uuid, 'kaitlyn-harvey', 'Listed as Board Member at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Kaitlyn Harvey is listed as Board Member at Centenary Community Ministries, Inc.'),
  ('3742af3d-6c46-4a9f-87e8-e47ca2aef240'::uuid, 'kala-hunter', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Columbus Ledger-Enquirer reporter covering climate change and environmental news across Georgia.'),
  ('f9c37840-63c0-451e-9603-ca6d72e845fb'::uuid, 'karen-evans', 'Board Member — Bibb County Board of Elections.

Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Karen Evans is listed as board member with Bibb County Board of Elections.'),
  ('b2c7672a-5314-403f-97d7-b1dd182f9cf2'::uuid, 'karen-j-lambert', 'President and CEO — The Peyton Anderson Foundation.
Source (reviewed October 23, 2026): https://www.peytonanderson.org/about/staff/', 'Karen J. Lambert is listed as president and CEO with The Peyton Anderson Foundation.'),
  ('4e42d850-bd06-4d9a-8c90-41fa1623c6b1'::uuid, 'kari-willingham', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Kari Willingham is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('3c300192-db2d-4cbe-a3f8-b28bcfba610f'::uuid, 'karla-redding-andrews', 'Vice President and Executive Director — Otis Redding Foundation.
Source (reviewed October 23, 2026): https://www.maconbibb.us/macon-bibb-to-dedicate-otis-redding-way-in-honor-of-music-legend/', 'Karla Redding-Andrews is listed as vice president and executive director with Otis Redding Foundation.'),
  ('fd77b974-011a-4345-a30c-d366f68d36ba'::uuid, 'kate-kubesheski', 'Director of Wastewater Operations — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Kate Kubesheski is listed as director of wastewater operations with Macon Water Authority.'),
  ('49340176-cde5-424f-a85d-a46ddd5b83d7'::uuid, 'katharine-tucker', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Has contributed reporting and photography to The Telegraph’s coverage of Macon businesses and community life.'),
  ('f5a66b31-2892-4bfb-937e-c472b76e7b19'::uuid, 'katherine-eubanks', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Katherine Eubanks is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('bf0b01cc-6d20-470c-82c8-e9b321b1f7df'::uuid, 'kathleen-mathews', 'Chief Administrative Officer — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Kathleen Mathews is listed as chief administrative officer with Macon Housing Authority.'),
  ('dcb17d8b-dd1b-49c4-9eca-7abb07c74c36'::uuid, 'kathleen-matthews', '2026–2027 Board President — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Kathleen Matthews is listed as 2026–2027 board president with Macon Milledgeville Regional Habitat for Humanity.'),
  ('b1f6751c-eb16-488f-9d3b-9fd30c904ea8'::uuid, 'kathryn-d-kloepper', 'Chief of Staff — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Kathryn D. Kloepper is listed as chief of staff with Mercer University.'),
  ('6283aa11-364e-4c7f-9ebb-c486c4fb6004'::uuid, 'kathryn-epps', 'Associate Member — Twiggs County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Kathryn Epps is listed as associate member with Twiggs County at the Middle Georgia Regional Commission.'),
  ('d9ffacc8-9e01-44f1-ac9b-8d5edbfc2a00'::uuid, 'kathryn-h-dennis', 'President of the Community Foundation of Central Georgia. She joined CFCG in June 2002 and works with its board, staff, and donors to strengthen regional philanthropy.

Source: https://cfcga.org/about/our-team/', 'President of the Community Foundation of Central Georgia.'),
  ('ca296e66-31d8-4a8f-b584-ab9de876f6fa'::uuid, 'kathryn-w-gerhardt', 'Part-time Judge — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'Kathryn W. Gerhardt is listed as part-time judge with Macon-Bibb County Municipal Court.'),
  ('d76fa528-02c4-4584-80e2-b513363ea5fc'::uuid, 'kathy-mccollum', 'President and CEO — Middle Georgia Community Food Bank.
Source (reviewed October 23, 2026): https://mgcfb.org/wp-content/uploads/2026/10/MGCFB-Fall26-Newsletter-Final2_new.pdf', 'Kathy McCollum is listed as president and CEO with Middle Georgia Community Food Bank.'),
  ('1e06bdd6-aa8f-40ee-abd2-95ac3f99db00'::uuid, 'katie-hart', 'Director of Operations — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Katie Hart is listed as director of operations with International Cherry Blossom Festival.'),
  ('d2bdbd77-668d-4169-a4f1-ae8e9d31d714'::uuid, 'katie-leslie', 'Credited author in candidate news coverage.', 'Has contributed reporting on Atlanta government and campaign fundraising to The Atlanta Journal-Constitution.'),
  ('9cef2ea7-18d8-4c48-b282-11c26d3ece9f'::uuid, 'kay-hall', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Kay Hall is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('ece65182-4133-4a68-9e38-e6fd3e142dc1'::uuid, 'kay-mcgiboney', 'Associate Member — Baldwin County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Kay McGiboney is listed as associate member with Baldwin County at the Middle Georgia Regional Commission.'),
  ('2dabc2b2-aa8e-40d7-abfa-eb6470dea914'::uuid, 'kaylee-pruitt', 'Executive director of Bike Walk Macon, appointed effective May 20, 2026. Previously its education and engagement manager.

Source: https://www.bikewalkmacon.com/blog/bike-walk-macon-names-kaylee-pruitt-as-new-executive-director

Executive Committee Chair — Downtown Macon Community Association.

Sources (reviewed October 23, 2026): https://newtownmacon.com/business-resources/dmca/', 'Executive director of Bike Walk Macon, supporting safer walking and bicycling in the community.'),
  ('b8d1388f-1dbc-4b8b-9125-36aaaea9b0d4'::uuid, 'keith-e-howard', 'Vice Provost — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Keith E. Howard is listed as vice provost with Mercer University.'),
  ('8a147cb5-1346-4b02-9670-5f30ff517b8a'::uuid, 'keith-moss', 'Listed as Maintenance Supervisor of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Keith Moss is listed as Maintenance Supervisor of Rescue Mission of Middle Georgia.'),
  ('11ca9db8-57be-4359-9a20-2665044dd4c0'::uuid, 'keith-smallwood', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Keith Smallwood is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('5da703d5-d11e-4205-a51e-61cb1c07a241'::uuid, 'kelda-cubit', 'Credited author or contributor in coverage published by The Macon Melody.', 'Macon resident who wrote to The Macon Melody advocating continued insurance protections for dialysis patients.'),
  ('60545a37-9406-49fb-95bc-bc1c0c0bdbf5'::uuid, 'kellie-r-appel', 'Senior VP for Strategic Initiatives — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Kellie R. Appel is listed as senior vice president for strategic initiatives with Mercer University.'),
  ('98f14b4d-229f-451e-81d9-621af5b93f9b'::uuid, 'kelsey-dixon', 'Listed as Team Ronald McDonald House Coordinator by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Kelsey Dixon is listed as Team Ronald McDonald House Coordinator by Ronald McDonald House of Central and Southwest Georgia.'),
  ('bb7eb683-ee1f-4aa3-82cd-225489879983'::uuid, 'kema-bishop', 'Residential Appraisal Manager — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/about-us', 'Kema Bishop is listed as residential appraisal manager with Macon-Bibb County Board of Tax Assessors.'),
  ('a75d0e67-698d-44b0-820b-e1694db7687e'::uuid, 'ken-burgamy', 'Listed as Communications by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Ken Burgamy is listed as Communications by Ronald McDonald House of Central and Southwest Georgia.'),
  ('b07905bb-27a9-482e-aea0-84b91f24d46d'::uuid, 'kendra-russell', 'Treasurer — Macon-Bibb Citizen Advocacy.
Source (reviewed October 23, 2026): https://www.maconbibbcitizenadvocacy.org/contact-us/board-and-staff/

Board Chair — Community Partnership — Bibb County Family Connection.
Source (reviewed October 23, 2026): https://bibbcommunitypartnership.org/who-we-are/board/', 'Kendra Russell is listed as treasurer with Macon-Bibb Citizen Advocacy.'),
  ('d37da69e-9f14-47c0-ad24-f0c265b6b657'::uuid, 'kenika-gore', 'Listed as Housekeeping by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Kenika Gore is listed as Housekeeping by Ronald McDonald House of Central and Southwest Georgia.'),
  ('a97674b9-04df-41d4-986b-ba3b855226ac'::uuid, 'kenisha-jackson', 'Clerk of the Magistrate Court — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'Kenisha Jackson is listed as clerk of the magistrate court with Bibb County Civil and Magistrate Court.'),
  ('8bec588e-33d7-4c1d-a911-a759933c8b2e'::uuid, 'keondria-wimberly', 'Listed as Assistant Director, Programs & Services by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Keondria Wimberly is listed as Assistant Director, Programs & Services by Ronald McDonald House of Central and Southwest Georgia.'),
  ('d6f8cfa5-041a-4558-9439-547cbf8d638e'::uuid, 'kerry-dunaway', 'Non-public Member — Crawford County; Council Secretary (2026–27); Executive Committee; Budget, Audit and Personnel Committee at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/', 'Kerry Dunaway is listed as non-public member with Crawford County; Council Secretary (2026–27); Executive Committee; Budget, Audit and Personnel Committee at the Middle Georgia Regional Commission.'),
  ('b24a3af6-c383-46b5-a23a-1b43d4088b7a'::uuid, 'kevin-bryant', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Kevin Bryant is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('5e4f0853-ce3e-4ce7-b9dd-bdc9a83507ad'::uuid, 'kevin-t-brown', 'Partner, Seyfarth Shaw LLP; listed on authority team — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Kevin T. Brown is listed as partner, seyfarth shaw llp; listed on authority team with Macon-Bibb County Industrial Authority.'),
  ('6c775fa3-7ebf-473b-9821-4c188fcb1c1a'::uuid, 'khaia-gibson', 'Marketing and Outreach Manager — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/our-purpose/

Profile photo source: https://maconlandbank.org/our-purpose/', 'Khaia Gibson is listed as marketing and outreach manager with Macon-Bibb County Land Bank Authority.'),
  ('18602ff7-386f-4114-be8d-c54fb1df8133'::uuid, 'kiia-jackson-appling', 'Listed as Men''s Division Case Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Kiia Jackson-Appling is listed as Men''s Division Case Manager of Rescue Mission of Middle Georgia.'),
  ('25d8724d-fa16-4ae2-adce-b9dadc17eb4c'::uuid, 'kim-cook', 'Physician serving as North Central Health District''s health director. His appointment took effect July 1, 2025.

Source: https://northcentralhealthdistrict.org/north-central-health-district-welcomes-dr-kim-cook-as-new-district-health-director/', 'Physician serving as North Central Health District''s health director.'),
  ('43f56fbc-59d2-480c-981c-42c6061524f9'::uuid, 'kim-stanton', 'Executive Assistant at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Executive Assistant at the Middle Georgia Regional Commission.'),
  ('4a0c5b0e-0627-4ea1-9c5c-86ff55346695'::uuid, 'kimberly-silvey', 'Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Kimberly Silvey is listed as board member with Main Street Macon Board.'),
  ('da814db4-7d98-490b-81e9-4a3b7d80c5da'::uuid, 'kristen-mathis', 'Listed as Coordinating Council, At Large by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Kristen Mathis is listed as Coordinating Council, At Large by the Cooperative Baptist Fellowship of Georgia.'),
  ('a9d3dc49-08c7-45cf-a84f-119ee7f0faf2'::uuid, 'kristi-swartz', 'Credited author in candidate news coverage.', 'Contributing writer for The Atlanta Journal-Constitution covering climate change and its effects on everyday life.'),
  ('fc9c8dfb-ed2f-4435-917b-93d305894c1b'::uuid, 'kristie-brown', 'Commission Clerk — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Kristie Brown is listed as commission clerk with Macon-Bibb County Planning and Zoning Commission.'),
  ('a14247b8-a90a-461e-bd78-1f8a609e542e'::uuid, 'kristie-jones', 'Museum Manager — Museum of Arts and Sciences.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Kristie Jones is listed as museum manager with Museum of Arts and Sciences.'),
  ('7ec8c6c4-a6a7-4d71-a0af-20f203ce8968'::uuid, 'kyle-goss', 'Associate Member — Pulaski County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Kyle Goss is listed as associate member with Pulaski County at the Middle Georgia Regional Commission.'),
  ('d9da3398-f65b-4ef3-8260-b30875a058b9'::uuid, 'kyle-owenby', 'Chief of Staff — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Kyle Owenby is listed as chief of staff with Macon Judicial Circuit District Attorney’s Office.'),
  ('b6093b02-e535-47fd-b033-39be16953647'::uuid, 'kyle-patat', 'Listed as Barn Center Operations Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Kyle Patat is listed as Barn Center Operations Manager of Rescue Mission of Middle Georgia.'),
  ('8855e7c9-1ce7-4e85-9864-658f86793760'::uuid, 'kyle-swicord', 'Associate Member — Wilkinson County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Kyle Swicord is listed as associate member with Wilkinson County at the Middle Georgia Regional Commission.'),
  ('e875e101-1b20-4229-b565-c6c2f05ae17a'::uuid, 'lacey-davis', 'Listed as Women''s Program Intake Coordinator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Lacey Davis is listed as Women''s Program Intake Coordinator of Rescue Mission of Middle Georgia.'),
  ('074fddde-320f-4d1d-a144-081bbbd5b20c'::uuid, 'laconstance-smith', 'Board Treasurer — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'LaConstance Smith is listed as board treasurer with Macon-Bibb County Economic Opportunity Council.'),
  ('4ef020af-112d-4354-8ac5-640964952fb4'::uuid, 'lakenya-drayton', 'Listed as Senior Volunteer Services Specialist for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Senior volunteer services specialist for the American Red Cross Central Midwest Georgia chapter.'),
  ('7808cf0c-9e38-48fb-b0d2-fe5e8c0293a8'::uuid, 'lally-weaver', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Lally Weaver is listed as Board Member by Jay''s HOPE Foundation.'),
  ('3d95f55e-85e4-448a-9d28-a3366e125050'::uuid, 'larry-brumley', 'Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Larry Brumley appears on the published roster as board member with Downtown Macon Business Improvement District Board of Directors.'),
  ('3028969f-1d2c-4da1-9a90-141be9d104df'::uuid, 'larry-crumbley', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Larry Crumbley appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('2bee7087-dbad-41bf-961b-a740ac73291f'::uuid, 'lars-lonnroth', 'Credited author in candidate news coverage.', 'Journalist whose reporting for The Mercer Cluster included campus affairs and Macon community issues.'),
  ('aa049b6c-6044-4210-9d4d-9e06f63e53f2'::uuid, 'lateefah-conner', 'Executive Committee Membership Chair — Downtown Macon Community Association.

Sources (reviewed October 23, 2026): https://newtownmacon.com/business-resources/dmca/', 'Lateefah Conner is listed as executive committee membership chair with Downtown Macon Community Association.'),
  ('2ac81b43-3b71-43a6-b591-cf79f1600433'::uuid, 'latonya-slaughter', 'Chief Clerk and Court Director — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'LaTonya Slaughter is listed as chief clerk and court director with Macon-Bibb County Municipal Court.'),
  ('bf56f347-28ef-425d-8d24-1e8cdc646908'::uuid, 'latresa-white', 'Identified as Social Service Director (partner directory) serving the Salvation Army''s Central Georgia / Macon ministry. Source: https://www.unitedwaycg.org/ProgramPartners (reviewed October 23, 2026).', 'Identified as Social Service Director (partner directory) serving the Salvation Army''s Central Georgia / Macon ministry.'),
  ('7a8571e4-3b5c-411c-a2b9-845152f5ea10'::uuid, 'laura-corley', 'Credited author or contributor in coverage published by The Macon Melody.', 'Senior Macon Melody reporter focused on accountability journalism, with more than a decade of Georgia news experience.'),
  ('e45ed7d7-03e8-43c2-8ddc-fe445e94a910'::uuid, 'laura-hardwick', 'Procurement Director — Macon-Bibb County Procurement Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/procurement/', 'Laura Hardwick is listed as procurement director with Macon-Bibb County Procurement Department.'),
  ('e30ff47a-6f46-4c86-a19f-32a4908eac14'::uuid, 'laura-m-mathis', 'Executive Director; ex-officio Council Treasurer (2026–27) at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/ ; https://www.middlegeorgiarc.org/about-us/mission-values/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/

Profile photo source: https://www.middlegeorgiarc.org/about-us/mission-values/', 'Executive Director; ex-officio Council Treasurer (2026–27) at the Middle Georgia Regional Commission.'),
  ('392da000-5988-4621-a537-7fe616f50a7d'::uuid, 'laura-pounds', 'Listed as Financial Administrator at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Laura Pounds is listed as Financial Administrator at Centenary Community Ministries, Inc.'),
  ('b4ea803e-cc40-4118-bae8-1a2698de6547'::uuid, 'laura-sugg', 'Listed as Children & Disability Coordinator at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Laura Sugg is listed as Children & Disability Coordinator at Centenary United Methodist Church.'),
  ('06c47a3e-63e7-4e9a-93ef-bb662069df64'::uuid, 'lauren-barber', 'Chair — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Lauren Barber is listed as chair with Main Street Macon Board.'),
  ('e98fcf66-bc55-4d2f-874f-10b930dce236'::uuid, 'lauren-mauldin-marshall', 'Board Member — Macon-Bibb County Design Review Board.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/

Vice President of Community Development — NewTown Macon. Leads NewTown Loans — NewTown Loans, LLC.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Lauren Mauldin Marshall is listed as board member with Macon-Bibb County Design Review Board.'),
  ('b9df0f15-19ca-4736-ab4d-548110ce9e25'::uuid, 'lauren-roan-parks', 'Board Treasurer — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Lauren Roan-Parks is listed as board treasurer with Macon Arts Alliance.'),
  ('f2b766cd-54c2-46af-8ee8-0cbf8bb32185'::uuid, 'laurie-fickling', 'Treasurer — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Laurie Fickling is listed as treasurer with Keep Macon-Bibb Beautiful.'),
  ('9193ca2e-a4db-4f34-b256-973dcac55ca9'::uuid, 'lauryn-dawson', 'Group Tour Coordinator and Collections Manager — Museum of Arts and Sciences.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Lauryn Dawson is listed as group tour coordinator and collections manager with Museum of Arts and Sciences.'),
  ('e2290559-8f21-4f09-83ab-c60a1b47ef79'::uuid, 'leah-kincaid', 'Credited author in candidate news coverage.', 'Reported for WGXA on Bárbara Rivera Holmes becoming Georgia’s labor commissioner in 2025.'),
  ('bd7ad379-eabf-4e35-95bb-92d5d924241c'::uuid, 'leanna-morris', 'Listed as Pricing and Processing Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Leanna Morris is listed as Pricing and Processing Manager of Rescue Mission of Middle Georgia.'),
  ('5de35255-95b6-4418-8a51-84351b53c800'::uuid, 'lee-gerdes', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('e8577c40-53f6-4d6e-a211-a481a6e2d4be'::uuid, 'lee-malone-ii', 'Listed as Community Disaster Program Specialist for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Community disaster program specialist for the American Red Cross Central Midwest Georgia chapter.'),
  ('b9721d53-1a4f-47ab-bd31-72fb90da3e3d'::uuid, 'legena-bolton', 'Director of Human Resources — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Legena Bolton is listed as director of human resources with Macon Water Authority.'),
  ('f51f8dfb-8650-4d35-8e55-1f900756434c'::uuid, 'lisa-hays', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Lisa Hays is listed as Board Member by Jay''s HOPE Foundation.'),
  ('5e21e47d-214f-41a7-a6f1-783c40a12908'::uuid, 'lisa-knight', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Lisa Knight appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('f2456ea9-10a2-4941-b659-717699c50049'::uuid, 'lisa-m-lundquist', 'Executive VP for Academic Affairs and Provost — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Lisa M. Lundquist is listed as executive vice president for academic affairs and provost with Mercer University.'),
  ('0650a126-f04b-4977-8ca9-f13d9facac1b'::uuid, 'liz-fabian', 'Credited author in candidate news coverage.', 'Civic journalism senior fellow at The Macon Newsroom and a veteran multimedia journalist covering Middle Georgia.'),
  ('3a7e12ef-b990-4de6-a639-ff9848174184'::uuid, 'liz-marin', 'Listed as Processing Supervisor of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Liz Marin is listed as Processing Supervisor of Rescue Mission of Middle Georgia.'),
  ('b10e1206-958a-4d69-8ebc-5600932a9d76'::uuid, 'lonnie-miley', 'Chief Deputy Coroner — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Lonnie Miley is listed as chief deputy coroner with Bibb County Coroner’s Office.'),
  ('eed7d4a6-902e-449d-b640-63c0d6e5712b'::uuid, 'lori-johnson', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Lori Johnson is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('ffd07c9c-cb28-4e92-95a3-267c7078e054'::uuid, 'lorra-lynch-jones', 'President and CEO — Museum of Aviation Foundation.
Source (reviewed October 23, 2026): https://museumofaviation.org/about/leadership/board-of-directors/', 'Lorra Lynch Jones is listed as president and CEO with Museum of Aviation Foundation.'),
  ('ca250050-fb14-406e-a2a6-21e906f4a5e6'::uuid, 'luann-stone', 'Deputy Coroner — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Luann Stone is listed as deputy coroner with Bibb County Coroner’s Office.'),
  ('27507fca-dc62-4996-b989-f76d0e44354b'::uuid, 'lucinda-warnke', 'Credited author of articles published by The Macon Telegraph.', 'Former Telegraph journalist whose work includes local government, housing, and community reporting.'),
  ('02277c6d-1066-411e-9dba-acb5e3115cb3'::uuid, 'luke-eady', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Luke Eady is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('d45a2f20-e33d-45c2-b40e-56edd85b7525'::uuid, 'luke-lindsey', 'Listed as Regional Chief Development Officer for the American Red Cross Georgia Region. Source: https://www.redcross.org/local/georgia/about-us/leadership.html (verified October 23, 2026).', 'Regional chief development officer for the American Red Cross Georgia Region, with a background in nonprofit fundraising.'),
  ('6c27b9dc-b022-46c6-9d54-f61ea6bff823'::uuid, 'lynn-murphey', 'Macon community and philanthropic leader listed as Director/Macon in Knight Foundation''s current staff directory. She joined Knight as Macon program director in January 2017 after serving in leadership roles at Cox Communications and the Greater Macon Chamber of Commerce.

Sources: https://knightfoundation.org/about/staff/ ; https://knightfoundation.org/articles/news/lynn-murphey-to-lead-knight-foundation-investments-in-macon-georgia/', 'Macon community and philanthropic leader listed as Director/Macon in Knight Foundation''s current staff directory.'),
  ('aaa5e945-1ae8-4f75-8adb-73b3301cbfd6'::uuid, 'lynn-snyder', 'Treasurer of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Treasurer of the Macon-Bibb Democratic Committee.'),
  ('037dd92e-d4f0-414f-b108-69194bb9e023'::uuid, 'm-kadar-jones', 'Listed as Minister of Music at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'M. Kadar Jones is listed as Minister of Music at Centenary United Methodist Church.'),
  ('8485cbe8-d746-42e5-99cb-3546369e15bd'::uuid, 'madalyn-bierster', 'Credited reporter in WTOC candidate coverage.', 'WTOC weekend evening anchor and reporter covering crime and courts in the Savannah region.'),
  ('c9803ea1-03e3-4578-b004-49c5939e2a2d'::uuid, 'maddie-manns', 'Listed as Barn Center Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Maddie Manns is listed as Barn Center Manager of Rescue Mission of Middle Georgia.'),
  ('57fb24af-f3c2-4ac1-8d62-502bccfad780'::uuid, 'mallory-stone', 'Education Director — Museum of Arts and Sciences.
Source (reviewed October 23, 2026): https://masmacon.org/about/', 'Mallory Stone is listed as education director with Museum of Arts and Sciences.'),
  ('bac94547-d339-4f01-84ba-1618f40152cb'::uuid, 'mandy-howell', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Mandy Howell appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('ce378978-37fd-46a7-ba01-bef11d58fee8'::uuid, 'marc-hyden', 'Credited author of articles published by The Macon Melody.', 'Senior director of state government affairs at the R Street Institute and a public-policy commentator.'),
  ('c63dd6d2-49fb-42d4-adde-1fc65283a9bc'::uuid, 'marcus-agostino', 'Non-public Member — Peach County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Marcus Agostino is listed as non-public member with Peach County at the Middle Georgia Regional Commission.'),
  ('11eff9f0-9c0a-4e01-89f7-d47b6139b7f2'::uuid, 'margaret-peth', 'Board vice president of Bike Walk Macon, as listed on its current team page.

Source: https://www.bikewalkmacon.com/ourteam', 'Board vice president of Bike Walk Macon.'),
  ('3407d5d7-5ea3-49e8-b419-33271cbd9c26'::uuid, 'margaret-walker', 'Credited author or contributor in coverage published by The Macon Telegraph.', 'Has reported for The Telegraph on energy, the environment, and community issues in Middle Georgia.'),
  ('8fb073da-00f8-4acd-abc2-914c712f73b8'::uuid, 'maria-andrade', 'Project Director — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Maria Andrade is listed as project director with Macon Arts Alliance.'),
  ('4c0987f9-2f0a-4290-9aba-1db7548b684f'::uuid, 'maria-hammett', 'Interim Senior VP for Enrollment Management — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Maria Hammett is listed as interim senior vice president for enrollment management with Mercer University.'),
  ('95064751-78e0-40dd-acdf-c79f0bcd1016'::uuid, 'maribel-perez-wadsworth', 'President and CEO of the John S. and James L. Knight Foundation, as listed in its current leadership directory.

Source: https://knightfoundation.org/about/staff/', 'President and CEO of Knight Foundation, supporting journalism, arts, and informed communities.'),
  ('93d84abf-609e-48f1-9686-8eb6ca9ea7f5'::uuid, 'marion-seckinger', 'Listed as treasurer (county officers page; term unconfirmed) of the Bibb County Republican Party. Source: https://bibb.gop/bibb-county-gop-officers/ (reviewed October 22, 2026).', 'Listed as treasurer on the Bibb County Republican Party’s undated officers page; the term is unconfirmed.'),
  ('b0d0fa33-2c5c-4128-bc65-7ae64d931a65'::uuid, 'mark-byrd', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Mark Byrd is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('ea754a64-249c-4c3a-a017-8298c068e33e'::uuid, 'mark-grossnickle', 'Named as a Macon-Bibb County Hospital Authority board member in April 16, 2026 reporting.

Source: https://maconmelody.com/who-runs-macons-biggest-hospital-the-answer-is-complicated/', 'Radiologist with Radiology Associates of Macon, serving patients in central Georgia.'),
  ('1aacdb55-e63d-41b5-82d0-fc3cdbde7c3d'::uuid, 'mark-morgan', 'Listed as second vice chair (county officers page; term unconfirmed) of the Bibb County Republican Party. Source: https://bibb.gop/bibb-county-gop-officers/ (reviewed October 22, 2026).', 'Listed as second vice chair on the Bibb County Republican Party’s undated officers page; the term is unconfirmed.'),
  ('707563cb-af63-40b5-b8b5-7f13da392058'::uuid, 'mark-niesse', 'Credited author in candidate news coverage.', 'Has covered Georgia government, elections, and voting for The Atlanta Journal-Constitution, following earlier reporting for The Associated Press.'),
  ('9b37a38f-c017-4b4c-8e21-8b1de5bb403b'::uuid, 'mark-thompson', 'Photographer & Special Events Assistant — NewTown Macon.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Mark Thompson is listed as photographer & special events assistant with NewTown Macon.'),
  ('bfada8ed-bb75-4a5b-91e4-6d8a3811d69c'::uuid, 'martha-dalton', 'Credited author in candidate news coverage.', 'Atlanta Journal-Constitution journalist covering education and Atlanta Public Schools, previously a senior education reporter at WABE.'),
  ('6ce99642-bbce-4c64-bff9-a839180b6218'::uuid, 'marty-dominy', 'Non-public Member — Wilkinson County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Marty Dominy is listed as non-public member with Wilkinson County at the Middle Georgia Regional Commission.'),
  ('e06ea92b-c448-427d-8cf6-e2fffa1da225'::uuid, 'marty-koplin', 'Macon civic organizer identified as president of the League of Women Voters of Macon in September 2026 reporting on voter engagement. A 2020 coalition press release identified her as co-president of Georgia Women (And Those Who Stand With Us); 2026 reporting also identifies her as a founding member, spelling her surname Coplin.

Sources: https://www.mercercluster.com/article/2026/09/macon-activists-put-citys-voter-turnout-in-focus ; https://my.lwv.org/sites/default/files/uber-free-rides-press-release.pdf ; https://www.mercercluster.com/article/2026/03/no-kings-protest-march-2026', 'Named co-president of Georgia Women (And Those Who Stand With Us) in its coalition’s 2020 voter-transportation announcement.'),
  ('bb41e105-3a62-4f39-9bfd-255b1cdbb27a'::uuid, 'marvin-land', 'Director of Stormwater — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Marvin Land is listed as director of stormwater with Macon Water Authority.'),
  ('e137adca-ac21-4313-b46a-01bd152b8748'::uuid, 'mary-bowman-hampton', 'Senior VP for University Marketing — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Mary Bowman Hampton is listed as senior vice president for university marketing with Mercer University.'),
  ('b0f68160-c108-466d-8bd4-cd566ad8b349'::uuid, 'maryam-yarahmadi', 'Historic Preservation Planner II — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Maryam Yarahmadi is listed as historic preservation planner ii with Macon-Bibb County Planning and Zoning Commission.'),
  ('11ca19c1-5e3f-4c7b-a96d-3d5b8912275d'::uuid, 'matt-astin', 'Named as a Macon-Bibb County Hospital Authority board member in April 16, 2026 reporting.

Source: https://maconmelody.com/who-runs-macons-biggest-hospital-the-answer-is-complicated/', 'Mercer University team physician and medical director of its athletic training master’s program, trained in emergency and internal medicine.'),
  ('99d03748-afe6-4179-ae06-5fdc2b3295ad'::uuid, 'matt-garvin', 'Director of Finance at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Director of Finance at the Middle Georgia Regional Commission.'),
  ('8df4e111-1d4a-4f0f-9691-884e5a206a13'::uuid, 'matt-harper', 'Listed as Board Member at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Matt Harper is listed as Board Member at Centenary Community Ministries, Inc.'),
  ('e1fb622d-0277-48dc-9cd9-be985433e678'::uuid, 'matt-sapp', 'Listed as Past Moderator by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Matt Sapp is listed as Past Moderator by the Cooperative Baptist Fellowship of Georgia.'),
  ('68e3e588-6f9e-49ef-bbba-8447ed995412'::uuid, 'matthew-r-hall', 'Senior VP, General Counsel and Corporate Secretary — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/presidents-cabinet/', 'Matthew R. Hall is listed as senior vice president, general counsel and corporate secretary with Mercer University.'),
  ('f559a358-da5a-499e-b113-0245c4fceafb'::uuid, 'matthew-rogers', 'Listed as Men''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Matthew Rogers is listed as Men''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('eb21fc24-299a-4a13-892b-d599fafe8490'::uuid, 'maya-t-prabhu', 'Credited author in candidate news coverage.', 'Atlanta Journal-Constitution reporter covering Georgia government, legislation, criminal justice, and social issues.'),
  ('c62a4dfd-337c-41bd-9363-6366b4009f33'::uuid, 'meaghan-blight', 'President — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Meaghan Blight is listed as president with Wesleyan College.'),
  ('8c08f304-e7a7-438d-8516-7d1c4ae23269'::uuid, 'mekayla-murphy', 'Listed as Coordinator of Client Services by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Mekayla Murphy is listed as Coordinator of Client Services by Loaves and Fishes Ministry of Macon.'),
  ('b715ad0a-cfca-4f78-8ece-4d25191d27ee'::uuid, 'melinda-robinson-moffett', 'Board Vice Chair — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconhousing.com/boardmembers.html

Profile photo source: https://www.maconhousing.com/boardmembers.html', 'Melinda Robinson-Moffett is listed as board vice chair with Macon Housing Authority.'),
  ('4646ce6e-9370-4271-b114-d99b690c3eeb'::uuid, 'melissa-pittman', 'Chief Investigator — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Melissa Pittman is listed as chief investigator with Macon Judicial Circuit District Attorney’s Office.'),
  ('2ec810eb-cfb1-45c8-8377-8f74a1fc3339'::uuid, 'melody-blake', 'Provost and VP for Academic Affairs — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Melody Blake is listed as provost and vice president for academic affairs with Wesleyan College.'),
  ('d4d7ce6e-a428-41c1-82c0-b33b5c9f05a1'::uuid, 'micah-johnston', 'Credited author or contributor in coverage published by The Macon Telegraph and The Macon Melody.', 'Sports and newsletter editor at The Macon Melody, previously a general assignment, crime, and sports reporter at The Telegraph.'),
  ('ad0296a5-70e8-49ab-b8e1-7f10f49a3c02'::uuid, 'michael-bill', 'Property Coordinator — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/our-purpose/

Profile photo source: https://maconlandbank.org/our-purpose/', 'Michael Bill is listed as property coordinator with Macon-Bibb County Land Bank Authority.'),
  ('c846bd60-0189-4218-8ed8-18d19d76b298'::uuid, 'michael-hokanson', 'District public information officer for North Central Health District. Identified in the Macon Newsroom article as the public-records contact.

Source: https://northcentralhealthdistrict.org/about-us/', 'District public information officer for North Central Health District.'),
  ('7073a206-621e-4e14-941e-2f982f326921'::uuid, 'michael-huckaby', 'Director of Aging at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Director of Aging at the Middle Georgia Regional Commission.'),
  ('6be03890-0b53-4b7f-a3f5-218bc24de4b5'::uuid, 'michael-j-greenwald', 'MPO Administrator — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Michael J. Greenwald is listed as MPO administrator with Macon-Bibb County Planning and Zoning Commission.'),
  ('894d423d-0fdb-4ef3-b51d-5823aeff6c96'::uuid, 'michael-mcneil', 'Chief Assistant County Attorney — Macon-Bibb County Attorney’s Office.

Source: https://www.maconbibb.us/more-than-fine-print-with-chief-assistant-county-attorney-michael-mcneil/', 'Michael McNeil is listed as chief assistant county attorney with Macon-Bibb County Attorney’s Office.'),
  ('4b7a4334-f10b-4dd7-89d9-a9b3d61dc0dd'::uuid, 'michael-neisler', 'Michael Neisler is chair of the Bibb County Republican Party. Listed by the Georgia Republican Party: https://www.gagop.org/bibb-county . Current chair confirmed by the Civic Pulse administrator on October 22, 2026; the county website''s conflicting officer listing is outdated.', 'Michael Neisler is chair of the Bibb County Republican Party.'),
  ('787d2d5f-20ac-4481-963f-8657bc549aea'::uuid, 'michel-wanna', 'Executive Director and President — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/ ; https://maconwater.org/macon-water-authority-board-unanimously-names-michel-wanna-executive-director-president/', 'Michel Wanna is listed as executive director and president with Macon Water Authority.'),
  ('010d9e10-5b5c-4a99-b165-3ede0026d1bf'::uuid, 'michelle-baruchman', 'Credited author in candidate news coverage.', 'Politics news and enterprise reporter for The Atlanta Journal-Constitution, covering statewide political stories.'),
  ('5b6779d1-303d-4e93-8176-fc9cc6608245'::uuid, 'michelle-grembowski', 'Director of Technology Services at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Director of Technology Services at the Middle Georgia Regional Commission.'),
  ('f7232a87-85d0-4587-910a-b8143620701a'::uuid, 'michelle-l-price', 'Credited author in candidate news coverage.', 'Washington-based Associated Press reporter covering the White House, with prior experience reporting on presidential campaigns and state politics.'),
  ('0df66970-2166-455c-8ded-4e9c02a542fd'::uuid, 'michelle-parks', 'Associate Member — Macon-Bibb County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Michelle Parks is listed as associate member with Macon-Bibb County at the Middle Georgia Regional Commission.'),
  ('44a50acf-c77c-49b6-adb1-5c443cb801fa'::uuid, 'mike-austin', 'Chief Executive Officer — Macon Housing Authority.

Sources (official rosters reviewed October 22, 2026): https://maconhousing.com/team.html

Profile photo source: https://maconhousing.com/team.html', 'Mike Austin is listed as chief executive officer with Macon Housing Authority.'),
  ('404a6baf-f200-485c-90fb-051a4ce242ec'::uuid, 'mike-ford', 'Trails Director — NewTown Macon. President (since July 2011 per published biography) — Ocmulgee Land Trust. Staff Support — Ocmulgee Heritage Trail Committee.

Sources (reviewed October 23, 2026): https://newtownmacon.com/our-work/staff/', 'Mike Ford is listed as trails director with NewTown Macon.'),
  ('c1b868ec-86a2-46b3-b809-ff66373e3e38'::uuid, 'mike-jenkins', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Mike Jenkins is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('2a069a23-3db5-4485-bfd4-c10d9cf3d111'::uuid, 'mike-kaplan', 'Board Chair — Bibb County Board of Elections.

Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Mike Kaplan is listed as board chair with Bibb County Board of Elections.'),
  ('eafca4a6-5804-459a-89bf-7a4d75e2715a'::uuid, 'milligan-hall', 'Listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Milligan Hall is listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('c5c49447-7761-42eb-9b34-4f9117bb2f27'::uuid, 'mindy-attaway', 'Commissioner — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Mindy Attaway is listed as commissioner with Macon-Bibb County Planning and Zoning Commission.'),
  ('a400233d-706d-45c1-baa4-dccb9c71af98'::uuid, 'misty-tyson', 'Listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Misty Tyson is listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('14b90699-ae9d-44ff-bc1f-0960f8ecb728'::uuid, 'monica-diaz-meek', 'Credited author in candidate news coverage.', '41NBC anchor, reporter, and producer who presents midday and early evening newscasts in Macon.'),
  ('74a7582a-e957-46ee-b377-28fbda44070c'::uuid, 'monique-davis-smith', 'Named as a Macon-Bibb County Hospital Authority board member in April 16, 2026 reporting.

Source: https://maconmelody.com/who-runs-macons-biggest-hospital-the-answer-is-complicated/', 'Family physician and residency-program director at Atrium Health Navicent, with experience in primary care and diabetes education.'),
  ('3cfcd5a5-c489-4263-b97c-e3433a2eed91'::uuid, 'moranda-guy', 'Administrative Officer — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Moranda Guy is listed as administrative officer with Macon-Bibb County Emergency Management Agency.'),
  ('009de0f6-34b0-4d33-b3f6-bcd37548a97a'::uuid, 'myah-anderson', 'Listed as Children''s Program Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Myah Anderson is listed as Children''s Program Manager of Rescue Mission of Middle Georgia.'),
  ('09107986-ec66-4e62-a1cf-874d958e4dec'::uuid, 'myracle-lewis', 'Credited author or contributor in coverage published by The Macon Telegraph.', 'Has written local news and education coverage for The Telegraph, including reporting on schools and literacy.'),
  ('781b8266-d976-4fe7-9c5b-2a5e7ced1562'::uuid, 'myrtle-habersham', 'Named as a Macon-Bibb County Hospital Authority board member in April 16, 2026 reporting.

Source: https://maconmelody.com/who-runs-macons-biggest-hospital-the-answer-is-complicated/', 'AARP Georgia state president identified in its April 2025 profile of Macon volunteer Louis Frank Tompkins.'),
  ('f2854ac8-3ab5-4627-87f1-46266981d6af'::uuid, 'najiva-timothee', 'Founder and Executive Director — Girls Dig Deeper Initiative.
Source (reviewed October 23, 2026): https://www.maconbibb.us/gddifoodbank2026/', 'Najiva Timothee is listed as founder and executive director with Girls Dig Deeper Initiative.'),
  ('000cd7bb-3a34-4ec7-ae37-cb978abe8655'::uuid, 'natacha-ansley', 'Coordinator — Macon/Oconee Area/Milledgeville — Macon-Bibb Citizen Advocacy.
Source (reviewed October 23, 2026): https://www.maconbibbcitizenadvocacy.org/contact-us/board-and-staff/', 'Natacha Ansley is listed as coordinator with Macon/Oconee Area/Milledgeville.'),
  ('3f25237c-8171-4eb6-9fb5-b172de16424a'::uuid, 'natalie-callaway', 'Deputy Chief Clerk, Court Operations and Data Entry — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'Natalie Callaway is listed as deputy chief clerk, court operations and data entry with Macon-Bibb County Municipal Court.'),
  ('39e8a421-5fe6-4bb6-903e-8ca3c31042f2'::uuid, 'natalie-lurie', 'Non-public Member — Jones County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Natalie Lurie is listed as non-public member with Jones County at the Middle Georgia Regional Commission.'),
  ('ab61e6d4-29e1-40e1-9287-1cedf42af685'::uuid, 'natalie-mendenhall', 'Credited author in candidate news coverage.', 'Producer for The Atlanta Journal-Constitution’s Politically Georgia podcast, previously a senior producer at Georgia Public Broadcasting.'),
  ('31c3739e-805c-4ce9-892c-9df5e0667243'::uuid, 'natasha-christian', 'Immediate Past Chair — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Natasha Christian is listed as immediate past chair with Keep Macon-Bibb Beautiful.'),
  ('73081eb2-1577-4a7c-bcf9-b73e27f6b2b2'::uuid, 'nathan-byrd', 'Listed as Leadership Development Team Chair by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Nathan Byrd is listed as Leadership Development Team Chair by the Cooperative Baptist Fellowship of Georgia.'),
  ('190e2531-17a1-456d-b22f-ef319660fa66'::uuid, 'nathan-moore', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Nathan Moore appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('f9cfc688-4c3d-4029-a1c7-8d1dbfb27ead'::uuid, 'nathaniel-jordan', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Macon Melody editorial intern and Mercer journalism student working on investigative projects through a John Martin Couric Fellowship.'),
  ('39323478-5d98-4e7f-be53-a7f6be747fde'::uuid, 'nichols-riggins', 'Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Nichols Riggins appears on the published roster as board member with Downtown Macon Business Improvement District Board of Directors.'),
  ('a7863b6e-faa0-42f2-adb9-af5a9db3b26a'::uuid, 'nick-dawson', 'Listed as Coordinating Council, At Large by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Nick Dawson is listed as Coordinating Council, At Large by the Cooperative Baptist Fellowship of Georgia.'),
  ('05860a6c-3b55-4ec8-90f4-db7de23dc332'::uuid, 'nidia-svare', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Nidia Svare is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('a40da5f6-4f1c-4c07-b6dd-6ff7501fd2d5'::uuid, 'niger-brown', 'Listed as Bargain Center Operations Manager of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Niger Brown is listed as Bargain Center Operations Manager of Rescue Mission of Middle Georgia.'),
  ('a9b0a4b2-7439-444a-9713-a024e9aa68c5'::uuid, 'nolan-howard', 'Associate Member — Monroe County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Nolan Howard is listed as associate member with Monroe County at the Middle Georgia Regional Commission.'),
  ('ef6b189b-cca4-4866-8ed2-318fa6b54a6b'::uuid, 'olivia-slaton', 'Advocacy Coordinator — Central Georgia CASA.
Source (reviewed October 23, 2026): https://www.cgcasa.org/about', 'Olivia Slaton is listed as advocacy coordinator with Central Georgia CASA.'),
  ('4a0d1b17-9957-4826-b1dc-54570016add3'::uuid, 'olivia-walter', 'Public Relations Specialist — Macon-Bibb County Office of Communications.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/communications/

Profile photo source: https://www.maconbibb.us/communications/', 'Olivia Walter is listed as public relations specialist with Macon-Bibb County Office of Communications.'),
  ('e3bbfdc4-25bd-4e79-9a67-1cdf7af831ed'::uuid, 'ophelia-pete-hill', 'GIS Manager — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Ophelia Pete Hill is listed as GIS manager with Macon-Bibb County Planning and Zoning Commission.'),
  ('ef72b4ef-9264-480c-9ebd-6041d167014c'::uuid, 'pam-faison', 'Director of Victim Services — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Pam Faison is listed as director of victim services with Macon Judicial Circuit District Attorney’s Office.'),
  ('e5e82c63-6a40-433b-8239-8012b2728f7a'::uuid, 'pat-chastain', 'President and CEO — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Pat Chastain is listed as president and CEO with Rescue Mission of Middle Georgia.'),
  ('954b3212-7c0f-4605-896b-14e0490c9cb5'::uuid, 'pat-turner', 'Listed as Missions Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Pat Turner is listed as Missions Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('ec1cd9db-d772-41fa-9560-04af72078ecb'::uuid, 'patrice-walker', 'Listed on the Macon-Bibb County Board of Health in its physician seat.

Source: https://northcentralhealthdistrict.org/board-of-health/', 'Listed on the Macon-Bibb County Board of Health in its physician seat.'),
  ('c3c86220-b5af-4ec7-aaf6-96efbe2874f1'::uuid, 'patricia-murphy', 'Credited author in candidate news coverage.', 'Senior political columnist at The Atlanta Journal-Constitution, with prior experience covering Congress and national politics.'),
  ('881cd5a8-3d80-49aa-9a71-93c3c27c3892'::uuid, 'patty-gibbs', '2026–2027 Board Chair — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Patty Gibbs is listed as 2026–2027 board chair with International Cherry Blossom Festival.'),
  ('e385934c-f6c9-4198-a8df-43da35035a98'::uuid, 'paula-blevins', 'Identified as Captain / Central Georgia Corps Officer serving the Salvation Army''s Central Georgia / Macon ministry. Source: https://disaster.salvationarmyusa.org/articles/2026/03/11/the-salvation-army-serves-georgia-state-defense-force-during-training-exercise (reviewed October 23, 2026).', 'Identified as Captain / Central Georgia Corps Officer serving the Salvation Army''s Central Georgia / Macon ministry.'),
  ('1fc9506f-25ca-46bf-a2e9-ef38f55d143e'::uuid, 'paula-strozier', 'Named contact for ESLFREE.NET, the language ministry meeting at First Baptist Church of Christ in Macon. Source: https://www.eslfree.net/ (verified October 23, 2026).', 'Named contact for ESLFREE.NET, the language ministry meeting at First Baptist Church of Christ in Macon.'),
  ('c4c200ca-03a2-4f4b-9f3b-0499345de691'::uuid, 'payton-towns-iii', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Courier Herald reporter covering Dublin and Laurens County government, schools, crime, public safety, and human-interest stories.'),
  ('91f646a0-08c8-4403-a2c2-22223b3b2a33'::uuid, 'penny-l-elkins', 'President — Mercer University.
Source (reviewed October 23, 2026): https://www.mercer.edu/about-mercer/office-of-the-president/', 'Penny L. Elkins is listed as president with Mercer University.'),
  ('e14a87d5-cae6-47b8-b7dc-caa211f910e6'::uuid, 'phillip-boyd', 'Listed as Case Manager / Addictions Specialist in Centenary''s church and community-ministry staff listings. Source: https://www.centenarymacon.org/our-team ; https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Phillip Boyd is listed as Case Manager / Addictions Specialist in Centenary''s church and community-ministry staff listings.'),
  ('4ba0907c-3c82-4c52-b6cb-17f1ce79a69d'::uuid, 'princess-jackson', 'Listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Princess Jackson is listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('e8ab6f24-7ab7-4936-bc41-a36f512075dc'::uuid, 'rachad-hollis', 'Communications Specialist — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Rachad Hollis is listed as communications specialist with Macon Water Authority.'),
  ('9cfd430d-b89c-4776-a25c-dd7379bd3347'::uuid, 'rachael-jones', 'Listed as Resident Manager by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Rachael Jones is listed as Resident Manager by Ronald McDonald House of Central and Southwest Georgia.'),
  ('9fafb79d-325f-4867-b782-0407500d9d9d'::uuid, 'racheal-ryan', 'Listed as Nursery Coordinator at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Racheal Ryan is listed as Nursery Coordinator at Centenary United Methodist Church.'),
  ('24f046fd-8fd9-424e-a3e3-ad7983e712c2'::uuid, 'rachel-paul-hartman', 'Listed as CCMI Executive Director in Centenary''s church and community-ministry staff listings. Source: https://www.centenarymacon.org/our-team ; https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Rachel Paul Hartman is listed as CCMI Executive Director in Centenary''s church and community-ministry staff listings.'),
  ('0f9efc35-80d8-48f8-a7bb-f19c8225fb32'::uuid, 'rachel-s-greco', 'Listed as Director for Engagement and Communications by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).

Part-time Communications Manager at First Baptist Church of Christ, listed as Rachel Greco. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Rachel S. Greco is listed as Director for Engagement and Communications by the Cooperative Baptist Fellowship of Georgia.'),
  ('04973cbe-8854-41df-842e-4c2dbb5eeaf7'::uuid, 'rachel-umana', 'Founder and former executive director of Bike Walk Macon. The organization reports she stepped down in March 2026 after ten years of leadership.

Source: https://www.bikewalkmacon.com/blog/2026mmmp', 'Founder and former executive director of Bike Walk Macon.'),
  ('629637ab-9218-4b14-931a-ccaab7afd95b'::uuid, 'rahul-bali', 'Credited author or contributor in coverage published by The Macon Melody.', 'WABE politics reporter covering Georgia state government and hosting the Plugged In politics podcast.'),
  ('1261f3af-db56-4fb7-a5a2-7d08cd9363a9'::uuid, 'ralph-hawkins', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Ralph Hawkins is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('c5cb6138-c2c0-41c4-a3e2-bc7227ccb2b0'::uuid, 'ramsey-howard', 'Associate Member — Pulaski County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Ramsey Howard is listed as associate member with Pulaski County at the Middle Georgia Regional Commission.'),
  ('a3704d26-bee2-4d9c-961a-67847ed57ed1'::uuid, 'randi-doveton', 'Assistant Executive Director — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Randi Doveton is listed as assistant executive director with Macon-Bibb County Planning and Zoning Commission.'),
  ('4e6e6546-bc64-409f-9a0f-0ce7d58be5cf'::uuid, 'randy-stephens', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Randy Stephens is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('c4a1e4fd-57b5-4b9d-911d-d9dc754cf03f'::uuid, 'ray-lewis', 'Credited author in candidate news coverage.', 'National News Desk contributor whose Georgia election reporting has appeared on WGXA.'),
  ('26102a98-c2fd-4e8c-a709-f37eeda92ee3'::uuid, 'rebecca-grapevine', 'Credited author in candidate news coverage.', 'Healthbeat’s Atlanta reporter, covering public health after reporting for Georgia Health News and KFF Health News.'),
  ('d453d2b7-e5a7-48f3-b04f-cb4a8bdbe664'::uuid, 'reece-freel', 'Named in Rebuilding Macon''s published 2025 board roster as Board Member. This dated listing does not establish a current 2026 appointment. Source: https://www.rebuildingmacon.org/team (reviewed October 23, 2026).', 'Reece Freel appears on Rebuilding Macon''s 2025 board roster as board member.'),
  ('aab3a447-ce02-4773-94ed-5102e5e1bcf3'::uuid, 'reid-mclain', 'Director of Workforce Programs and Strategies — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Reid McLain is listed as director of workforce programs and strategies with Greater Macon Chamber of Commerce.'),
  ('233c0180-1722-43b4-8345-3eee8d06b227'::uuid, 'renee-corwine', 'Board president of Bike Walk Macon, as listed on its current team page.

Source: https://www.bikewalkmacon.com/ourteam', 'Board president of Bike Walk Macon.'),
  ('e548c94f-e50b-42b3-a29e-d28c3a9a0a73'::uuid, 'renita-patterson', 'Vice President of Engagement — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Renita Patterson is listed as vice president of engagement with Greater Macon Chamber of Commerce.'),
  ('8f4c5d9d-5375-4dd2-96c2-97880c110fb6'::uuid, 'renoalda-scott', 'Chair of the Macon-Bibb Democratic Committee. Source: https://www.bibbdems.com/staff (reviewed October 22, 2026).', 'Chair of the Macon-Bibb Democratic Committee.'),
  ('9f7a649d-0c4f-4e91-b35f-a3e6f9c2b02f'::uuid, 'rhonda-roell-taylor', 'Court Receiver — Bibb County Clerk of Superior Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/superior-court/clerk-of-superior-court/', 'Rhonda Roell-Taylor is listed as court receiver with Bibb County Clerk of Superior Court.'),
  ('c010ac48-b806-4715-906d-a28edddfea15'::uuid, 'rhonda-smith', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('07a74612-78c3-4687-9730-73866c692631'::uuid, 'richard-garrett', 'Associate Member — Putnam County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Richard Garrett is listed as associate member with Putnam County at the Middle Georgia Regional Commission.'),
  ('8ec570da-78fd-4a4a-9e9f-9b6d36401356'::uuid, 'richard-kosowski', 'Listed as Interim Minister of Music by Highland Hills Baptist Church. Source: https://www.highlandhillsbaptist.org/our-staff (verified October 23, 2026).', 'Richard Kosowski is listed as Interim Minister of Music by Highland Hills Baptist Church.'),
  ('454ffd16-5c5f-434b-9c9f-fc03988c620c'::uuid, 'richard-robinson', 'Deputy Coroner — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Richard Robinson is listed as deputy coroner with Bibb County Coroner’s Office.'),
  ('19e8d5fc-0abd-45bb-ba99-5c251f7cf6b7'::uuid, 'riley-bunch', 'Credited author in candidate news coverage.', 'Politics and policy reporter at The Atlanta Journal-Constitution, examining state decisions and voter concerns.'),
  ('0a73d623-cd2d-4240-a0ee-8ed92cd827b1'::uuid, 'robby-walker', 'Listed as Director of Operations by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Robby Walker is listed as Director of Operations by Ronald McDonald House of Central and Southwest Georgia.'),
  ('a0561574-1b09-426a-b0d0-12e24d362e10'::uuid, 'robert-abbott', 'Board Member — Bibb County Board of Elections.

Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Robert Abbott is listed as board member with Bibb County Board of Elections.'),
  ('8c9d9556-ee63-40e2-86f1-9bfcab042295'::uuid, 'robert-collins', 'Listed as Driver of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Robert Collins is listed as Driver of Rescue Mission of Middle Georgia.'),
  ('0668ce0a-fb3b-4624-b098-8e75daf436a7'::uuid, 'robert-e-fountain-jr', 'Board Chair — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Robert E. Fountain Jr. is listed as board chair with Macon-Bibb County Industrial Authority.'),
  ('f7ae3c6e-4f2b-4c44-bc2b-8a8e8ce456bf'::uuid, 'robert-e-herndon', 'Part-time Judge — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'Robert E. Herndon is listed as part-time judge with Macon-Bibb County Municipal Court.'),
  ('4b056feb-d3a1-46de-8689-aa980df6c688'::uuid, 'robert-mccord', 'Deputy Director — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Robert McCord is listed as deputy director with Macon-Bibb County Emergency Management Agency.'),
  ('886ec3c8-b4ba-43db-a65f-842608e156af'::uuid, 'robert-reichert', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Robert Reichert is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('323f9e80-6868-44cd-8a1b-f29f8bddf4a3'::uuid, 'robert-robby-redmond', 'Commissioner — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Commissioner on the Macon-Bibb County Planning and Zoning Commission, with a term ending December 2030.'),
  ('f67f340c-791d-44f8-be75-22ecf865ce0e'::uuid, 'robert-walker', 'Recreation Director — Macon-Bibb County Recreation Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/recreation/

Profile photo source: https://www.maconbibb.us/recreation/', 'Robert Walker is listed as recreation director with Macon-Bibb County Recreation Department.'),
  ('fa447994-8979-4f13-b42a-51727c7a9b8f'::uuid, 'robin-cochran', 'Merchandise and Administrative Manager — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Robin Cochran is listed as merchandise and administrative manager with International Cherry Blossom Festival.'),
  ('566c47f1-a13b-4e2c-84f9-650d5016a8ec'::uuid, 'robin-frischkorn', 'Listed as Director / Operations Officer in Macon Outreach''s indexed staff page. Mulberry Street UMC''s April 30, 2026 newsletter confirms Robin Frischkorn and Robin Harris manage daily operations. The direct staff page could not be fetched during verification. Sources: https://maconoutreach.com/staff ; https://myemail.constantcontact.com/Mulberry-Weekly---Worship---Prayer--Senior-Sunday--Macon-Outreach-and-more.html?aid=wf-ypY60MJQ&soid=1110910745812 . Reviewed October 23, 2026.', 'Helps manage Macon Outreach’s daily operations, as described in Mulberry Street UMC’s April 2026 newsletter.'),
  ('4c0285f3-07f5-4a66-a28e-038f99769348'::uuid, 'robin-harris', 'Volunteer coordinator listed in Macon Outreach''s indexed staff roster. Mulberry Street UMC''s April 30, 2026 newsletter confirms her ongoing work managing daily operations with Robin Frischkorn. Sources: https://maconoutreach.com/staff ; https://myemail.constantcontact.com/Mulberry-Weekly---Worship---Prayer--Senior-Sunday--Macon-Outreach-and-more.html?aid=wf-ypY60MJQ&soid=1110910745812 . Reviewed October 23, 2026.', 'Helps manage Macon Outreach’s daily operations, as described in Mulberry Street UMC’s April 2026 newsletter.'),
  ('4f164ec3-0ab7-4880-8083-df3d4f273ccc'::uuid, 'robin-parker', 'Executive Director, Community Development and Patient Support — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Executive Director, Community Development and Patient Support — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Robin Parker is listed as executive director, community development and patient support with Piedmont Macon Medical Center.'),
  ('b5aa63de-31c8-483b-9a81-4e1d113a1ccb'::uuid, 'rodney-manley', 'Credited author or contributor in coverage published by The Macon Telegraph or The Macon Melody.', 'Has reported on Macon business and local news for The Telegraph.'),
  ('d2c468dc-138a-4624-a3e3-2f2f7e8d60c9'::uuid, 'roger-patton', 'Listed as Driver of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Roger Patton is listed as Driver of Rescue Mission of Middle Georgia.'),
  ('a1f80f43-c8bf-449b-8ad1-80622307162d'::uuid, 'ron-busby', 'Listed as 2026 Board Treasurer by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Ron Busby is listed as 2026 Board Treasurer by Ronald McDonald House of Central and Southwest Georgia.'),
  ('a6fb3a9f-3e15-42db-9cca-02a1fc4f426e'::uuid, 'ron-mcclung', 'Listed as Associate Coordinator by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Ron McClung is listed as Associate Coordinator by the Cooperative Baptist Fellowship of Georgia.'),
  ('ad63b93b-baac-4fa3-948e-3b50f998a856'::uuid, 'ron-shipman', 'Macon civic leader and former chair of the Macon-Bibb County Hospital Authority. Also known as Ronald Shipman, he led the Macon Water Authority. Local reporting announced his death in February 2026; his authority affiliation is historical.

Sources: https://maconmelody.com/private-funeral-set-for-mwa-executive-director-ron-shipman/ ; https://maconmelody.com/the-authorities-that-run-macon-bibb-a-primer/', 'Former executive director and president of Macon Water Authority, listed in its February 2026 stormwater report.'),
  ('2fa0eb79-8941-41b1-9041-62b8ff6656bb'::uuid, 'ronnie-hinson', 'Founder of Sonrise Ministries in Jones County, as documented in the ministry''s published history. Its work includes community assistance and housing support.

Source: https://jonescountyoutreachcenter.wordpress.com/', 'Founder of Sonrise Ministries in Jones County, as documented in the ministry''s published history.'),
  ('9657d5b8-b5d6-4abf-87f6-f655e94d0933'::uuid, 'ronnie-mays', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Ronnie Mays is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('402b8cd3-1cac-4b9c-8f90-a43d5f20afbc'::uuid, 'ronnie-miley', 'Deputy Coroner — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Ronnie Miley is listed as deputy coroner with Bibb County Coroner’s Office.'),
  ('60471424-da38-4a04-bc0f-30564e44087e'::uuid, 'rose-thornburg', 'Listed as Board Member at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Rose Thornburg is listed as Board Member at Centenary Community Ministries, Inc.'),
  ('c28283c1-4c99-4e3a-b481-d77e5b043705'::uuid, 'ross-williams', 'Credited author or contributor in coverage published by The Macon Melody.', 'Georgia Recorder journalist with experience covering local and state government for the Marietta Daily Journal.'),
  ('53b5dedd-67e3-4521-8964-7a2843397b7f'::uuid, 'rusty-mclain', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Rusty McLain is listed as Board Member by Jay''s HOPE Foundation.'),
  ('89c4ff94-885f-4324-a73d-d5efedc940a6'::uuid, 'ruth-perkins-lee', 'Listed as Executive Coordinator by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Ruth Perkins Lee is listed as Executive Coordinator by the Cooperative Baptist Fellowship of Georgia.'),
  ('641f91ea-b76c-42f1-9af5-b2f3db3096ef'::uuid, 'ruth-taylor', 'Office Administrator — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Ruth Taylor is listed as office administrator with Bibb County Coroner’s Office.'),
  ('208025e5-4a94-4a9d-a172-458fca11b745'::uuid, 'ryan-marando', 'Credited author in candidate news coverage.', 'Reported for WGXA on voting in the 2022 Macon Water Authority runoff.'),
  ('4683b5a7-d40e-4701-b536-9926e13d4901'::uuid, 'sam-gringlas', 'Credited author in candidate news coverage.', 'WABE politics journalist whose reporting covers elections, voting, public policy, and the law.'),
  ('c8d58602-6289-47d1-82ca-4eb64599b7ef'::uuid, 'sam-henderson', 'Board Secretary — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'Sam Henderson is listed as board secretary with Macon-Bibb County Economic Opportunity Council.'),
  ('ebc839a6-0213-45a3-a224-4151643314b6'::uuid, 'sam-mcduffie', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Sam McDuffie is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('41101c74-a9e0-441b-be63-68f1ec49263a'::uuid, 'samantha-click', 'Listed as Board President at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Samantha Click is listed as Board President at Centenary Community Ministries, Inc.'),
  ('10bd94e0-dd90-4759-9be6-f4f852676e79'::uuid, 'sandy-duke', 'Listed as 2026 Board Chair by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Sandy Duke is listed as 2026 Board Chair by Ronald McDonald House of Central and Southwest Georgia.'),
  ('93c8a01f-3281-4f27-884f-74a728e10694'::uuid, 'sara-myers', 'Non-public Member — Pulaski County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Sara Myers is listed as non-public member with Pulaski County at the Middle Georgia Regional Commission.'),
  ('efd146e4-c3b0-43f4-ad95-12c55ea8ee78'::uuid, 'sara-pugh-montgomery', 'Listed as Senior Pastor at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Sara Pugh Montgomery is listed as Senior Pastor at Centenary United Methodist Church.'),
  ('4b4c92d2-e3a4-4a2a-874b-4b96a744b033'::uuid, 'sarah-kallis', 'Credited author in candidate news coverage.', 'Georgia Public Broadcasting politics reporter and Lawmakers capitol correspondent, covering public policy and state government.'),
  ('edd73fe7-c987-4098-8b9b-33ad0d10e3c6'::uuid, 'sarita-r-hill', 'Chief Executive Officer — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/', 'Sarita R. Hill is listed as chief executive officer with Macon-Bibb County Economic Opportunity Council.'),
  ('2e5d54f7-2863-4503-b4a5-b5524c7ca0b6'::uuid, 'scott-mitchell', 'Treasurer & Marketing Committee Chair — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Scott Mitchell is listed as treasurer & marketing committee chair with Main Street Macon Board.'),
  ('e6af0dbd-f3b5-4c6f-9804-f1b92b3039d6'::uuid, 'scott-strong', 'Chief Operations Officer — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Chief Operations Officer — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Scott Strong is listed as chief operations officer with Piedmont Macon Medical Center.'),
  ('8b37b1d7-87f2-4a9b-91e4-a64b4330372e'::uuid, 'seth-berkebile', 'Athletic Director — Wesleyan College.
Source (reviewed October 23, 2026): https://www.wesleyancollege.edu/about/President-and-Leadership-Team.cfm', 'Seth Berkebile is listed as athletic director with Wesleyan College.'),
  ('4cc4259e-ee53-4f5b-8dbb-ac9374599afc'::uuid, 'shannon-mccaffrey', 'Credited author in candidate news coverage.', 'Has contributed Georgia election coverage and political reporting to The Atlanta Journal-Constitution.'),
  ('7076afdb-8062-41ca-8ee1-829082e9a8e7'::uuid, 'she-keene', 'Macon artist and civic organizer who co-founded Macon Rising with Abby Aiello and Elizabeth Lott in early 2025. September 2026 reporting documents her participation in the coalition''s voter-engagement work with the League of Women Voters of Macon.

Sources: https://maconmelody.com/?p=10671 ; https://www.mercercluster.com/article/2026/09/macon-activists-put-citys-voter-turnout-in-focus', 'Macon Rising community organizer who served as media contact for the September 2026 Votes & Vibez civic event.'),
  ('47b67810-1acb-4e25-baa8-9ea7c2acb537'::uuid, 'shelia-luby', 'Listed as Food Pantry Support by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Shelia Luby is listed as Food Pantry Support by Loaves and Fishes Ministry of Macon.'),
  ('9310992d-f37d-4d25-87e6-2d6232a403c9'::uuid, 'shelley-tolbert', 'Listed as Missions Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Shelley Tolbert is listed as Missions Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('48f79488-fc90-4ed1-82ff-c80d12a92613'::uuid, 'shelley-woodruff', 'Listed as Clerk by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Shelley Woodruff is listed as Clerk by the Cooperative Baptist Fellowship of Georgia.'),
  ('2c9af1c1-43a3-4ad8-99b9-8fadc7c5f0c1'::uuid, 'shemeka-williams', 'Deputy Chief Clerk, Financial Division — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'Shemeka Williams is listed as deputy chief clerk, financial division with Macon-Bibb County Municipal Court.'),
  ('2928a887-30a4-4fe6-bdc6-9d83b8d8717d'::uuid, 'sherry-singleton', 'Vice President of Communications — Greater Macon Chamber of Commerce.
Source (reviewed October 23, 2026): https://maconchamber.com/who-we-are/about-the-team/', 'Sherry Singleton is listed as vice president of communications with Greater Macon Chamber of Commerce.'),
  ('8860154b-486b-4ecf-bbf9-7cdac116cd33'::uuid, 'shondreka-webster-reese', 'Environmental health county manager for the Macon-Bibb County Health Department, as listed on its current team page.

Source: https://northcentralhealthdistrict.org/macon-bibb-county-health-department/', 'Environmental health county manager for the Macon-Bibb County Health Department.'),
  ('a8b65957-1c9b-4feb-bf7e-657ab361c322'::uuid, 'sofi-gratas', 'Credited author in candidate news coverage.', 'Georgia Public Broadcasting reporter covering rural health and access to health care.'),
  ('04af75d5-f98d-4808-bb48-446c5c3aeefd'::uuid, 'sophia-eppley', 'Credited author in candidate news coverage.', 'Politics intern at The Atlanta Journal-Constitution and a 2026 University of Georgia journalism graduate.'),
  ('f78ee92a-65c6-445d-b03f-21091c2654d4'::uuid, 'sophie-rosen', 'Special Projects Officer — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Sophie Rosen is listed as special projects officer with Macon-Bibb County Emergency Management Agency.'),
  ('3884c2a0-64ba-4e38-a0a7-7cf30ddf4303'::uuid, 'spencer-hawkins', 'Director — Macon-Bibb County Emergency Management Agency.

Source: https://www.maconbibb.us/ema/our-team/', 'Spencer Hawkins is listed as director with Macon-Bibb County Emergency Management Agency.'),
  ('a59047c9-d05e-41d7-b1ce-e12f093e7209'::uuid, 'stacy-carr', 'Registered nurse listed on the Macon-Bibb County Board of Health in its consumer/licensed nurse seat.

Source: https://northcentralhealthdistrict.org/board-of-health/', 'Registered nurse listed on the Macon-Bibb County Board of Health in its consumer/licensed nurse seat.'),
  ('f45e62b1-305f-4c86-888c-4b9c700adddc'::uuid, 'stacy-lane', 'Board Member — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Stacy Lane is listed as board member with Main Street Macon Board.'),
  ('f2fe0891-5805-4858-8f71-5bfe20eed42b'::uuid, 'stacy-moore', 'President and CEO — International Cherry Blossom Festival.
Source (reviewed October 23, 2026): https://cherryblossom.com/about-us/leadership/', 'Stacy Moore is listed as president and CEO with International Cherry Blossom Festival.'),
  ('b2317488-7411-4bd2-90a4-63bb57e4ecb9'::uuid, 'stanley-dunlap', 'Credited author in candidate news coverage.', 'Georgia Recorder journalist who has covered government and politics in Georgia and Tennessee.'),
  ('bd0ec9c7-956c-42c4-b39f-3c885ab191f0'::uuid, 'stanley-l-roberts', 'Listed as Minister of Music by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Stanley L. Roberts is listed as Minister of Music by First Baptist Church of Christ at Macon.'),
  ('890e23bc-5d0a-4ac5-858d-0e2ceb820b18'::uuid, 'stephanie-miller', 'Chief Deputy Clerk — Bibb County Clerk of Superior Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/superior-court/clerk-of-superior-court/', 'Stephanie Miller is listed as chief deputy clerk with Bibb County Clerk of Superior Court.'),
  ('f7ad7a95-5f7a-4546-9f7c-ed5d82d7d616'::uuid, 'stephen-adams', 'Executive Director — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Stephen Adams is listed as executive director with Macon-Bibb County Industrial Authority.'),
  ('df170e69-b6df-47ba-bb5b-c8fd29b9f685'::uuid, 'stephen-daugherty', 'Chief Executive Officer — Piedmont Macon Medical Center.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-medical-center-leadership

Chief Executive Officer — Piedmont Macon North Hospital.
Source (reviewed October 23, 2026): https://www.piedmont.org/about-piedmont/hospital-leadership/piedmont-macon-north-hospital-leadership', 'Stephen Daugherty is listed as chief executive officer with Piedmont Macon Medical Center.'),
  ('92ab2cc7-cfc7-40cf-8481-0b083acfe8ed'::uuid, 'steve-floyd', 'Listed as Logistics Coordinator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Steve Floyd is listed as Logistics Coordinator of Rescue Mission of Middle Georgia.'),
  ('69259844-9752-4b39-80aa-cd1282e07cc6'::uuid, 'steve-johnson', 'Associate Member — Jones County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Steve Johnson is listed as associate member with Jones County at the Middle Georgia Regional Commission.'),
  ('afcfbdc5-4a78-4d7a-925c-6c514ba04656'::uuid, 'steven-brewer', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'Steven Brewer is listed as Board Member by Jay''s HOPE Foundation.'),
  ('f1c465b6-a665-4e5c-a789-de642c535dea'::uuid, 'susan-collins', 'Board Treasurer — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Susan Collins is listed as board treasurer with Rescue Mission of Middle Georgia.'),
  ('70c8345a-d197-47cf-8968-a71740ea0920'::uuid, 'susan-daniels', 'Listed as Social Services Director of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Susan Daniels is listed as Social Services Director of Rescue Mission of Middle Georgia.'),
  ('1ad076dc-7805-4f53-9888-b9b6d094ad83'::uuid, 'susan-dryden', 'Board Vice Chairman — Museum of Aviation Foundation.
Source (reviewed October 23, 2026): https://museumofaviation.org/about/leadership/board-of-directors/', 'Susan Dryden is listed as board vice chairman with Museum of Aviation Foundation.'),
  ('c118f7b2-6783-47d9-8840-fc009e829581'::uuid, 'susan-joanis', 'Assistant Secretary — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'Susan Joanis is listed as assistant secretary with Macon-Bibb County Economic Opportunity Council.'),
  ('334600b4-a68b-4401-a348-ccd19f090954'::uuid, 'sylvia-mcgee', 'Chair-elect of the Community Foundation of Central Georgia''s 2026-27 executive committee. The official board roster lists her county as Bibb.

Source: https://cfcga.org/about/board-of-directors/

Board Secretary — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/board-of-directors/', 'Chair-elect of the Community Foundation of Central Georgia''s 2026-27 executive committee.'),
  ('aea7ee33-24e6-48d2-bd04-5c2056b14219'::uuid, 'tabatha-duncan', 'Board Vice-President — Macon Arts Alliance.
Source (reviewed October 23, 2026): https://www.maconartsalliance.org/about/', 'Tabatha Duncan is listed as board vice-president with Macon Arts Alliance.'),
  ('6cfb28a1-a796-4da1-8d90-f8202829ff2d'::uuid, 'tamar-hallerman', 'Credited author in candidate news coverage.', 'Senior Atlanta Journal-Constitution reporter covering the Fulton County election-interference case and cohosting the Breakdown podcast.'),
  ('230826bf-0759-482b-a5ef-cc4cecfbdd9c'::uuid, 'taryl-anderson', 'Listed as FY 2027 Board Member for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Listed on the American Red Cross Central Midwest Georgia chapter’s FY2027 board of directors.'),
  ('7af78dd8-7195-454e-9ebe-3c645a1512b1'::uuid, 'taylor-gilchrist', 'Credited author in candidate news coverage.', 'Has contributed local government, education, and community reporting to 41NBC.'),
  ('a575fbc9-a347-49c2-ad31-3e977cadde90'::uuid, 'taylor-hildebrand', 'Listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Taylor Hildebrand is listed as Women''s Program Facilitator of Rescue Mission of Middle Georgia.'),
  ('946d691e-6ca9-4250-92b1-a4d390ab28b9'::uuid, 'taylor-wilson', 'Deputy Chief of Peach and Crawford County — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Taylor Wilson is listed as deputy chief of peach and crawford county with Macon Judicial Circuit District Attorney’s Office.'),
  ('8f8b48cb-bb3c-4de7-98a9-996d83a90620'::uuid, 'teri-moore', 'Listed as Administrative Assistant by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Teri Moore is listed as Administrative Assistant by the Cooperative Baptist Fellowship of Georgia.'),
  ('2117aa1e-0887-41a9-85ec-17cb484626b9'::uuid, 'teyona-little', 'Listed as Business Operations Coordinator for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Business operations coordinator for the American Red Cross Central Midwest Georgia chapter.'),
  ('ad1dad5c-2bf4-462f-bb16-7ad9af3693c1'::uuid, 'tia-mitchell', 'Credited author in candidate news coverage.', 'Washington bureau chief for The Atlanta Journal-Constitution, covering Georgia’s congressional delegation, elections, and federal policy.'),
  ('22d8ad17-ee93-4308-a00d-26e2fcd3950c'::uuid, 'tierra-johnson', 'Listed as Custodian by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Tierra Johnson is listed as Custodian by First Baptist Church of Christ at Macon.'),
  ('72174ccb-ef32-4080-84f1-93d22e20e256'::uuid, 'tiffany-andrews', 'Deputy Director at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/about-us/staff/', 'Deputy Director at the Middle Georgia Regional Commission.'),
  ('e87050f8-809a-4af9-b67e-0f104079212d'::uuid, 'tim-bergl', 'Listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/board-of-directors/ (verified October 23, 2026).', 'Tim Bergl is listed as 2026 Board Member by Ronald McDonald House of Central and Southwest Georgia.'),
  ('2a0736db-7a10-46b3-956d-95acbeef39cc'::uuid, 'tim-blevins', 'Identified as Captain / Central Georgia Corps Officer serving the Salvation Army''s Central Georgia / Macon ministry. Source: https://disaster.salvationarmyusa.org/articles/2026/03/11/the-salvation-army-serves-georgia-state-defense-force-during-training-exercise (reviewed October 23, 2026).', 'Salvation Army Central Georgia corps officer who led meal service for state-defense volunteers in March 2026.'),
  ('6634f25a-dbd4-496a-b1f8-d2781eebcaaa'::uuid, 'tim-jones', 'Commission Vice Chairman — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Tim Jones is listed as commission vice chairman with Macon-Bibb County Planning and Zoning Commission.'),
  ('f928c631-8edb-4204-b8ee-6adefab1058f'::uuid, 'tim-thornton', 'Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Tim Thornton appears on the published roster as board member with Downtown Macon Business Improvement District Board of Directors.'),
  ('68ea2137-b83d-4072-b9ab-802bebbdd293'::uuid, 'tim-wilder', 'Public Works Director — Macon-Bibb County Public Works Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/public-works/', 'Tim Wilder is listed as public works director with Macon-Bibb County Public Works Department.'),
  ('12aa0312-1d3e-446e-9088-1d6874fdcd9b'::uuid, 'tina-hicks', 'Vice President of Finance — Rescue Mission of Middle Georgia.
Source (reviewed October 23, 2026): https://www.rescuemissionga.com/about-us/leadership/', 'Tina Hicks is listed as vice president of finance with Rescue Mission of Middle Georgia.'),
  ('b7cae47a-186e-4d68-89f3-7cb83d8e56c5'::uuid, 'tj-heath', 'Listed as Board Member by Jay''s HOPE Foundation. Source: https://www.jayshope.org/our-board-of-directors/ (verified October 23, 2026; the published roster does not specify a term date).', 'TJ Heath is listed as Board Member by Jay''s HOPE Foundation.'),
  ('8566281f-013e-439d-9f98-36b85e450270'::uuid, 'tom-birmingham', 'Construction Manager — Rebuilding Macon.
Source (reviewed October 23, 2026): https://www.rebuildingmacon.org/team', 'Tom Birmingham is listed as construction manager with Rebuilding Macon.'),
  ('4ad7a6d5-1b05-423f-8f28-5ebd7aa054af'::uuid, 'tom-wight', 'Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Tom Wight appears on the published roster as board member with Downtown Macon Business Improvement District Board of Directors.'),
  ('221f0eb4-c9c0-4c78-9db9-3a5163461c29'::uuid, 'tommy-mixon', 'Listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Tommy Mixon is listed as Advisory Board Member on the Advisory Board of Rescue Mission of Middle Georgia.'),
  ('16bdb807-8f74-4d9e-8065-12acfaa9623b'::uuid, 'tony-lankford', 'Listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Tony Lankford is listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('c80dcf70-7187-4068-82ff-b2ce77d82656'::uuid, 'tony-may', 'Chief Assistant District Attorney — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Tony May is listed as chief assistant district attorney with Macon Judicial Circuit District Attorney’s Office.'),
  ('1da6cfe8-869e-4f9d-9d31-481ecc02123b'::uuid, 'trey-wood', 'Board Member — Macon-Bibb County Design Review Board.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Trey Wood is listed as board member with Macon-Bibb County Design Review Board.'),
  ('0b1a4cb1-96b8-4af7-899b-4366b12deb8d'::uuid, 'tricia-etheridge', 'Listed as Treasurer by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'Tricia Etheridge is listed as Treasurer by the Cooperative Baptist Fellowship of Georgia.'),
  ('cd98cd67-6fcc-4ddc-bb66-7eaa958f63f6'::uuid, 'trish-whitley', 'Immediate Past President — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Trish Whitley is listed as immediate past president with Main Street Macon Board.'),
  ('b3ec3dcf-6c03-4ace-a394-15cfa6e67738'::uuid, 'tristan-smith', 'Credited author in candidate news coverage.', 'Senior digital and video producer at Georgia Public Broadcasting, with extensive television news experience.'),
  ('24bc7fec-5b48-4a8d-99a1-9e81d77cfa7e'::uuid, 'troy-cook', 'Associate Member — Crawford County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Troy Cook is listed as associate member with Crawford County at the Middle Georgia Regional Commission.'),
  ('539f09b7-ba81-40fe-a73b-23392d33784e'::uuid, 'tucker-sargent', 'Credited author in candidate news coverage.', '41NBC evening anchor and executive producer who joined the station in 2012.'),
  ('6f567b22-60bf-4de4-9106-86be1fd96e56'::uuid, 'ty-fiveash', 'Volunteer and Event Coordinator — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Ty Fiveash is listed as volunteer and event coordinator with Keep Macon-Bibb Beautiful.'),
  ('343cb29b-e59e-49ee-91f4-dbb8264093e7'::uuid, 'ty-tagami', 'Credited author of articles published by The Macon Telegraph.', 'Capitol Beat News Service staff writer who previously spent 22 years covering education for The Atlanta Journal-Constitution.'),
  ('45bd693f-c653-4074-bed9-4bfa3d0d7e0f'::uuid, 'tyrik-wynn', 'Credited author in candidate news coverage.', '41NBC anchor and reporter presenting weekday morning Daybreak newscasts and contributing to evening coverage.'),
  ('a713e3f1-f9b8-41d3-b987-e5801788a9cb'::uuid, 'valencia-jones', 'Magistrate Judge — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/', 'Valencia Jones is listed as magistrate judge with Bibb County Civil and Magistrate Court.'),
  ('24306c19-b18f-4e6b-9737-941e96247b89'::uuid, 'valerie-stevenson', 'Listed as Housekeeping by Ronald McDonald House of Central and Southwest Georgia. Source: https://ronaldmcdonaldhousecentralswga.org/about-us/our-staff/ (verified October 23, 2026).', 'Valerie Stevenson is listed as Housekeeping by Ronald McDonald House of Central and Southwest Georgia.'),
  ('bc6317dc-c300-4c6f-ad86-66865a80dfce'::uuid, 'verda-colvin', 'Board Chair and Secretary — Macon-Bibb Citizen Advocacy.
Source (reviewed October 23, 2026): https://www.maconbibbcitizenadvocacy.org/contact-us/board-and-staff/

Secretary — Community Partnership — Bibb County Family Connection.
Source (reviewed October 23, 2026): https://bibbcommunitypartnership.org/who-we-are/board/', 'Verda Colvin is listed as board chair and secretary with Macon-Bibb Citizen Advocacy.'),
  ('5076d3e7-a67d-4a36-9bb9-56e065a1fd9a'::uuid, 'veronica-womack', 'Non-public Member — Baldwin County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Veronica Womack is listed as non-public member with Baldwin County at the Middle Georgia Regional Commission.'),
  ('6c338679-fb83-4db8-927c-193b90ae0555'::uuid, 'vicki-hinson', 'Listed as Hospitality Coordinator at Centenary United Methodist Church. Source: https://www.centenarymacon.org/our-team (verified October 23, 2026; roster term dates are not stated).', 'Vicki Hinson is listed as Hospitality Coordinator at Centenary United Methodist Church.'),
  ('1d6e5f19-33d8-461e-80b9-4a4f43701b49'::uuid, 'vicki-williams', 'Listed as Board Member by Loaves and Fishes Ministry of Macon. Source: https://www.loavesandfishesministry.org/about-us/ (verified October 23, 2026; roster term dates are not stated).', 'Vicki Williams is listed as Board Member by Loaves and Fishes Ministry of Macon.'),
  ('b95f1002-27b8-45fd-ad9f-d8b80d8ccba5'::uuid, 'virgil-watkins-jr', 'Listed as Community Disaster Program Manager for the American Red Cross Central Midwest Georgia chapter. Source: https://www.redcross.org/local/georgia/about-us/locations/central-midwest-georgia.html (verified October 23, 2026).', 'Community disaster program manager for the American Red Cross Central Midwest Georgia chapter.'),
  ('02f8a712-c6b7-41c9-9191-0629c6666238'::uuid, 'virginia-lee', 'Non-public Member — Twiggs County at the Middle Georgia Regional Commission. “Non-public member” is MGRC’s label for a private-sector council representative; this is a publicly listed civic role. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Virginia Lee is listed as non-public member with Twiggs County at the Middle Georgia Regional Commission.'),
  ('48b691c9-b6b2-44fa-87b4-989a2afef768'::uuid, 'wade-scott', 'Listed on the Macon-Bibb County Board of Health as a consumer advocate.

Source: https://northcentralhealthdistrict.org/board-of-health/', 'Listed on the Macon-Bibb County Board of Health as a consumer advocate.'),
  ('896435b9-5a89-4fd4-9445-cb7167456a36'::uuid, 'walker-johnson', 'Listed as Board Scribe at Centenary Community Ministries, Inc.. Source: https://centenarycommunityministries.org/new-page-1 (verified October 23, 2026; roster term dates are not stated).', 'Walker Johnson is listed as Board Scribe at Centenary Community Ministries, Inc.'),
  ('1fd11136-a9d6-4c77-b7c1-9b5c96637be1'::uuid, 'wallace-herring', 'Associate Member — Macon-Bibb County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Wallace Herring is listed as associate member with Macon-Bibb County at the Middle Georgia Regional Commission.'),
  ('e5b1d385-78db-4027-bc85-91ece2017e4a'::uuid, 'wanzina-jackson', 'Economic and Community Development Manager — Macon-Bibb County Economic and Community Development Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/economic-community-development/

Profile photo source: https://www.maconbibb.us/economic-community-development/

Ex Officio — Main Street Macon Board.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/main-street-macon/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Wanzina Jackson is listed as economic and community development manager with Macon-Bibb County Economic and Community Development Department.'),
  ('5462b983-2b99-4e77-9cab-ed30244a78e5'::uuid, 'wes-patton', 'Listed as secretary (county officers page; term unconfirmed) of the Bibb County Republican Party. Source: https://bibb.gop/bibb-county-gop-officers/ (reviewed October 22, 2026).', 'Listed as secretary on the Bibb County Republican Party’s undated officers page; the term is unconfirmed.'),
  ('6c9ab278-c950-42fa-b3f5-98859feba0dd'::uuid, 'will-carroll', 'Municipal Member — Crawford County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Will Carroll is listed as municipal member with Crawford County at the Middle Georgia Regional Commission.'),
  ('23d442eb-cfbe-4b7e-a508-1e0b8cd48084'::uuid, 'will-stanford', 'Board Member — Macon-Bibb County Design Review Board.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Will Stanford is listed as board member with Macon-Bibb County Design Review Board.'),
  ('029bafec-72d4-4123-8fe6-fc52829a6049'::uuid, 'will-weissert', 'Credited author in candidate news coverage.', 'Washington-based White House reporter for The Associated Press.'),
  ('0cfae968-d186-4835-a2d6-c4d0aa942592'::uuid, 'william-m-shurling-iii', 'Part-time Judge — Macon-Bibb County Municipal Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/municipal-court/', 'William M. Shurling III is listed as part-time judge with Macon-Bibb County Municipal Court.'),
  ('a93c039a-aa49-4e4a-969c-da7ec5bdd00f'::uuid, 'william-neal', 'Listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia. Source: https://cbfga.org/leadership/ (verified October 23, 2026).', 'William Neal is listed as Leadership Development Team by the Cooperative Baptist Fellowship of Georgia.'),
  ('b4a8a601-1789-4c71-9021-12d74e4c0d59'::uuid, 'willie-dumas', 'Macon-Bibb County NAACP vice president identified in October 2025 reporting as the planned successor to branch president Gwenette Westbrooks after her election to lead the Georgia NAACP. The exact date of the local presidential transition has not been independently confirmed.

Source: https://www.41nbc.com/newly-elected-georgia-naacp-president-gwenette-westbrooks-outlines-goals/', 'Macon-Bibb NAACP vice president listed among participants in the Urban League of Greater Atlanta’s 2022 State of Black Georgia report.'),
  ('cd4a78e2-bff4-4fde-bf85-a77af4255d10'::uuid, 'willie-moore', 'Listed as Men''s Program Intake Coordinator of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).', 'Willie Moore is listed as Men''s Program Intake Coordinator of Rescue Mission of Middle Georgia.'),
  ('31aeb847-01b7-4afc-97a9-628a76a0bf5d'::uuid, 'willie-pitts', 'Board Chair — Keep Macon-Bibb Beautiful.
Source (reviewed October 23, 2026): https://keepmaconbibbbeautiful.org/board-staff/', 'Willie Pitts is listed as board chair with Keep Macon-Bibb Beautiful.'),
  ('e9cfea0e-fa06-464b-b720-b9c4be28ae49'::uuid, 'willie-sidney', 'Director of Water Distribution — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/staff/', 'Willie Sidney is listed as director of water distribution with Macon Water Authority.'),
  ('4dcabc78-f919-451e-aff8-905c40619d1c'::uuid, 'wimberly-treadwell', 'Listed as Director on the Board of Directors of Rescue Mission of Middle Georgia. Source: https://www.rescuemissionga.com/about-us/leadership/ (verified October 23, 2026; roster term dates are not stated).

Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Wimberly Treadwell is listed as Director on the Board of Directors of Rescue Mission of Middle Georgia.'),
  ('e0fd73dc-bb0a-4af8-8e2d-c1a1fbc723cf'::uuid, 'wykesia-stafford', 'Commissioner — Macon-Bibb County Planning and Zoning Commission.

Sources (official rosters reviewed October 22, 2026): https://mbpz.org/team/

Profile photo source: https://mbpz.org/team/', 'Wykesia Stafford is listed as commissioner with Macon-Bibb County Planning and Zoning Commission.'),
  ('53e04388-b7a6-43dc-a610-1cfedbadf103'::uuid, 'zack-jackson', 'Listed as Associate Pastor by First Baptist Church of Christ at Macon. Source: https://fbcxmacon.org/staff/ (verified October 23, 2026).', 'Zack Jackson is listed as Associate Pastor by First Baptist Church of Christ at Macon.')
) as verified(id, slug, previous_description, description)
where p.id = verified.id
  and p.slug = verified.slug
  and p.description is not distinct from verified.previous_description;
