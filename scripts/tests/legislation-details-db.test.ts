import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadPublicLegislationDetails} from '../../apps/web/src/lib/legislation-detail-build-data';
test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('full public details exclude restricted parents, children and people; live gates remain intact',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback detail fixtures');
 try{await sql.begin(async tx=>{
  const tag=crypto.randomUUID();const [org]=await tx`insert into organizations(name,slug) values('Detail export QA',${tag}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values(${org.id},'qa','Detail QA term','2025-01-01') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values(${org.id},${org.id},'chamber') returning id`;
  const hidden:string[]=[],published:string[]=[],bills:string[]=[],votes:string[]=[],sessions:string[]=[];
  for(const visibility of ['public','unlisted','private']) {
   const [s]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,visibility) values(${term.id},${visibility},${'Detail QA '+visibility+' session'},'2025-01-01',${visibility}) returning id`;sessions.push(s.id);
   const [b]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values(${term.id},${sessions[0]},${body.id},'qa',${visibility},${'Detail QA '+visibility+' bill'},'2025-01-01',${visibility}) returning id`;bills.push(b.id);
   const [v]=await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage,visibility) values(${sessions[0]},${body.id},${visibility},'2025-02-01',${'Detail QA '+visibility+' vote'},'cloture','roll_call','passed','complete',${visibility}) returning id`;votes.push(v.id);
   (visibility==='public'?published:hidden).push(s.id,b.id,v.id);
   const [a]=await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,kind,description,visibility) values(${bills[0]},${sessions[0]},${body.id},'2025-02-01','introduced',${'Detail QA '+visibility+' action'},${visibility}) returning id`;
   if(visibility!=='public')hidden.push(a.id);
   if(visibility!=='public') {
    const [child]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values(${term.id},${s.id},${body.id},'qa',${visibility+'-child'},'Detail QA hidden-parent child','2025-01-01') returning id`;hidden.push(child.id);
   }
  }
  for(let i=0;i<51;i++) await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,sequence,kind,description) values(${bills[0]},${sessions[0]},${body.id},'2025-02-01',${i+1},'referred',${'Detail QA public action '+i})`;
  const [office]=await tx`insert into offices(organization_id,name) values(${org.id},'Detail QA office') returning id`;
  for(const visibility of ['public','unlisted','private','hidden-person']) {
   const [p]=await tx`insert into people(full_name,slug,kind,visibility) values(${`Detail QA ${visibility} person`},${crypto.randomUUID()},'other',${visibility==='hidden-person'?'private':'public'}) returning id`;
   const [service]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values(${office.id},${p.id},'elected','2025-01-01') returning id`;
   const [c]=await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note,visibility) values(${votes[0]},${service.id},'yes','Yea','Synthetic identity reconciled',${visibility==='hidden-person'?'public':visibility}) returning id`;
   if(visibility!=='public')hidden.push(c.id);if(visibility==='hidden-person')hidden.push(p.id,service.id);
  }
  await tx`update legislative_votes set reported_yes=4,reported_no=0,reported_other=0 where id=${votes[0]}`;
  const [calendar]=await tx`insert into calendars(organization_id,slug,name) values(${org.id},${tag},'Detail QA calendar') returning id`;
  for(const visibility of ['public','unlisted','private']) {
   const [e]=await tx`insert into events(calendar_id,title,starts_at,visibility) values(${calendar.id},${'Detail QA '+visibility+' event'},'2025-02-01Z',${visibility}) returning id`;
   const [link]=await tx`insert into legislative_event_links(event_id,session_id,body_id) values(${e.id},${sessions[0]},${body.id}) returning id`;if(visibility!=='public')hidden.push(e.id,link.id);
  }
  let requests=0;
  const client={rpc:async(name:string,a:any)=>{
   requests++;
   const [r]=name==='export_public_legislation_page'?await tx`select public.export_public_legislation_page(${a.p_table},${a.p_offset},${a.p_limit}) data`:
    await tx`select public.browse_legislation(p_table=>${a.p_table},p_offset=>${a.p_offset},p_limit=>${a.p_limit}) data`;
   return {data:r.data,error:null};
  }} as unknown as SupabaseClient;
  await tx.unsafe('set local role anon');
  const details=await loadPublicLegislationDetails(client),serialized=JSON.stringify([...details.values()]);
  for(const id of published)expect([...details.values()].some(d=>d.row.id===id)).toBe(true);
  for(const id of hidden)expect(serialized).not.toContain(id);
  expect(serialized).not.toContain('Synthetic identity reconciled');
  const bill=details.get(`bills/${bills[0]}`)!;expect(bill.sections[0].total).toBe(52);
  const vote=details.get(`legislative_votes/${votes[0]}`)!;expect(vote.totals).toEqual({recorded:{total:1,yes:1,no:0,other:0},matchesReported:false});
  expect(details.get(`legislative_sessions/${sessions[0]}`)?.sections.at(-1)?.total).toBe(1);
  expect(requests).toBeLessThan(25); // Shared resource reads, never a read per detail.
  for(const table of ['bills','legislative_votes','legislative_sessions']) {
   const ids=table==='bills'?bills:table==='legislative_votes'?votes:sessions;
   const [{data:unlisted}]=await tx`select public.browse_legislation(p_table=>${table},p_id=>${ids[1]}::uuid) data`;
   const [{data:privateRow}]=await tx`select public.browse_legislation(p_table=>${table},p_id=>${ids[2]}::uuid) data`;
   expect(unlisted.rows[0]?.id).toBe(ids[1]);expect(privateRow.rows).toHaveLength(0);
  }
  await tx.unsafe('reset role');
  const admin=crypto.randomUUID();await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'})`;await tx`insert into admins(user_id) values(${admin})`;
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;await tx.unsafe('set local role authenticated');
  for(const [table,id] of [['bills',bills[2]],['legislative_votes',votes[2]],['legislative_sessions',sessions[2]]]) {
   const [{data}]=await tx`select public.browse_legislation(p_table=>${table},p_id=>${id}::uuid) data`;expect(data.rows[0].id).toBe(id);
  }
  await tx.unsafe('reset role');throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
},30000);
