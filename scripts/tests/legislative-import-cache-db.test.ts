import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('batched import caches columns without changing validation or atomicity', async () => {
 const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
 const rollback = Error('rollback import cache fixtures');
 try { await sql.begin(async tx => {
  const suffix=crypto.randomUUID();
  const [org]=await tx`insert into organizations(name,slug) values ('Import cache QA',${suffix}) returning id`;
  const admin=crypto.randomUUID();await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
  await tx`insert into admins(user_id) values (${admin})`;
  const terms=Array.from({length:50},(_,n)=>({table:'legislative_terms',data:{id:crypto.randomUUID(),source_system:'cache-qa',source_id:`${suffix}:${n}`,organization_id:org.id,identifier:`${suffix}:${n}`,name:'Cache QA',starts_on:'2025-01-01'}}));
  const sessions=terms.map((t,n)=>({table:'legislative_sessions',data:{source_system:'cache-qa',source_id:`${suffix}:${n}`,term_id:t.data.id,identifier:'regular',name:'Regular',starts_on:'2025-01-01'}}));
  const bundle=[...terms,...sessions];
  const run=async()=>{await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;const start=performance.now();const result=(await tx`select import_legislation(${bundle}::jsonb) result`)[0].result;return {result,ms:performance.now()-start};};
  await tx.unsafe(await Bun.file('supabase/migrations/20261123150000_preserve_import_attendance.sql').text());
  await tx.unsafe('savepoint baseline');const baseline=await run();await tx.unsafe('rollback to savepoint baseline');
  await tx.unsafe('reset role');
  await tx.unsafe(await Bun.file('supabase/migrations/20261123160000_legislative_import_column_cache.sql').text());
  const cached=await run();expect(cached.result).toHaveLength(100);
  expect(cached.result.map((r:any)=>r.table)).toEqual(baseline.result.map((r:any)=>r.table));
  console.log(`100-row import: baseline ${baseline.ms.toFixed(0)}ms; cached ${cached.ms.toFixed(0)}ms`);
  const reject=async(records:unknown[],code='22023')=>{await tx.unsafe('savepoint rejected');try{await tx`select import_legislation(${records}::jsonb)`;throw Error('Expected rejection');}catch(e){expect((e as {errno:string}).errno).toBe(code);}finally{await tx.unsafe('rollback to savepoint rejected');}};
  // A field valid in one resource must not leak into the next resource's cache.
  await reject([{table:'legislative_terms',data:{source_system:'cache-qa',source_id:terms[0].data.source_id,name:'Must roll back'}},{table:'legislative_sessions',data:{source_system:'cache-qa',source_id:sessions[0].data.source_id,state_name:'Georgia'}}]);
  expect((await tx`select name from legislative_terms where id=${terms[0].data.id}`)[0].name).toBe('Cache QA');
  await reject([{table:'legislative_terms',data:{source_system:'cache-qa',source_id:terms[0].data.source_id,created_at:'2025-01-01'}}]);
  await reject([{table:'admins',data:{source_system:'cache-qa',source_id:suffix}}]);
  await reject([...bundle,bundle[0]]);
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await reject(bundle,'42501');
  throw rollback;
 }); } catch(e) { if(e!==rollback)throw e; } finally { await sql.close(); }
});
