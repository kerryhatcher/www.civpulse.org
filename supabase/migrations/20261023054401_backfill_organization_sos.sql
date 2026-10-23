-- Historical SOS values from compiled Markdown research; not a fresh registry verification.
-- Match existing slugs only, fill missing fields only, never create organizations.
update public.organizations set
  sos_control_number = coalesce(sos_control_number, 'H601873'),
  sos_business_type = coalesce(sos_business_type, 'Domestic Nonprofit Corporation'),
  sos_status = coalesce(sos_status, 'Active/Compliance'),
  sos_formation_date = coalesce(sos_formation_date, '1976-02-27'::date),
  sos_last_annual_registration = coalesce(sos_last_annual_registration, '2026'),
  sos_principal_office = coalesce(sos_principal_office, 'PO Box 13358, Macon, GA, 31208-3358, USA'),
  sos_registered_agent = coalesce(sos_registered_agent, 'Nathan Lott, 950 Third Street, Macon, GA, 31201, USA'),
  sos_county = coalesce(sos_county, 'Bibb'),
  sos_record_url = coalesce(sos_record_url, 'https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=534677&businessType=Domestic%20Nonprofit%20Corporation&fromSearch=True'),
  sos_officers = coalesce(sos_officers, '- **CEO:** Bowen Shoemaker, 950 Third St, Macon, GA, 31201, USA
- **Secretary:** Fran Fickling, 950 Third St, Macon, GA, 31201, USA
- **CFO:** Pat Muse, 950 Third St, Macon, GA, 31201, USA')
where slug = 'historic-macon-foundation';

update public.organizations set
  sos_control_number = coalesce(sos_control_number, 'J102177'),
  sos_business_type = coalesce(sos_business_type, 'Domestic Nonprofit Corporation'),
  sos_status = coalesce(sos_status, 'Active/Compliance'),
  sos_formation_date = coalesce(sos_formation_date, '1980-01-10'::date),
  sos_last_annual_registration = coalesce(sos_last_annual_registration, '2026'),
  sos_principal_office = coalesce(sos_principal_office, '310 Cherry ST, MACON, GA, 31201, USA'),
  sos_registered_agent = coalesce(sos_registered_agent, 'Harold Young'),
  sos_county = coalesce(sos_county, 'Bibb'),
  sos_record_url = coalesce(sos_record_url, 'https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=606602&businessType=Domestic%20Nonprofit%20Corporation&fromSearch=True'),
  sos_officers = coalesce(sos_officers, '- **CFO:** Barrie Diane Miller-Howard, 310 Cherry ST, Macon, GA, 31201, USA
- **CEO:** Harold Young, 310 Cherry ST, Macon, GA, 31201, USA
- **Secretary:** Renita Patterson, 3370 Club Drive, Macon, GA, 31217-4906, USA')
where slug = 'tubman-african-american-museum';

update public.organizations set
  sos_control_number = coalesce(sos_control_number, '0029550'),
  sos_business_type = coalesce(sos_business_type, 'Domestic Nonprofit Corporation'),
  sos_status = coalesce(sos_status, 'Active/Compliance'),
  sos_formation_date = coalesce(sos_formation_date, '2000-06-26'::date),
  sos_last_annual_registration = coalesce(sos_last_annual_registration, '2026'),
  sos_principal_office = coalesce(sos_principal_office, '3888 Northside Drive, Suite B, Macon, GA, 31210, USA'),
  sos_registered_agent = coalesce(sos_registered_agent, 'Elizabeth Hammock'),
  sos_county = coalesce(sos_county, 'Bibb'),
  sos_record_url = coalesce(sos_record_url, 'https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=29550&businessType=Domestic%20Nonprofit%20Corporation&fromSearch=True'),
  sos_officers = coalesce(sos_officers, '- Susanna Gwen Patterson — Principal/officer (per GA SoS officer search; exact title not captured)
- Elizabeth Hammock — Registered Agent')
where slug = 'central-georgia-casa';

update public.organizations set
  sos_control_number = coalesce(sos_control_number, '16099724'),
  sos_business_type = coalesce(sos_business_type, 'Domestic Nonprofit Corporation'),
  sos_status = coalesce(sos_status, 'Active/Compliance'),
  sos_formation_date = coalesce(sos_formation_date, '2016-10-21'::date),
  sos_last_annual_registration = coalesce(sos_last_annual_registration, '2028'),
  sos_principal_office = coalesce(sos_principal_office, '1120 Oakcliff Rd, PO Box 1952, Macon, GA, 31202, USA'),
  sos_registered_agent = coalesce(sos_registered_agent, 'Curtis Hertwig, J.'),
  sos_county = coalesce(sos_county, 'Bibb'),
  sos_naics_code = coalesce(sos_naics_code, 'Arts, Entertainment, and Recreation'),
  sos_record_url = coalesce(sos_record_url, 'https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=2259170&businessType=Domestic%20Nonprofit%20Corporation&fromSearch=True')
where slug = 'bike-walk-macon';
