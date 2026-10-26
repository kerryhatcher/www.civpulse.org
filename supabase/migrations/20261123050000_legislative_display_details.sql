-- Display metadata is emitted only after browse_legislation's recursive visibility gate.
-- Keep this helper private; public callers cannot use it to resolve arbitrary IDs.
create or replace function legislative_private.details(p_table text,p_row jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare parent record; r jsonb; labels jsonb:='{}'; links jsonb:='{}'; label text; url text;
begin
 for parent in select key,value from jsonb_each_text((select parents from audit.objects where table_name=p_table)) loop
  if p_row->>parent.key is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1',parent.value) into r using (p_row->>parent.key)::uuid;
   label:=coalesce(r->>'title',r->>'name',r->>'full_name',r->>'question',r->>'description',r->>'identifier');
   url:=null;
   if parent.value='office_terms' then
    select concat_ws(' · ',p.full_name,o.name,nullif(o.district,''),nullif(o.seat,''),t.starts_on::text),
     '/people/view/?id='||p.id::text into label,url
    from public.office_terms t join public.people p on p.id=t.person_id
    join public.offices o on o.id=t.office_id where t.id=(p_row->>parent.key)::uuid;
   elsif parent.value='legislative_bodies' then
    select name,'/orgs/'||slug||'/' into label,url from public.organizations where id=(r->>'organization_id')::uuid;
   elsif parent.value='organizations' then url:='/orgs/'||(r->>'slug')||'/';
   elsif parent.value='people' then url:='/people/view/?id='||(r->>'id');
   elsif parent.value='articles' then url:=r->>'url';
   elsif parent.value='bills' then label:=concat_ws(' — ',r->>'identifier',r->>'title');
   end if;
   if label is not null then labels:=labels||jsonb_build_object(parent.key,label); end if;
   if url is not null then links:=links||jsonb_build_object(parent.key,url); end if;
  end if;
 end loop;
 return jsonb_build_object('labels',labels,'links',links);
end $$;
revoke all on function legislative_private.details(text,jsonb) from public,anon,authenticated;
