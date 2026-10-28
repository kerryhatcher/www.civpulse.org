import { expect, test } from 'bun:test';
import { SQL } from 'bun';
const url = process.env.REBUILD_TEST_DATABASE_URL;
test.skipIf(!url)('Supabase Cron, Vault auth, leases and persistent build reconciliation preserve pending revisions', async () => {
  const sql = new SQL(url!); const rollback = Error('rollback');
  try { await sql.begin(async tx => {
    for (const file of ['20261125000100_frontend_rebuild_tracking.sql', '20261125000200_frontend_rebuild_cron.sql']) {
      await tx.unsafe(await Bun.file(`supabase/migrations/${file}`).text());
    }
    const claim = async () => (await tx`select public.claim_frontend_rebuild() s`)[0].s;
    const record = async (lease: string, action: string, build: string, revision: string | null = null) => (await tx`select public.record_frontend_rebuild(${lease},${action},${build},${revision}) s`)[0].s;
    const release = (lease: string) => tx`select public.release_frontend_rebuild(${lease})`;
    const denied = async (run: () => Promise<unknown>, code: string) => {
      await tx.unsafe('savepoint denied');
      try { await run(); throw Error('Expected rejection'); }
      catch (e) { expect((e as {errno:string}).errno).toBe(code); }
      finally { await tx.unsafe('rollback to savepoint denied'); }
    };
    const [job] = await tx`select schedule,command from cron.job where jobname='frontend-rebuild-hourly'`;
    expect(job.schedule).toBe('17 * * * *'); expect(job.command).toBe('select frontend_private.invoke_rebuild();');
    await denied(() => tx`select frontend_private.invoke_rebuild()`, 'P0001');
    await tx`select vault.create_secret('https://example.test/functions/v1/rebuild-frontend','frontend_rebuild_url')`;
    const token = 'test-only-cron-token-at-least-32-characters';
    await tx`select vault.create_secret(${token},'frontend_rebuild_token')`;
    const [{ request_id }] = await tx`select frontend_private.invoke_rebuild() request_id`;
    const [queued] = await tx`select url,headers from net.http_request_queue where id=${request_id}`;
    expect(queued.url).toBe('https://example.test/functions/v1/rebuild-frontend');
    expect(queued.headers['x-rebuild-token']).toBeUndefined();
    expect(queued.headers['x-rebuild-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(queued.headers)).not.toContain(token);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), {name:'HMAC',hash:'SHA-256'},false,['verify']);
    const signature = Uint8Array.from(queued.headers['x-rebuild-signature'].match(/../g)!, (b: string)=>parseInt(b,16));
    expect(await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(`frontend-rebuild:${queued.headers['x-rebuild-timestamp']}`))).toBe(true);
    // pg_net dispatches after commit; rollback ensures the test sends no request.
    for (const role of ['anon','authenticated']) {
      for (const fn of ['claim_frontend_rebuild()', 'record_frontend_rebuild(uuid,text,uuid,text)', 'release_frontend_rebuild(uuid)', 'verify_frontend_rebuild_signature(text,text)']) {
        expect((await tx`select has_function_privilege(${role},${`public.${fn}`},'execute') allowed`)[0].allowed).toBe(false);
      }
      expect((await tx`select has_table_privilege(${role},'vault.decrypted_secrets','select') allowed`)[0].allowed).toBe(false);
      expect((await tx`select has_schema_privilege(${role},'frontend_private','usage') allowed`)[0].allowed).toBe(false);
    }
    await tx.unsafe('set local role service_role');
    expect((await tx`select public.verify_frontend_rebuild_signature(${queued.headers['x-rebuild-timestamp']},${queued.headers['x-rebuild-signature']}) allowed`)[0].allowed).toBe(true);
    expect((await tx`select public.verify_frontend_rebuild_signature('invalid',${queued.headers['x-rebuild-signature']}) allowed`)[0].allowed).toBe(false);
    expect((await tx`select public.verify_frontend_rebuild_signature('1000000000',${queued.headers['x-rebuild-signature']}) allowed`)[0].allowed).toBe(false);
    expect((await tx`select public.verify_frontend_rebuild_signature(${queued.headers['x-rebuild-timestamp']},${'0'.repeat(64)}) allowed`)[0].allowed).toBe(false);
    const first = await claim(); expect(first.needs_rebuild).toBe(true); expect(typeof first.revision).toBe('string');
    expect(await claim()).toBeNull();
    const build = crypto.randomUUID();
    await record(first.lease_id,'track',build,first.revision);
    // Interrupted invocation: a lease expires and a later instance resumes its build.
    await tx.unsafe('reset role');
    await tx`update public.frontend_rebuild_state set lease_until=clock_timestamp()-interval '1 second' where id`;
    await tx.unsafe('set local role service_role');
    const resumed = await claim(); expect(resumed.build_id).toBe(build); expect(resumed.lease_id).not.toBe(first.lease_id);
    await release(first.lease_id); expect(await claim()).toBeNull();
    await denied(() => record(first.lease_id,'succeeded',build), '55000');
    await denied(() => record(resumed.lease_id,'succeeded',crypto.randomUUID()), '22023');
    await tx.unsafe('reset role');
    const [org] = await tx`insert into public.organizations(name,slug) values ('Cron test',${crypto.randomUUID()}) returning id`;
    await tx.unsafe('set local role service_role');
    const success = await record(resumed.lease_id,'succeeded',build);
    expect(success.needs_rebuild).toBe(true); expect(success.build_id).toBeNull();
    expect(BigInt(success.revision)).toBeGreaterThan(BigInt(first.revision));
    const nextBuild = crypto.randomUUID();
    await record(resumed.lease_id,'track',nextBuild,success.revision);
    const cleared = await record(resumed.lease_id,'succeeded',nextBuild);
    expect(cleared.needs_rebuild).toBe(false);
    await release(resumed.lease_id);
    await tx.unsafe('reset role');
    await tx`update public.organizations set name='Another edit' where id=${org.id}`;
    await tx.unsafe('set local role service_role');
    const retry = await claim(); await record(retry.lease_id,'track',build,retry.revision);
    const failed = await record(retry.lease_id,'failed',build);
    expect(failed.needs_rebuild).toBe(true); expect(failed.build_id).toBeNull();
    await denied(() => record(retry.lease_id,'track',build,'999999999999'), '22023');
    await release(retry.lease_id);
    throw rollback;
  }); } catch (e) { if (e !== rollback) throw e; } finally { await sql.close(); }
});
