import {expect,test} from 'bun:test';
import {SQL} from 'bun';
const tables=['legislative_terms','legislative_sessions','legislative_bodies','bills','legislative_votes','bill_actions','bill_versions','bill_amendments','bill_sponsorships','bill_positions','article_bills','bill_relationships','legislative_vote_bills','legislative_vote_choices'];
test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('500-row public build export matches discovery payload/order/totals and rejects authenticated contexts',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback build export');
 try{await sql.begin(async tx=>{
  const tag=crypto.randomUUID();
  const [org]=await tx`insert into organizations(name,slug) values('Build export QA',${tag}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values(${org.id},'qa','Export QA','2025-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,ends_on) values(${term.id},'qa','Export QA session','2025-01-01','2025-12-31') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values(${org.id},${org.id},'chamber') returning id`;
  // Capacity rows are disposable; skip per-row audit/import validation only on
  // this test connection, restore normal behavior before reads, roll back all.
  await tx.unsafe('set local session_replication_role=replica');
  await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,summary,introduced_on)
   select ${term.id}::uuid,${session.id}::uuid,${body.id}::uuid,'qa','QA '||n,'Export QA '||n,repeat('QA source summary ',300),'2025-01-01'::date+(n%28) from generate_series(1,1251) n`;
  await tx.unsafe('set local session_replication_role=origin');
  const [unlisted]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values(${term.id},${session.id},${body.id},'qa','unlisted','Unlisted QA','2025-01-01','unlisted') returning id`;
  const [privateBill]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values(${term.id},${session.id},${body.id},'qa','private','Private QA','2025-01-01','private') returning id`;
  const [meta]=await tx`select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated from pg_proc where oid='public.export_public_legislation_page(text,integer,integer)'::regprocedure`;
  expect(meta.prosecdef).toBe(true);expect(meta.proconfig).toEqual(['search_path=""']);expect(meta.anon).toBe(true);expect(meta.authenticated).toBe(false);
  await tx.unsafe("set local statement_timeout='3s'");await tx.unsafe('set local role anon');
  for(const table of tables){
   const expected:any[]=[];let total=0;
   for(let offset=0;;offset+=100){const [{data}]=await tx`select public.browse_legislation(p_table=>${table},p_offset=>${offset},p_limit=>100) data`;expected.push(...data.rows);total=data.total;if(expected.length===total)break;}
   const actual:any[]=[];
   for(let offset=0;;offset+=500){const [{data}]=await tx`select public.export_public_legislation_page(${table},${offset},500) data`;expect(data.total).toBe(total);expect(data.rows.length).toBe(Math.min(500,total-offset));actual.push(...data.rows);if(actual.length===total)break;}
   expect(actual).toEqual(expected);expect(actual.some(r=>r.id===unlisted.id||r.id===privateBill.id)).toBe(false);
  }
  // Public children of hidden parents must stay excluded. Test both visibility modes.
  await tx.unsafe('reset role');
  for(const visibility of ['private','unlisted']){
   await tx`update legislative_terms set visibility=${visibility} where id=${term.id}`;
   await tx.unsafe('set local role anon');const [{data}]=await tx`select public.export_public_legislation_page('bills',0,500) data`;
   expect(data.rows.some(r=>r.term_id===term.id)).toBe(false);
   const [{data:direct}]=await tx`select public.browse_legislation(p_table=>'bills',p_id=>${unlisted.id}::uuid) data`;expect(direct.rows.length).toBe(0);
   await tx.unsafe('reset role');
  }
  await tx`update legislative_terms set visibility='public' where id=${term.id}`;
  await tx.unsafe('set local role anon');const [{data:direct}]=await tx`select public.browse_legislation(p_table=>'bills',p_id=>${unlisted.id}::uuid) data`;expect(direct.rows[0].id).toBe(unlisted.id);await tx.unsafe('reset role');
  // Even a privileged caller cannot export while carrying a user context.
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await tx.unsafe('savepoint denied');
  await expect(Promise.resolve(tx`select public.export_public_legislation_page('bills',0,500)`)).rejects.toThrow('anonymous build client');
  await tx.unsafe('rollback to savepoint denied');await tx`select set_config('request.jwt.claim.sub','',true)`;
  for(const [table,offset,limit]of [['admins',0,500],['bills',-1,500],['bills',0,501]]as const){
   await tx.unsafe('savepoint invalid');await expect(Promise.resolve(tx`select public.export_public_legislation_page(${table},${offset},${limit})`)).rejects.toThrow();await tx.unsafe('rollback to savepoint invalid');
  }
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
},120000);
