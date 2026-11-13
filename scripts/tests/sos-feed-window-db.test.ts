import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const url = process.env.ELECTION_RESULTS_TEST_DATABASE_URL;

test.skipIf(!url)('admin window changes require paused public binding; emergency pause survives invalid binding', async () => {
  const origin = new URL(url!);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw Error('Isolated local database required');
  const db = new SQL(url!), rollback = Error('rollback');
  try { await db.begin(async tx => {
    expect(Number((await tx`select count(*) n from public.sos_automation_feeds where enabled`)[0].n)).toBe(0);
    expect(Number((await tx`select count(*) n from vault.decrypted_secrets where name in ('sos_results_poll_url','sos_results_poll_token')`)[0].n)).toBe(0);
    // A disposable fixture DB may lag this feature migration; install inside the
    // same rolled-back transaction only. Never execute against hosted endpoints.
    if (!(await tx`select to_regprocedure('public.configure_sos_results_feed_window(uuid,timestamptz,timestamptz)') helper`)[0].helper) {
      await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261125003600_sos_results_feed_window.sql', import.meta.url)).text());
    }
    const id=crypto.randomUUID(), missing=crypto.randomUUID(), admin=crypto.randomUUID(), user=crypto.randomUUID();
    const source='https://results.sos.ga.gov/cdn/results/Georgia/export-WindowFixture.json';
    await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${id},${id},'Window fixture','2026-11-03',${source})`;
    await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'}),(${user},${user+'@example.test'})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const fails=async(operation:()=>Promise<unknown>, message:string)=>{
      await tx.unsafe('savepoint window_error');
      try {await operation();throw Error('Expected failure');} catch(error) {expect(String(error)).toContain(message);} finally {await tx.unsafe('rollback to savepoint window_error');}
    };
    await tx.unsafe('set local role anon');
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'permission denied');
    await tx.unsafe('set local role service_role');
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'permission denied');
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${user},true)`;
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'Admin access required');
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await fails(()=>tx`select public.configure_sos_results_feed_window(${missing},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'Unknown election');
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'Configure the disabled feed first');
    await tx`select public.configure_sos_results_feed(${id},false,'2026-11-03T17:00:00Z','2026-11-04T00:00:00Z')`;
    for (const [start,end] of [[null,'2026-11-11T00:00:00Z'],['2026-11-03T18:00:00Z',null],['2026-11-11T00:00:00Z','2026-11-03T18:00:00Z'],['2026-11-03T18:00:00Z','2026-11-03T18:00:00Z'],['-infinity','infinity']]) {
      await fails(()=>tx`select public.configure_sos_results_feed_window(${id},${start}::timestamptz,${end}::timestamptz)`,'explicit ordered polling window');
    }
    const saved=(await tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z') r`)[0].r;
    expect(saved.enabled).toBe(false);expect(saved.source_url).toBe(source);expect(saved.election_id).toBe(id);
    expect(Date.parse(saved.starts_at)).toBe(Date.parse('2026-11-03T18:00:00Z'));expect(Date.parse(saved.ends_at)).toBe(Date.parse('2026-11-11T00:00:00Z'));
    await tx.unsafe('reset role');
    expect((await tx`select starts_at='2026-11-03T18:00:00Z'::timestamptz and ends_at='2026-11-11T00:00:00Z'::timestamptz and not enabled ok from public.sos_automation_feeds where election_id=${id}`)[0].ok).toBe(true);
    // Never call activation in this test: a fixture owner marks enabled directly
    // to verify the helper rejects it, without invoking pg_net or any poller.
    await tx`update public.sos_automation_feeds set enabled=true where election_id=${id}`;
    await tx.unsafe('set local role authenticated');
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'Pause the feed');
    expect((await tx`select public.configure_sos_results_feed(${id},false) r`)[0].r.enabled).toBe(false);
    for (const visibility of ['private','unlisted']) {
      await tx.unsafe('reset role');await tx`update public.elections set visibility=${visibility} where id=${id}`;
      await tx.unsafe('set local role authenticated');
      await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'public election and matching saved SOS source');
      expect((await tx`select public.configure_sos_results_feed(${id},false) r`)[0].r.enabled).toBe(false);
    }
    await tx.unsafe('reset role');await tx`update public.elections set visibility='public',results_json_url='https://results.sos.ga.gov/cdn/results/Georgia/export-ChangedFixture.json' where id=${id}`;
    await tx.unsafe('set local role authenticated');
    await fails(()=>tx`select public.configure_sos_results_feed_window(${id},'2026-11-03T18:00:00Z','2026-11-11T00:00:00Z')`,'public election and matching saved SOS source');
    expect((await tx`select public.configure_sos_results_feed(${id},false) r`)[0].r.enabled).toBe(false);
    throw rollback;
  }); } catch(error) {if(error!==rollback)throw error;} finally {await db.close();}
},30_000);
