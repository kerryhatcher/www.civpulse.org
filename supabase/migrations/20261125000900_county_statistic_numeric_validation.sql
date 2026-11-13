-- Follow-up to the locally applied county-statistics migration; preserve history.
alter table public.county_statistics add constraint county_statistic_finite_bounds
 check ((lower_bound is null or lower_bound not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
 and (upper_bound is null or upper_bound not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)));
create or replace function public.validate_county_statistic() returns trigger language plpgsql set search_path='' as $$
declare unit_name text;
begin
 select unit into unit_name from public.county_statistic_indicators where code=new.indicator_code;
 if new.value is not null and (
   (unit_name='percent' and new.indicator_code='PST120225' and new.value < -100)
   or (unit_name='percent' and new.indicator_code<>'PST120225' and (new.value<0 or new.value>100))
   or (unit_name<>'percent' and new.value<0)
 ) then raise exception 'Statistic value outside its unit range' using errcode='23514'; end if;
 new.updated_at=clock_timestamp();
 return new;
end;
$$;
revoke all on function public.validate_county_statistic() from public,anon,authenticated;
