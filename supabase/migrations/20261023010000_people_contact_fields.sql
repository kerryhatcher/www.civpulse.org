-- People are often officials whose public record includes a structured mailing
-- address and a fax number (election offices, county boards, etc.), so extend
-- the contact block beyond email/phone/website.

alter table public.people
  add column address_line text check (char_length(address_line) <= 200),
  add column address_line2 text check (char_length(address_line2) <= 200),
  add column city text check (char_length(city) <= 120),
  add column state text check (char_length(state) <= 80),
  add column postal_code text check (char_length(postal_code) <= 20),
  add column fax text check (char_length(fax) <= 40);

comment on column public.people.address_line is 'Primary mailing address line.';
comment on column public.people.address_line2 is 'Optional second mailing address line (suite, unit, mail bin).';
comment on column public.people.fax is 'Optional fax number.';
