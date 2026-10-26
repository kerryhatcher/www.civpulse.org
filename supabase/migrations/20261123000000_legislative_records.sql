-- Ordered after the existing future-dated migrations. Legislative records are independent of meeting attendance.
create table public.legislative_terms (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 identifier text not null, name text not null, starts_on date not null, ends_on date,
 unique(organization_id, identifier), check(ends_on is null or ends_on >= starts_on),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_terms_organization_id_idx on public.legislative_terms(organization_id);
alter table public.legislative_terms enable row level security;
revoke all on public.legislative_terms from anon, authenticated;
grant select,insert,update,delete on public.legislative_terms to authenticated;
create policy admin_access on public.legislative_terms for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_terms for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_terms',array['id'],'{"organization_id":"organizations"}');
create trigger civic_history after insert or update or delete on public.legislative_terms for each row execute function audit.capture();

create table public.legislative_sessions (
 id uuid primary key default gen_random_uuid(),
 term_id uuid not null references public.legislative_terms(id) on delete restrict,
 identifier text not null, name text not null, kind text not null default 'regular' check(kind in ('regular','special','extraordinary')),
 starts_on date not null, ends_on date, unique(term_id, identifier), check(ends_on is null or ends_on >= starts_on),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_sessions_term_id_idx on public.legislative_sessions(term_id);
alter table public.legislative_sessions enable row level security;
revoke all on public.legislative_sessions from anon, authenticated;
grant select,insert,update,delete on public.legislative_sessions to authenticated;
create policy admin_access on public.legislative_sessions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_sessions for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_sessions',array['id'],'{"term_id":"legislative_terms"}');
create trigger civic_history after insert or update or delete on public.legislative_sessions for each row execute function audit.capture();

create table public.legislative_bodies (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 legislature_id uuid not null references public.organizations(id) on delete restrict,
 kind text not null check(kind in ('legislature','chamber','committee','subcommittee')), unique(organization_id),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_bodies_organization_id_idx on public.legislative_bodies(organization_id);
create index legislative_bodies_legislature_id_idx on public.legislative_bodies(legislature_id);
alter table public.legislative_bodies enable row level security;
revoke all on public.legislative_bodies from anon, authenticated;
grant select,insert,update,delete on public.legislative_bodies to authenticated;
create policy admin_access on public.legislative_bodies for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_bodies for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_bodies',array['id'],'{"organization_id":"organizations","legislature_id":"organizations"}');
create trigger civic_history after insert or update or delete on public.legislative_bodies for each row execute function audit.capture();

create table public.legislative_body_memberships (
 id uuid primary key default gen_random_uuid(),
 body_id uuid not null references public.legislative_bodies(id) on delete restrict,
 office_term_id uuid not null references public.office_terms(id) on delete restrict,
 role text not null default 'member', starts_on date not null, ends_on date,
 unique(body_id,office_term_id,starts_on), check(ends_on is null or ends_on >= starts_on),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_body_memberships_body_id_idx on public.legislative_body_memberships(body_id);
create index legislative_body_memberships_office_term_id_idx on public.legislative_body_memberships(office_term_id);
alter table public.legislative_body_memberships enable row level security;
revoke all on public.legislative_body_memberships from anon, authenticated;
grant select,insert,update,delete on public.legislative_body_memberships to authenticated;
create policy admin_access on public.legislative_body_memberships for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_body_memberships for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_body_memberships',array['id'],'{"body_id":"legislative_bodies","office_term_id":"office_terms"}');
create trigger civic_history after insert or update or delete on public.legislative_body_memberships for each row execute function audit.capture();

create table public.bills (
 id uuid primary key default gen_random_uuid(),
 term_id uuid not null references public.legislative_terms(id) on delete restrict,
 session_id uuid not null references public.legislative_sessions(id) on delete restrict,
 body_id uuid not null references public.legislative_bodies(id) on delete restrict,
 numbering_context text not null, identifier text not null, measure_type text not null default 'bill',
 title text not null, summary text, introduced_on date not null,
 status text not null default 'introduced', source_status text,
 unique(term_id,numbering_context,identifier),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bills_term_id_idx on public.bills(term_id);
create index bills_session_id_idx on public.bills(session_id);
create index bills_body_id_idx on public.bills(body_id);
alter table public.bills enable row level security;
revoke all on public.bills from anon, authenticated;
grant select,insert,update,delete on public.bills to authenticated;
create policy admin_access on public.bills for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bills for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bills',array['id'],'{"term_id":"legislative_terms","session_id":"legislative_sessions","body_id":"legislative_bodies"}');
create trigger civic_history after insert or update or delete on public.bills for each row execute function audit.capture();

create table public.bill_versions (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 identifier text not null, title text not null, published_on date not null, text_url text not null check(text_url ~ '^https?://[^[:space:]]+$'), unique(bill_id,identifier),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_versions_bill_id_idx on public.bill_versions(bill_id);
alter table public.bill_versions enable row level security;
revoke all on public.bill_versions from anon, authenticated;
grant select,insert,update,delete on public.bill_versions to authenticated;
create policy admin_access on public.bill_versions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_versions for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_versions',array['id'],'{"bill_id":"bills"}');
create trigger civic_history after insert or update or delete on public.bill_versions for each row execute function audit.capture();

create table public.bill_amendments (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 version_id uuid references public.bill_versions(id) on delete restrict,
 identifier text not null, title text not null, offered_on date not null, text_url text check(text_url ~ '^https?://[^[:space:]]+$'), unique(bill_id,identifier),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_amendments_bill_id_idx on public.bill_amendments(bill_id);
create index bill_amendments_version_id_idx on public.bill_amendments(version_id);
alter table public.bill_amendments enable row level security;
revoke all on public.bill_amendments from anon, authenticated;
grant select,insert,update,delete on public.bill_amendments to authenticated;
create policy admin_access on public.bill_amendments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_amendments for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_amendments',array['id'],'{"bill_id":"bills","version_id":"bill_versions"}');
create trigger civic_history after insert or update or delete on public.bill_amendments for each row execute function audit.capture();

create table public.bill_actions (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 session_id uuid not null references public.legislative_sessions(id) on delete restrict,
 body_id uuid not null references public.legislative_bodies(id) on delete restrict,
 occurred_on date not null, sequence integer not null default 0, kind text not null, description text not null,
 event_id uuid references public.events(id) on delete restrict,
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_actions_bill_id_idx on public.bill_actions(bill_id);
create index bill_actions_session_id_idx on public.bill_actions(session_id);
create index bill_actions_body_id_idx on public.bill_actions(body_id);
create index bill_actions_event_id_idx on public.bill_actions(event_id);
alter table public.bill_actions enable row level security;
revoke all on public.bill_actions from anon, authenticated;
grant select,insert,update,delete on public.bill_actions to authenticated;
create policy admin_access on public.bill_actions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_actions for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_actions',array['id'],'{"bill_id":"bills","session_id":"legislative_sessions","body_id":"legislative_bodies","event_id":"events"}');
create trigger civic_history after insert or update or delete on public.bill_actions for each row execute function audit.capture();

create table public.bill_relationships (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 related_bill_id uuid not null references public.bills(id) on delete restrict,
 kind text not null check(kind in ('companion','reintroduction','substitute','related')), check(bill_id <> related_bill_id), unique(bill_id,related_bill_id,kind),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_relationships_bill_id_idx on public.bill_relationships(bill_id);
create index bill_relationships_related_bill_id_idx on public.bill_relationships(related_bill_id);
alter table public.bill_relationships enable row level security;
revoke all on public.bill_relationships from anon, authenticated;
grant select,insert,update,delete on public.bill_relationships to authenticated;
create policy admin_access on public.bill_relationships for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_relationships for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_relationships',array['id'],'{"bill_id":"bills","related_bill_id":"bills"}');
create trigger civic_history after insert or update or delete on public.bill_relationships for each row execute function audit.capture();

create table public.bill_sponsorships (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 office_term_id uuid not null references public.office_terms(id) on delete restrict,
 role text not null check(role in ('introducer','joint_introducer','primary_sponsor','cosponsor','floor_sponsor','other')),
 source_role text not null, starts_on date not null, ends_on date,
 check(ends_on is null or ends_on >= starts_on), unique(bill_id,office_term_id,role,starts_on),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_sponsorships_bill_id_idx on public.bill_sponsorships(bill_id);
create index bill_sponsorships_office_term_id_idx on public.bill_sponsorships(office_term_id);
alter table public.bill_sponsorships enable row level security;
revoke all on public.bill_sponsorships from anon, authenticated;
grant select,insert,update,delete on public.bill_sponsorships to authenticated;
create policy admin_access on public.bill_sponsorships for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_sponsorships for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_sponsorships',array['id'],'{"bill_id":"bills","office_term_id":"office_terms"}');
create trigger civic_history after insert or update or delete on public.bill_sponsorships for each row execute function audit.capture();

create table public.bill_positions (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.bills(id) on delete restrict,
 person_id uuid not null references public.people(id) on delete restrict,
 position text not null check(position in ('support','oppose','neutral')), stated_on date not null, ends_on date,
 description text not null, article_id uuid references public.articles(id) on delete restrict,
 check(ends_on is null or ends_on >= stated_on),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index bill_positions_bill_id_idx on public.bill_positions(bill_id);
create index bill_positions_person_id_idx on public.bill_positions(person_id);
create index bill_positions_article_id_idx on public.bill_positions(article_id);
alter table public.bill_positions enable row level security;
revoke all on public.bill_positions from anon, authenticated;
grant select,insert,update,delete on public.bill_positions to authenticated;
create policy admin_access on public.bill_positions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.bill_positions for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('bill_positions',array['id'],'{"bill_id":"bills","person_id":"people","article_id":"articles"}');
create trigger civic_history after insert or update or delete on public.bill_positions for each row execute function audit.capture();

create table public.legislative_votes (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.legislative_sessions(id) on delete restrict,
 body_id uuid not null references public.legislative_bodies(id) on delete restrict,
 identifier text not null, occurred_on date not null, occurred_at timestamptz,
 question text not null, category text not null,
 method text not null check(method in ('roll_call','voice','division','unanimous_consent','other')),
 outcome text not null, threshold text,
 reported_yes integer check(reported_yes >= 0), reported_no integer check(reported_no >= 0), reported_other integer check(reported_other >= 0),
 coverage text not null default 'partial' check(coverage in ('complete','partial','no_individual_record')),
 event_id uuid references public.events(id) on delete restrict,
 unique(session_id,body_id,identifier), check(method <> 'voice' or coverage = 'no_individual_record'),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_votes_session_id_idx on public.legislative_votes(session_id);
create index legislative_votes_body_id_idx on public.legislative_votes(body_id);
create index legislative_votes_event_id_idx on public.legislative_votes(event_id);
alter table public.legislative_votes enable row level security;
revoke all on public.legislative_votes from anon, authenticated;
grant select,insert,update,delete on public.legislative_votes to authenticated;
create policy admin_access on public.legislative_votes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_votes for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_votes',array['id'],'{"session_id":"legislative_sessions","body_id":"legislative_bodies","event_id":"events"}');
create trigger civic_history after insert or update or delete on public.legislative_votes for each row execute function audit.capture();

create table public.legislative_vote_bills (
 id uuid primary key default gen_random_uuid(),
 vote_id uuid not null references public.legislative_votes(id) on delete restrict,
 bill_id uuid not null references public.bills(id) on delete restrict,
 action_id uuid references public.bill_actions(id) on delete restrict,
 version_id uuid references public.bill_versions(id) on delete restrict,
 amendment_id uuid references public.bill_amendments(id) on delete restrict,
 unique(vote_id,bill_id),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_vote_bills_vote_id_idx on public.legislative_vote_bills(vote_id);
create index legislative_vote_bills_bill_id_idx on public.legislative_vote_bills(bill_id);
create index legislative_vote_bills_action_id_idx on public.legislative_vote_bills(action_id);
create index legislative_vote_bills_version_id_idx on public.legislative_vote_bills(version_id);
create index legislative_vote_bills_amendment_id_idx on public.legislative_vote_bills(amendment_id);
alter table public.legislative_vote_bills enable row level security;
revoke all on public.legislative_vote_bills from anon, authenticated;
grant select,insert,update,delete on public.legislative_vote_bills to authenticated;
create policy admin_access on public.legislative_vote_bills for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_vote_bills for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_vote_bills',array['id'],'{"vote_id":"legislative_votes","bill_id":"bills","action_id":"bill_actions","version_id":"bill_versions","amendment_id":"bill_amendments"}');
create trigger civic_history after insert or update or delete on public.legislative_vote_bills for each row execute function audit.capture();

create table public.legislative_vote_choices (
 id uuid primary key default gen_random_uuid(),
 vote_id uuid not null references public.legislative_votes(id) on delete restrict,
 office_term_id uuid not null references public.office_terms(id) on delete restrict,
 choice text not null check(choice in ('yes','no','present','abstain','absent','excused','not_voting','paired','other')),
 source_choice text not null, membership_review_note text,
 unique(vote_id,office_term_id),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_vote_choices_vote_id_idx on public.legislative_vote_choices(vote_id);
create index legislative_vote_choices_office_term_id_idx on public.legislative_vote_choices(office_term_id);
alter table public.legislative_vote_choices enable row level security;
revoke all on public.legislative_vote_choices from anon, authenticated;
grant select,insert,update,delete on public.legislative_vote_choices to authenticated;
create policy admin_access on public.legislative_vote_choices for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_vote_choices for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_vote_choices',array['id'],'{"vote_id":"legislative_votes","office_term_id":"office_terms"}');
create trigger civic_history after insert or update or delete on public.legislative_vote_choices for each row execute function audit.capture();

create table public.article_bills (
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null references public.articles(id) on delete restrict,
 bill_id uuid not null references public.bills(id) on delete restrict,
 role text not null default 'coverage' check(role in ('coverage','analysis','editorial','mention')), unique(article_id,bill_id),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index article_bills_article_id_idx on public.article_bills(article_id);
create index article_bills_bill_id_idx on public.article_bills(bill_id);
alter table public.article_bills enable row level security;
revoke all on public.article_bills from anon, authenticated;
grant select,insert,update,delete on public.article_bills to authenticated;
create policy admin_access on public.article_bills for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.article_bills for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('article_bills',array['id'],'{"article_id":"articles","bill_id":"bills"}');
create trigger civic_history after insert or update or delete on public.article_bills for each row execute function audit.capture();

create table public.legislative_event_links (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 session_id uuid not null references public.legislative_sessions(id) on delete restrict,
 body_id uuid not null references public.legislative_bodies(id) on delete restrict, unique(event_id,session_id,body_id),
 visibility text not null default 'public' check(visibility in ('public','unlisted','private')),
 source_url text check(source_url ~ '^https?://[^[:space:]]+$'),
 source_system text, source_id text, retrieved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_system is null) = (source_id is null)), unique(source_system,source_id)
);
create index legislative_event_links_event_id_idx on public.legislative_event_links(event_id);
create index legislative_event_links_session_id_idx on public.legislative_event_links(session_id);
create index legislative_event_links_body_id_idx on public.legislative_event_links(body_id);
alter table public.legislative_event_links enable row level security;
revoke all on public.legislative_event_links from anon, authenticated;
grant select,insert,update,delete on public.legislative_event_links to authenticated;
create policy admin_access on public.legislative_event_links for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.legislative_event_links for each row execute function public.set_updated_at();
insert into audit.objects(table_name,key_columns,parents) values('legislative_event_links',array['id'],'{"event_id":"events","session_id":"legislative_sessions","body_id":"legislative_bodies"}');
create trigger civic_history after insert or update or delete on public.legislative_event_links for each row execute function audit.capture();

-- Context cannot be reassigned underneath a historical record. Correct by replacing
-- dependent records explicitly; audit history preserves the correction trail.
create function public.validate_legislative_record() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb := to_jsonb(new); b public.bills; s public.legislative_sessions;
 v public.legislative_votes; t public.office_terms; body public.legislative_bodies;
 d date; person uuid; k text; linked_bill uuid;
begin
 if tg_op = 'UPDATE' then
  for k in select jsonb_object_keys(r) loop
   if (k like '%\_id' escape '\' or k in ('starts_on','ends_on','occurred_on','introduced_on','numbering_context'))
     and r->k is distinct from to_jsonb(old)->k then
    raise exception 'Historical context % cannot be reassigned; replace the record explicitly', k using errcode='23514';
   end if;
  end loop;
 end if;
 if r ? 'session_id' then select * into s from public.legislative_sessions where id=(r->>'session_id')::uuid; end if;
 if r ? 'bill_id' then select * into b from public.bills where id=(r->>'bill_id')::uuid; end if;
 if r ? 'vote_id' then select * into v from public.legislative_votes where id=(r->>'vote_id')::uuid; end if;
 if r ? 'body_id' then select * into body from public.legislative_bodies where id=(r->>'body_id')::uuid; end if;
 if s.id is not null then
  if r ? 'term_id' and (r->>'term_id')::uuid <> s.term_id then raise exception 'Session and term disagree' using errcode='23514'; end if;
  if b.id is not null and b.term_id <> s.term_id then raise exception 'Action session and bill term disagree' using errcode='23514'; end if;
  if body.id is not null and body.legislature_id <> (select organization_id from public.legislative_terms where id=s.term_id) then
   raise exception 'Body and session belong to different legislatures' using errcode='23514';
  end if;
 end if;
 if tg_table_name='legislative_vote_bills' then
  if b.term_id <> (select term_id from public.legislative_sessions where id=v.session_id) then raise exception 'Vote and bill terms disagree' using errcode='23514'; end if;
 end if;
 if r->>'version_id' is not null then
  select bill_id into linked_bill from public.bill_versions where id=(r->>'version_id')::uuid;
  if linked_bill <> b.id then raise exception 'Version belongs to another bill' using errcode='23514'; end if;
 end if;
 if r->>'amendment_id' is not null then
  select bill_id into linked_bill from public.bill_amendments where id=(r->>'amendment_id')::uuid;
  if linked_bill <> b.id then raise exception 'Amendment belongs to another bill' using errcode='23514'; end if;
 end if;
 if r->>'action_id' is not null then
  select bill_id into linked_bill from public.bill_actions where id=(r->>'action_id')::uuid;
  if linked_bill <> b.id then raise exception 'Action belongs to another bill' using errcode='23514'; end if;
 end if;
 if r ? 'office_term_id' then
  select * into t from public.office_terms where id=(r->>'office_term_id')::uuid for share;
  d := coalesce(v.occurred_on,(r->>'starts_on')::date);
  if d < t.starts_on or (t.ends_on is not null and d > t.ends_on) then raise exception 'Date outside recorded service' using errcode='23514'; end if;
  if tg_table_name='legislative_vote_choices' then
   perform 1 from public.legislative_votes where id=v.id for update;
   if v.coverage='no_individual_record' then raise exception 'This vote has no individual record' using errcode='23514'; end if;
   if exists(select 1 from public.legislative_vote_choices c join public.office_terms ot on ot.id=c.office_term_id
      where c.vote_id=v.id and ot.person_id=t.person_id and c.id<>new.id) then
    raise exception 'A person may have only one choice per vote' using errcode='23505';
   end if;
   if (t.starts_on_precision='year' or t.ends_on_precision='year' or not exists(
      select 1 from public.legislative_body_memberships m where m.body_id=v.body_id and m.office_term_id=t.id
       and m.starts_on<=d and (m.ends_on is null or m.ends_on>=d)))
      and nullif(btrim(r->>'membership_review_note'),'') is null then
    raise exception 'Uncertain service or missing membership requires a review note' using errcode='23514';
   end if;
  end if;
 end if;
 if tg_table_name='legislative_votes' and new.coverage='no_individual_record'
   and exists(select 1 from public.legislative_vote_choices where vote_id=new.id) then
  raise exception 'Remove individual choices before marking no individual record' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.validate_legislative_record() from public;
do $$ declare n text; begin
 for n in select table_name from audit.objects where table_name in (
 'legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
 'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
 'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') loop
 execute format('create trigger validate_record before insert or update on public.%I for each row execute function public.validate_legislative_record()',n);
 end loop;
end $$;
create function public.protect_legislative_service() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.person_id,new.office_id,new.starts_on,new.ends_on,new.starts_on_precision,new.ends_on_precision)
   is distinct from (old.person_id,old.office_id,old.starts_on,old.ends_on,old.starts_on_precision,old.ends_on_precision)
   and (exists(select 1 from public.legislative_vote_choices where office_term_id=old.id)
     or exists(select 1 from public.bill_sponsorships where office_term_id=old.id)
     or exists(select 1 from public.legislative_body_memberships where office_term_id=old.id)) then
  raise exception 'Service referenced by legislative history cannot be reassigned; reconcile dependent records first' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.protect_legislative_service() from public;
create trigger protect_legislative_service before update on public.office_terms for each row execute function public.protect_legislative_service();

-- Private helper follows the same acyclic parent registry as civic history.
-- Unlisted access is allowed only for explicitly requested bill/person/object IDs.
create schema if not exists legislative_private;
revoke all on schema legislative_private from public,anon,authenticated;
create function legislative_private.visible(p_table text,p_row jsonb,p_direct uuid default null,p_bill uuid default null,p_person uuid default null)
returns boolean language plpgsql stable set search_path='' as $$
declare parent record; parent_row jsonb; vis text; begin
 if p_row is null then return false; end if;
 if public.is_admin() then return true; end if;
 vis:=coalesce(p_row->>'visibility','public');
 if vis='private' then return false; end if;
 if vis='unlisted' and not coalesce((p_row->>'id')::uuid=p_direct or
   (p_table='bills' and (p_row->>'id')::uuid=p_bill) or
   (p_table='people' and (p_row->>'id')::uuid=p_person),false) then return false; end if;
 for parent in select key,value from jsonb_each_text((select parents from audit.objects where table_name=p_table)) loop
  if p_row->>parent.key is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1',parent.value) into parent_row using (p_row->>parent.key)::uuid;
   if not legislative_private.visible(parent.value,parent_row,null,p_bill,p_person) then return false; end if;
  end if;
 end loop;
 return true;
end $$;
revoke all on function legislative_private.visible(text,jsonb,uuid,uuid,uuid) from public;

-- Bounded, allowlisted read endpoint shared by the browser and MCP. Child tables
-- cannot be queried without visibility checks on every referenced object.
create function public.browse_legislation(p_table text default 'bills',p_id uuid default null,
 p_filters jsonb default '{}',p_query text default '',p_limit integer default 25,p_offset integer default 0,
 p_bill_id uuid default null,p_person_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if p_table not in ('legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
 'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
 'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') then
 raise exception 'Unknown legislative resource' using errcode='22023'; end if;
 if jsonb_typeof(p_filters)<>'object' or length(p_filters::text)>4000 or length(p_query)>500 then raise exception 'Invalid filters' using errcode='22023'; end if;
 execute format($q$
 with permitted as (
  select to_jsonb(t) as row from public.%I t
  where ($1 is null or t.id=$1) and to_jsonb(t) @> $2
   and ($3='' or concat_ws(' ',to_jsonb(t)->>'title',to_jsonb(t)->>'name',to_jsonb(t)->>'identifier',to_jsonb(t)->>'question',to_jsonb(t)->>'summary') ilike '%%'||$3||'%%')
   and legislative_private.visible(%L,to_jsonb(t),$1,$6,$7)
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,row->>'sequence',row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id;
 return result;
end $$;
revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid) to anon,authenticated;

create function public.get_person_legislative_record(p_person_id uuid,p_session_id uuid default null,p_body_id uuid default null,
 p_category text default null,p_limit integer default 25,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 with permitted as (
 select c.id,c.choice,c.source_choice,c.membership_review_note,v.id vote_id,v.question,v.category,v.method,v.outcome,v.coverage,v.occurred_on,v.source_url,
 v.session_id,v.body_id,o.name office_name,o.district,o.seat,t.id office_term_id,
 coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'identifier',b.identifier,'title',b.title))
 from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=v.id
 and legislative_private.visible('legislative_vote_bills',to_jsonb(l))), '[]'::jsonb) bills
 from public.legislative_vote_choices c join public.legislative_votes v on v.id=c.vote_id
 join public.office_terms t on t.id=c.office_term_id join public.offices o on o.id=t.office_id
 where t.person_id=p_person_id and (p_session_id is null or v.session_id=p_session_id)
 and (p_body_id is null or v.body_id=p_body_id) and (p_category is null or v.category=p_category)
 and legislative_private.visible('legislative_vote_choices',to_jsonb(c),null,null,p_person_id)
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from
 (select * from permitted order by occurred_on desc,id limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)) x),'[]'::jsonb));
$$;
revoke all on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer) from public;
grant execute on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
