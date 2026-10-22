-- Paris is identified in the relevant delegation photo, while the body reports
-- the other representatives' bills. Keep that narrower relationship explicit.
update public.article_people ap set role='Mentioned'
from public.articles a, public.people p
where ap.article_id=a.id and ap.person_id=p.id and ap.role='Subject'
  and p.slug='miriam-paris'
  and a.url='https://maconmelody.com/bibb-county-legislative-delegation-introduces-slew-of-bills-under-gold-dome-in-2025/';
