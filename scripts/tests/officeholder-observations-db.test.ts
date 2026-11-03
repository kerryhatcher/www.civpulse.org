import {test,expect} from 'bun:test';import {SQL} from 'bun';
import {observationDate} from '../../apps/web/src/lib/officeholder-observations';
test('observation date labels never imply interval or current status',()=>{expect(observationDate({precision:'year',as_of:'2022-01-01'} as any)).toBe('Observed in 2022 (year precision; day unknown)');expect(observationDate({precision:'unknown',as_of:null} as any)).toBe('As-of date unknown');});
test.skipIf(!process.env.OFFICEHOLDER_DATABASE_URL)('immutable observations, corrections, precision, visibility, interval preservation and rebuilds',async()=>{
 const sql=new SQL(process.env.OFFICEHOLDER_DATABASE_URL!);if(!process.env.OFFICEHOLDER_DATABASE_URL!.includes('127.0.0.1:54342/'))throw Error('Isolated database only');const rollback=new Error('rollback fixture');
 try{await sql.begin(async tx=>{
 const admin=crypto.randomUUID(),user=crypto.randomUUID(),suffix=crypto.randomUUID();for(const id of[admin,user])await tx`insert into auth.users(id,email) values(${id},${id+'@example.test'})`;await tx`insert into public.admins(user_id) values(${admin})`;
 const [org]=await tx`insert into public.organizations(name,slug) values('Synthetic predecessor authority',${'observation-'+suffix}) returning id`;
 const [other]=await tx`insert into public.organizations(name,slug) values('Synthetic successor authority',${'successor-'+suffix}) returning id`;
 const [p]=await tx`insert into public.people(full_name,slug) values('Synthetic ambiguous voter',${'observation-'+suffix}) returning id`;
 const [office]=await tx`insert into public.offices(organization_id,name) values(${org.id},'Historical chair') returning id`;
 const [term]=await tx`insert into public.office_terms(person_id,office_id,selection_method,starts_on,ends_on) values(${p.id},${office.id},'appointed','2020-03-04','2023-05-06') returning *`;
 const [before]=await tx`select revision from public.frontend_rebuild_state where id`;
 await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
 const row:any={source_key:'report:2022:roster:1',reported_person:'Voter, Synthetic',reported_organization:'Old Authority',reported_office:'Chair',role:'Chair pro tempore',capacity:'acting',selection_basis:'unknown',as_of:'2022-06-30',precision:'day',organization_id:org.id,person_id:p.id,office_id:office.id,office_term_id:term.id,source_url:'https://example.test/report.pdf',document_sha256:'a'.repeat(64),retrieved_on:'2026-11-01',locator:'Printed viii / PDF page 16, row 1',evidence_status:'indexed_copy_unverified',review_status:'reviewed',confidence:'uncertain',visibility:'public'};
 const accept=async(rows:any[],dry=false)=>(await tx`select public.accept_officeholder_observations(1,'synthetic',${JSON.stringify(rows)}::text::jsonb,${dry}) data`)[0].data;
 const read=async(history=false,asof:string|null=null)=>(await tx`select public.read_officeholder_observations(${p.id},null,${asof}::date,${history},0,50) data`)[0].data;
 expect(await accept([row],true)).toMatchObject({created:1,dry_run:true});expect((await read()).total).toBe(0);
 const first=await accept([row]);expect(first.created).toBe(1);expect((await accept([row])).unchanged).toBe(1);
 expect((await accept([{...row,role:'Changed'}])).status).toBe('conflict');
 const corrected={...row,role:'Corrected reported chair label',supersedes_id:first.ids[0],correction_reason:'Reviewed exact source row'};const correction=await accept([corrected]);expect(correction.created).toBe(1);expect((await accept([corrected])).unchanged).toBe(1);
 expect((await read()).total).toBe(1);expect((await read(true)).total).toBe(2);expect((await accept([{...corrected,role:'Stale correction'}])).status).toBe('conflict');
 for(const [precision,date]of[['year','2021-01-01'],['unknown',null]])expect((await accept([{...row,source_key:precision,precision,as_of:date,person_id:null,office_id:null,office_term_id:null,review_status:'unresolved'}])).created).toBe(1);
 expect((await accept([{...row,source_key:'bad-year',precision:'year'}])).status).toBe('rejected');
 expect((await accept([{...row,source_key:'bad-org',organization_id:other.id}])).status).toBe('rejected');
 const prior=(await read()).total;expect((await accept([{...row,source_key:'valid-new'},{...row,source_key:'invalid-new',precision:'unknown'}])).status).toBe('rejected');expect((await read()).total).toBe(prior);
 const privateRow=await accept([{...row,source_key:'private',visibility:'private'}]);expect(privateRow.created).toBe(1);
 expect((await accept([{...row,source_key:'outside',as_of:'2018-01-01'}])).status).toBe('rejected');
 expect((await accept([{...row,source_key:'outside',as_of:'2018-01-01',review_status:'conflicting'}])).created).toBe(1);
 const orgYear=(await tx`select public.read_officeholder_observations(null,${org.id},'2021-06-30',false,0,50) data`)[0].data;expect(orgYear.rows).toHaveLength(1);expect(orgYear.rows[0].payload.precision).toBe('year');
 const exported=(await tx`select public.export_public_officeholder_observations(0,100) data`)[0].data.rows.filter((r:any)=>r.payload.organization_id===org.id);expect(exported).toHaveLength(4);expect(exported.every((r:any)=>r.payload.visibility==='public')).toBe(true);
 await tx.unsafe('savepoint immutable');try{await tx`update public.officeholder_observations set payload='{}' where provider='synthetic'`;throw Error('Expected denial');}catch(e){expect((e as any).errno).toBe('42501');}finally{await tx.unsafe('rollback to savepoint immutable');}

 for(const role of['anon','authenticated']){await tx.unsafe('set local role '+role);await tx`select set_config('request.jwt.claim.sub',${role==='anon'?'':user},true)`;
 expect((await read()).total).toBe(2);expect((await read(false,'2022-06-30')).total).toBe(1);expect((await read(false,'2022-06-29')).total).toBe(0);
 const hiddenHistory=(await tx`select public.get_object_history('officeholder_observations',${privateRow.ids[0]}) data`)[0].data;expect(hiddenHistory.revisions).toHaveLength(0);
 const orgHistory=(await tx`select public.get_object_history('organizations',${org.id}) data`)[0].data;expect(JSON.stringify(orgHistory)).not.toContain(privateRow.ids[0]);
 await tx.unsafe('savepoint denied');try{await accept([row]);throw Error('Expected denial');}catch(e){expect((e as any).errno).toBe('42501');}finally{await tx.unsafe('rollback to savepoint denied');}}
 await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
 expect((await accept([{...corrected,visibility:'private',supersedes_id:correction.ids[0],correction_reason:'Restrict disputed identity pending review'}])).created).toBe(1);
 await tx`select set_config('request.jwt.claim.sub',${user},true)`;
 expect((await read(true)).rows.every((r:any)=>r.source_key!=='report:2022:roster:1')).toBe(true);
 expect((await tx`select public.get_object_history('officeholder_observations',${first.ids[0]}) data`)[0].data.revisions).toHaveLength(0);
 await tx.unsafe('reset role');await tx`update public.people set visibility='private' where id=${p.id}`;
 await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${user},true)`;expect((await read(true)).total).toBe(0);
 await tx.unsafe('reset role');expect((await tx`select * from public.office_terms where id=${term.id}`)[0]).toEqual(term);
 expect(Number((await tx`select revision from public.frontend_rebuild_state where id`)[0].revision)).toBeGreaterThan(Number(before.revision));expect(await tx`select * from audit.objects where table_name='officeholder_observations'`).toHaveLength(1);
 throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
});
