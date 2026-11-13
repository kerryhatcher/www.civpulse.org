-- Official-source summaries, reviewed 2026-10-23.
-- Provenance: docs/research/official-profile-summaries-2026-10-23.json
-- Exact-description guard preserves subsequent admin edits. Candidate profiles excluded.
update public.people p
set description = verified.description
from (values
  ('andrea-cooke', 'Commissioner, District 5 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Andrea Cooke is a marriage and family therapist and community advocate representing Macon-Bibb County’s District 5.'),
  ('anita-r-howard', 'District Attorney — Macon Judicial Circuit District Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconjudicialcircuitda.com/

Profile photo source: https://www.maconjudicialcircuitda.com/about-the-macon-judicial-circuit-district-attorney/leadership/', 'Anita R. Howard is the Macon Judicial Circuit’s district attorney, elected in 2020 to serve Bibb, Crawford, and Peach counties.'),
  ('aprill-adside-smith', 'Associate Member; Gordon Mayor — Wilkinson County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Aprill-Adside Smith is Gordon’s mayor and an associate member of the Middle Georgia Regional Commission.'),
  ('barney-t-hester', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Barney T. Hester represents District 4 on the Bibb County Board of Education.'),
  ('bernice-banks', 'Municipal Member; Hawkinsville Commissioner — Pulaski County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Bernice Banks is a Hawkinsville commissioner and municipal member of the Middle Georgia Regional Commission.'),
  ('bert-bivins', 'Board Member — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/board-of-directors/', 'Bert Bivins serves on Macon-Bibb County’s Land Bank Authority board, which supports neighborhood revitalization and efforts to address blighted property.'),
  ('bill-howell', 'Commissioner, District 7 — Macon-Bibb County Board of Commissioners. Macon-Bibb County Representative — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/ ; https://maconwater.org/your-mwa/board-members/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Bill Howell represents Macon-Bibb County’s District 7 and also serves on the Macon Water Authority board.'),
  ('bill-sharp', 'County Member; County Commissioner — Putnam County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Bill Sharp is a Putnam County commissioner and county member of the Middle Georgia Regional Commission.'),
  ('brendalyn-bailey', 'Listed on the Macon-Bibb County Board of Health in its county governing-authority CEO/designee seat.

Source: https://northcentralhealthdistrict.org/board-of-health/

Commissioner, District 9 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Brendalyn Bailey represents Macon-Bibb County’s District 9 and has a background in education and human resources.'),
  ('charles-murphy', 'Board Member — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Profile photo source: https://mbcta.net/board/', 'Charles Murphy serves on the Macon-Bibb County Transit Authority board, which governs the local public transit authority.'),
  ('charles-richardson', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Charles Richardson serves on Macon-Bibb’s Urban Development Authority and is a former Telegraph editorial page editor with extensive civic board experience.'),
  ('charles-williams', 'Municipal Member; Jeffersonville Mayor — Twiggs County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Charles Williams is Jeffersonville’s mayor and a municipal member of the Middle Georgia Regional Commission.'),
  ('chris-weidner', 'County Member; County Commission Chairman — Jones County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Chris Weidner is Jones County’s commission chairman and a county member of the Middle Georgia Regional Commission.'),
  ('clifford-holmes', 'Associate Member; Warner Robins Councilman — Houston County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Clifford Holmes is a Warner Robins councilmember and associate member of the Middle Georgia Regional Commission.'),
  ('connie-l-williford', 'Superior Court Judge of the Macon Judicial Circuit, listed on the Bibb County Superior Court’s official judges directory.

Source: https://www.maconbibb.us/superior-court/superior-court-judges/', 'Connie L. Williford serves as a judge of the Bibb County Superior Court.'),
  ('dale-jump', 'County Member; County Commissioner — Crawford County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Dale Jump is a Crawford County commissioner and county member of the Middle Georgia Regional Commission.'),
  ('dan-a-sims', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Dan A. Sims is Bibb County’s school superintendent, with a background as a teacher, principal, and Atlanta Public Schools associate superintendent.'),
  ('dan-perdue', 'County Member; County Commission Chairman — Houston County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Dan Perdue is Houston County’s commission chairman and a county member of the Middle Georgia Regional Commission.'),
  ('daryl-j-morton', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Daryl J. Morton is president of the Bibb County Board of Education and represents the countywide Post 7 seat.'),
  ('dave-dickey', 'Board Member — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Profile photo source: https://mbcta.net/board/', 'Dave Dickey serves on the Macon-Bibb County Transit Authority board, which governs the local public transit authority.'),
  ('david-davis', 'Sheriff — Bibb County Sheriff''s Office.

Sources (official rosters reviewed October 22, 2026): https://bibbsheriff.us/

Profile photo source: https://bibbsheriff.us/', 'David Davis is Bibb County’s sheriff and an FBI National Academy graduate who began his career with the sheriff’s office in 1979.'),
  ('david-l-mincey-iii', 'Superior Court Judge of the Macon Judicial Circuit, listed on the Bibb County Superior Court’s official judges directory.

Source: https://www.maconbibb.us/superior-court/superior-court-judges/', 'David L. Mincey III serves as a judge of the Bibb County Superior Court.'),
  ('deborah-garcia', 'Board Member — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Profile photo source: https://mbcta.net/board/', 'Deborah Garcia serves on the Macon-Bibb County Transit Authority board, which governs the local public transit authority.'),
  ('denese-shinholster', 'Municipal Member; Milledgeville Councilwoman — Baldwin County; Council Vice Chair (2026–27); Executive Committee; Budget, Audit and Personnel Committee Chair at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/', 'Denese Shinholster is a Milledgeville councilmember and municipal member of the Middle Georgia Regional Commission.'),
  ('donice-bryant', 'Commissioner, District 8 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Donice Bryant represents District 8 on the Macon-Bibb County Board of Commissioners.'),
  ('duke-groover', 'County Attorney — Macon-Bibb County Attorney’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/county-attorney/', 'Duke Groover is Macon-Bibb County’s attorney, advising county leaders and pension boards and overseeing the government’s legal work.'),
  ('dwight-jones', 'Elected Board Member, District 3 — Macon Water Authority. Board Vice Chair — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/board-members/ ; https://mbcia.com/about/our-team/

Profile photo source: https://mbcia.com/about/our-team/', 'Dwight Jones represents District 3 on the Macon Water Authority board and chairs its finance committee.'),
  ('ed-barbee', 'Municipal Member; Gray Mayor — Jones County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Ed Barbee is Gray’s mayor and a municipal member of the Middle Georgia Regional Commission.'),
  ('elaine-lucas', 'Elected Board Member, District 1 — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/board-members/

Profile photo source: https://maconwater.org/your-mwa/board-members/', 'Elaine Lucas represents District 1 on the Macon Water Authority board and chairs its personnel committee.'),
  ('emily-davis', 'County Member; County Commissioner — Baldwin County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Emily Davis is a Baldwin County commissioner and county member of the Middle Georgia Regional Commission.'),
  ('eric-bush', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Eric Bush serves as chief financial officer for the Bibb County School District.'),
  ('erica-woodford', 'Clerk of Superior Court — Bibb County Clerk of Superior Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/superior-court/clerk-of-superior-court/

Profile photo source: https://www.maconbibb.us/superior-court/clerk-of-superior-court/', 'Erica Woodford is Bibb County’s clerk of Superior Court, whose office handles court filings, real estate records, and jury services.'),
  ('ethel-lett', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Ethel Lett serves as assistant superintendent for teaching & learning for the Bibb County School District.'),
  ('flint-shepherd', 'County Member; County Commission Vice-Chairman — Wilkinson County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Flint Shepherd is Wilkinson County’s commission vice chairman and a county member of the Middle Georgia Regional Commission.'),
  ('frank-patterson', 'Elected Board Vice Chairman, District 4 — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/board-members/

Profile photo source: https://maconwater.org/your-mwa/board-members/', 'Frank Patterson is the Macon Water Authority’s District 4 board member and vice chairman, and chairs its engineering committee.'),
  ('gary-bechtel', 'Elected Board Chairman — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/board-members/

Profile photo source: https://maconwater.org/your-mwa/board-members/', 'Gary Bechtel is the elected chairman of the Macon Water Authority board.'),
  ('george-thomas', 'Board Chair — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/board-of-assessors', 'George Thomas chairs Macon-Bibb County’s Board of Tax Assessors and has a background in property management and community programs.'),
  ('henry-c-ficklin', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Henry C. Ficklin represents District 2 on the Bibb County Board of Education.'),
  ('james-a-epps-jr', 'Lieutenant Governor’s Appointee — State at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'James A. Epps Jr. serves on the Middle Georgia Regional Commission as a lieutenant governor’s appointee.'),
  ('james-m-freeman', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'James M. Freeman represents District 6 on the Bibb County Board of Education.'),
  ('james-richardson', 'Associate Member; Byron Councilman — Peach County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'James Richardson is a Byron councilmember and associate member of the Middle Georgia Regional Commission.'),
  ('james-vaughn', 'Governor’s Appointee — State at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'James Vaughn serves on the Middle Georgia Regional Commission as a governor’s appointee.'),
  ('jamie-cassady', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Jamie Cassady serves as assistant superintendent for student affairs for the Bibb County School District.'),
  ('jan-beeland', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Jan Beeland serves on Macon-Bibb’s Urban Development Authority and is a former Macon Arts Alliance executive director with a background in historic preservation.'),
  ('jeff-hanson', 'Chief Judge — State Court of Bibb County.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/state-court/', 'Jeff Hanson serves as chief judge of the State Court of Bibb County.'),
  ('jeffery-o-monroe', 'Superior Court Judge of the Macon Judicial Circuit, listed on the Bibb County Superior Court’s official judges directory.

Source: https://www.maconbibb.us/superior-court/superior-court-judges/', 'Jeffery O. Monroe serves as a judge of the Bibb County Superior Court.'),
  ('jenna-s-mashburn', 'County Member; Sole Commissioner — Pulaski County; Council Chair (2026–27); Executive Committee; GARC Policy Member at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/

Profile photo source: https://www.middlegeorgiarc.org/about-us/mission-values/', 'Jenna S. Mashburn is Pulaski County’s sole commissioner and a county member of the Middle Georgia Regional Commission.'),
  ('jim-crisp', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Jim Crisp serves on Macon-Bibb’s Urban Development Authority and is the retired founding artistic director of Theatre Macon.'),
  ('jim-davis', 'Board Vice Chair — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/board-of-assessors', 'Jim Davis is vice chair of Macon-Bibb County’s Board of Tax Assessors and a former tax commissioner and chief appraiser.'),
  ('joey-hulett', 'Commissioner, District 4 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Joey Hulett represents District 4 on the Macon-Bibb County Board of Commissioners.'),
  ('john-reid', 'Municipal Member; Eatonton Mayor — Putnam County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'John Reid is Eatonton’s mayor and a municipal member of the Middle Georgia Regional Commission.'),
  ('jonathan-alderman', 'Board Member — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/board-of-assessors', 'Jonathan Alderman serves on Macon-Bibb County’s Board of Tax Assessors and is an attorney experienced in estate planning and real estate.'),
  ('jonathan-barton', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Jonathan Barton serves on Macon-Bibb’s Urban Development Authority and has a background in professional baseball, banking, and community development.'),
  ('kaitlynn-kressin', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/

Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Kaitlynn Kressin serves on Macon-Bibb’s Urban Development Authority and is a downtown business owner and Mercer University graduate.'),
  ('katika-lovett', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Katika Lovett serves as deputy superintendent for the Bibb County School District.'),
  ('keith-moffett', 'County Manager — Macon-Bibb County Manager’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/county-manager/dr-keith-moffett/

Profile photo source: https://www.maconbibb.us/county-manager/dr-keith-moffett/', 'Keith Moffett is Macon-Bibb County’s manager, a Navy veteran, and a former county administrator and local E-911 director.'),
  ('ken-fowler', 'County Member; County Commission Chairman — Twiggs County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Ken Fowler is Twiggs County’s commission chairman and a county member of the Middle Georgia Regional Commission.'),
  ('ken-smith', 'Superior Court Judge of the Macon Judicial Circuit, listed on the Bibb County Superior Court’s official judges directory.

Source: https://www.maconbibb.us/superior-court/superior-court-judges/', 'Ken Smith serves as a judge of the Bibb County Superior Court.'),
  ('kevin-adams', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Kevin Adams serves as chief information officer for the Bibb County School District.'),
  ('kristin-c-hanlon', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Kristin C. Hanlon represents District 3 on the Bibb County Board of Education and serves as its treasurer.'),
  ('lamarcus-davis', 'Associate Member; County Commissioner — Monroe County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Lamarcus Davis is a Monroe County commissioner and associate member of the Middle Georgia Regional Commission.'),
  ('larhonda-patrick', 'Associate Member; Warner Robins Mayor — Houston County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'LaRhonda Patrick is Warner Robins’ mayor and an associate member of the Middle Georgia Regional Commission.'),
  ('latoya-smith', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'LaToya Smith serves as assistant superintendent for human resources for the Bibb County School District.'),
  ('leigh-ann-junod', 'Board Member — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/board-of-assessors', 'Leigh Ann Junod serves on Macon-Bibb County’s Board of Tax Assessors and is a certified residential appraiser specializing in homes and land.'),
  ('leon-jones', 'Coroner — Bibb County Coroner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/coroners-office/contact-us/', 'Leon Jones is Bibb County’s coroner, leading the county coroner’s office.'),
  ('lester-miller', 'Mayor — Macon-Bibb County Board of Commissioners. Board Member; Macon-Bibb County Mayor — Macon-Bibb County Industrial Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/ ; https://mbcia.com/about/our-team/

Profile photo source: https://www.maconbibb.us/commissioners/

MGRC: County Member; Macon-Bibb County Mayor — Macon-Bibb County; Pension and Retirement Plan Committee, Post 1 at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/

Board Member (published roster) — Downtown Macon Business Improvement District Board of Directors.

Sources (reviewed October 23, 2026): https://newtownmacon.com/experience/bid/

Board roster is published without term dates; membership is recorded as listed, without certifying a 2026 appointment term.', 'Lester Miller is Macon-Bibb County’s mayor, an attorney and small business owner, and a former Bibb County school board president.'),
  ('lisa-berrian', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Lisa Berrian serves on Macon-Bibb’s Urban Development Authority and has a background in newspaper management and nonprofit fundraising.'),
  ('lisa-w-boyd', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Lisa W. Boyd represents the countywide Post 8 seat on the Bibb County Board of Education.'),
  ('lloyd-hatfield', 'Associate Member; Ivey Councilman — Wilkinson County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Lloyd Hatfield is an Ivey councilmember and associate member of the Middle Georgia Regional Commission.'),
  ('lori-rodgers', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Lori Rodgers serves as assistant superintendent of district effectiveness & federal programs for the Bibb County School District.'),
  ('louis-frank-tompkins', 'Board Chairman — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/', 'Louis Frank Tompkins chairs the Macon-Bibb County Transit Authority board, which governs the local public transit authority.'),
  ('lynn-farmer', 'Board Vice Chair — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Profile photo source: https://mbcta.net/board/', 'Lynn Farmer is vice chair of the Macon-Bibb County Transit Authority board.'),
  ('marshall-talley', 'Elected Board Member, District 2 — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://maconwater.org/your-mwa/board-members/

Profile photo source: https://maconwater.org/your-mwa/board-members/', 'Marshall Talley represents District 2 on the Macon Water Authority board and serves on its finance and personnel committees.'),
  ('martin-moseley', 'County Member; County Commission Chairman — Peach County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Martin Moseley is Peach County’s commission chairman and a county member of the Middle Georgia Regional Commission.'),
  ('michael-chidester', 'Municipal Member; Byron Mayor — Peach County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Michael Chidester is Byron’s mayor and a municipal member of the Middle Georgia Regional Commission.'),
  ('mike-dodd', 'Associate Member; Forsyth Councilman — Monroe County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Mike Dodd is a Forsyth councilmember and associate member of the Middle Georgia Regional Commission.'),
  ('myrtice-c-johnson', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1', 'Myrtice C. Johnson represents District 1 on the Bibb County Board of Education.'),
  ('nancy-nash', 'Governor’s Appointee — State at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/

Vice Chair — Middle Georgia Community Food Bank.
Source (reviewed October 23, 2026): https://mgcfb.org/about-us/', 'Nancy Nash serves on the Middle Georgia Regional Commission as a governor’s appointee.'),
  ('pamela-white-colbert', 'Chief Judge — Bibb County Civil and Magistrate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/civil-magistrate-court/

Profile photo source: https://www.maconbibb.us/civil-magistrate-court/

Board Member — Macon-Bibb Citizen Advocacy.
Source (reviewed October 23, 2026): https://www.maconbibbcitizenadvocacy.org/contact-us/board-and-staff/

Board Member — Macon-Bibb County Economic Opportunity Council.
Source (reviewed October 23, 2026): https://www.maconbibbeoc.com/about-us/board-of-directors/', 'Pamela White-Colbert is Bibb County’s chief civil and magistrate judge and a former assistant district attorney with three decades of prosecutorial experience.'),
  ('paul-bronson', 'Commissioner, District 2 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Paul Bronson represents Macon-Bibb County’s District 2 and is an Army Reserve officer who has supported local student leadership programs.'),
  ('philip-t-raymond-iii', 'Chief Judge of the Macon Judicial Circuit, listed on the Bibb County Superior Court’s official judges directory.

Source: https://www.maconbibb.us/superior-court/superior-court-judges/', 'Philip T. Raymond III serves as chief judge of the Bibb County Superior Court.'),
  ('randall-walker', 'Municipal Member; Perry Mayor — Houston County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Randall Walker is Perry’s mayor and a municipal member of the Middle Georgia Regional Commission.'),
  ('raymond-wilder', 'Commissioner, District 6 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Raymond Wilder represents District 6 on the Macon-Bibb County Board of Commissioners.'),
  ('rebecca-l-grist', 'Solicitor-General — Bibb County Solicitor-General’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/solicitor/', 'Rebecca L. Grist is Bibb County’s solicitor-general, leading the prosecution of misdemeanor cases in state and municipal courts.'),
  ('ryan-griffin', 'Board Member — Macon-Bibb County Urban Development Authority.

Sources (official rosters reviewed October 22, 2026): https://maconbibbuda.com/your-uda/

Profile photo source: https://maconbibbuda.com/your-uda/', 'Ryan Griffin serves on Macon-Bibb’s Urban Development Authority and works in construction, real estate, and downtown investment.'),
  ('sam-kitchens', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Sam Kitchens serves as assistant superintendent of operations for the Bibb County School District.'),
  ('sarah-s-harris', 'Probate Court Judge — Bibb County Probate Court.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/probate-court/

Profile photo source: https://www.maconbibb.us/probate-court/', 'Sarah S. Harris is Bibb County’s probate judge, serving a court responsible for wills, estates, and guardianships.'),
  ('shane-edwards', 'Fire Chief — Macon-Bibb County Fire Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/fire-department/fire-chief/

Profile photo source: https://www.maconbibb.us/fire-department/fire-chief/', 'Shane Edwards is Macon-Bibb County’s fire chief, rising through the department’s ranks before his appointment in 2022.'),
  ('sharell-f-lewis', 'Judge — State Court of Bibb County.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/state-court/', 'Sharell F. Lewis serves as a judge of the State Court of Bibb County.'),
  ('shonya-mapp', 'Associate Member; Milledgeville Councilwoman — Baldwin County at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Shonya Mapp is a Milledgeville councilmember and associate member of the Middle Georgia Regional Commission.'),
  ('stanley-stewart', 'Listed on the Macon-Bibb County Board of Health in its largest-city CEO/designee seat.

Source: https://northcentralhealthdistrict.org/board-of-health/

Commissioner, District 3 — Macon-Bibb County Board of Commissioners.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/

Profile photo source: https://www.maconbibb.us/commissioners/', 'Stanley Stewart represents District 3 on the Macon-Bibb County Board of Commissioners.'),
  ('stephanie-hartley', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Stephanie Hartley serves as chief communications officer for the Bibb County School District.'),
  ('sundra-m-woodford', 'Bibb County Board of Education member; seat and officer role follow the official roster.

Source: https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1

Board Vice Chair — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/board-of-directors/', 'Sundra M. Woodford represents District 5 as Bibb County school board vice president and is vice chair of the county Land Bank Authority.'),
  ('tamara-candis', 'Bibb County School District administrator listed in its official leadership directory.

Source: https://www.bcsdk12.net/about-us/senior-cabinet', 'Tamara Candis serves as associate superintendent of schools for the Bibb County School District.'),
  ('tekquell-watson', 'Chief Information Officer — Macon-Bibb County Information Technology Department.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/macon-bibb-hires-new-cio/', 'Tekquell Watson is Macon-Bibb County’s chief information officer and an Air Force veteran with experience in federal technology leadership and cybersecurity.'),
  ('thomas-jackson-gillon-jr', 'Election Supervisor — Bibb County Board of Elections.

Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Thomas Jackson Gillon Jr. is Bibb County’s elections supervisor, overseeing election administration for the county Board of Elections.'),
  ('tom-ellington', 'Board Chair — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/board-of-directors/

Member of the Bibb County Board of Elections, listed on its October 15, 2026 agenda.
Source: https://www.maconbibb.us/wp-content/uploads/2026/10/AGENDA-OCTOBER-15-2026.pdf', 'Tom Ellington chairs Macon-Bibb County’s Land Bank Authority, which works on neighborhood revitalization, affordable housing, and blight removal.'),
  ('tommy-stalnaker', 'Governor’s Appointee — State at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/', 'Tommy Stalnaker serves on the Middle Georgia Regional Commission as a governor’s appointee.'),
  ('valerie-wynn', 'Mayor Pro Tem; Commissioner, District 1 — Macon-Bibb County Board of Commissioners. Macon-Bibb County Representative — Macon Water Authority.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibb.us/commissioners/ ; https://maconwater.org/your-mwa/board-members/

Profile photo source: https://www.maconbibb.us/commissioners/

MGRC: Municipal Member — Macon-Bibb County; Budget, Audit and Personnel Committee at the Middle Georgia Regional Commission. 

Sources (official rosters reviewed October 23, 2026): https://www.middlegeorgiarc.org/mgrc-council-2/ ; https://www.middlegeorgiarc.org/mgrc-council-2/officers-and-committees/', 'Valerie Wynn is Macon-Bibb County’s mayor pro tem and District 1 commissioner, and also serves on the Macon Water Authority board.'),
  ('veronica-mcclendon', 'Board Member — Macon-Bibb County Land Bank Authority.

Sources (official rosters reviewed October 22, 2026): https://maconlandbank.org/board-of-directors/', 'Veronica McClendon serves on Macon-Bibb County’s Land Bank Authority board, which supports neighborhood revitalization and affordable housing.'),
  ('wade-mccord', 'Tax Commissioner — Macon-Bibb County Tax Commissioner’s Office.

Sources (official rosters reviewed October 22, 2026): https://www.maconbibbtax.us/

Profile photo source: https://www.maconbibbtax.us/', 'Wade McCord is Macon-Bibb County’s tax commissioner and an Army veteran who joined the tax office in 1995.'),
  ('weston-stroud', 'Board Member — Macon-Bibb County Transit Authority.

Sources (official rosters reviewed October 22, 2026): https://mbcta.net/board/

Macon-Bibb County Traffic Safety Manager.
Source: https://www.maconbibb.us/pedestrian-safety-summit-highlights-progress-partnerships-and-continued-work/

Board Secretary — Macon Milledgeville Regional Habitat for Humanity.
Source (reviewed October 23, 2026): https://www.mmrhabitat.org/meet-mahfh', 'Weston Stroud serves on the Macon-Bibb County Transit Authority board, which governs the local public transit authority.'),
  ('yashica-kendrick', null, 'Yashica Kendrick is identified as Bibb County’s chief registrar in official 2025 election-board records.'),
  ('yvonne-holmes', 'Board Member — Macon-Bibb County Board of Tax Assessors.

Sources (official rosters reviewed October 22, 2026): https://www.bibbassessors.com/board-of-assessors', 'Yvonne Holmes serves on Macon-Bibb County’s Board of Tax Assessors and has a background in banking, photography-business management, and equalization-board service.')
) as verified(slug, previous_description, description)
where p.slug = verified.slug
  and p.kind in ('elected_official', 'appointed_official')
  and p.description is not distinct from verified.previous_description;
