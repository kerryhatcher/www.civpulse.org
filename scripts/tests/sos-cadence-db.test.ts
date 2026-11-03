import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const url = process.env.ELECTION_RESULTS_TEST_DATABASE_URL;

test.skipIf(!url)('one coordinator gates cadence, immediate activation, transition, and public health', async () => {
  const origin = new URL(url!);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw Error('Isolated local database required');
  const db = new SQL(url!), rollback = Error('rollback');
  try {
    await db.begin(async tx => {
      // Everything, including fixture users and paused preexisting test feeds, rolls back.
      await tx`update public.sos_automation_feeds set enabled=false`;
      const id = crypto.randomUUID(), admin = crypto.randomUUID();
      const source = 'https://results.sos.ga.gov/cdn/results/Georgia/export-CadenceFixture.json';
      await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${id},${id},'Cadence fixture','2026-11-03',${source})`;
      await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'})`;
      await tx`insert into public.admins(user_id) values(${admin})`;
      const fails = async (operation:()=>Promise<unknown>, message:string) => {
        await tx.unsafe('savepoint cadence_error');
        try { await operation(); throw Error('Expected failure'); }
        catch (error) { expect(String(error)).toContain(message); }
        finally { await tx.unsafe('rollback to savepoint cadence_error'); }
      };
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
      await fails(()=>tx`select public.configure_sos_results_poll_cadence(${id},3600,now()+interval '1 hour',300)`, 'Admin access required');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      await tx`select public.configure_sos_results_feed(${id},false,now()-interval '1 minute',now()+interval '8 days')`;
      await fails(()=>tx`select public.configure_sos_results_poll_cadence(${id},60,null,300)`, 'Invalid polling cadence');
      expect((await tx`select public.configure_sos_results_poll_cadence(${id},3600,now()+interval '1 hour',300) r`)[0].r.enabled).toBe(false);
      await tx.unsafe('reset role');
      await tx`update public.sos_automation_feeds set last_attempt_at=now()-interval '20 minutes' where election_id=${id}`;
      const previousAttempt = (await tx`select last_attempt_at::text t from public.sos_automation_feeds where election_id=${id}`)[0].t;
      // Exact requested phase boundary is independent of when activation occurs.
      await tx.unsafe('savepoint fixed_cadence_boundary');
      await tx`update public.sos_automation_feeds set poll_transition_at='2026-11-03T22:00:00Z',last_attempt_at='2026-11-03T21:30:00Z',poll_requested_at=null where election_id=${id}`;
      expect((await tx`select frontend_private.sos_poll_interval(f,'2026-11-03T21:59:59Z') n from public.sos_automation_feeds f where election_id=${id}`)[0].n).toBe(3600);
      expect((await tx`select frontend_private.sos_poll_interval(f,'2026-11-03T22:00:00Z') n from public.sos_automation_feeds f where election_id=${id}`)[0].n).toBe(300);
      expect((await tx`select frontend_private.sos_poll_next_at(f,'2026-11-03T22:00:00Z')='2026-11-03T22:00:00Z'::timestamptz due from public.sos_automation_feeds f where election_id=${id}`)[0].due).toBe(true);
      await tx.unsafe('rollback to savepoint fixed_cadence_boundary');
      // pg_net sends only committed queue rows: this savepoint is always rolled
      // back, so the real signed activation path is tested without outbound I/O.
      await tx.unsafe('savepoint signed_activation');
      await tx`select vault.create_secret('https://cadence.example.invalid/functions/v1/poll-election-results','sos_results_poll_url')`;
      await tx`select vault.create_secret(${'s'.repeat(64)},'sos_results_poll_token')`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      const signed = (await tx`select public.configure_sos_results_feed(${id},true,now()-interval '1 minute',now()+interval '8 days') r`)[0].r;
      expect(signed.poll_request_id).not.toBeNull();
      await tx.unsafe('reset role');
      const queued = (await tx`select headers from net.http_request_queue where id=${signed.poll_request_id}`)[0];
      expect((await tx`select public.verify_sos_poll_signature(${queued.headers['x-sos-timestamp']},${queued.headers['x-sos-signature']}) verified`)[0].verified).toBe(true);
      expect(queued.headers).not.toHaveProperty('Authorization');
      await tx.unsafe('set local role authenticated');
      expect((await tx`select public.configure_sos_results_feed(${id},true,now()-interval '1 minute',now()+interval '8 days') r`)[0].r.poll_request_id).toBeNull();
      await tx.unsafe('rollback to savepoint signed_activation');

      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      // The unchanged four-argument API marks a real activation due immediately.
      const activated = (await tx`select public.configure_sos_results_feed(${id},true,now()-interval '1 minute',now()+interval '8 days') r`)[0].r;
      expect(activated.enabled).toBe(true);
      expect(activated.poll_interval_seconds).toBe(3600);
      expect(activated.poll_request_id).toBeNull(); // No external Vault target in this isolated DB.
      await fails(()=>tx`select public.configure_sos_results_poll_cadence(${id},300,null,300)`, 'Pause the feed');
      await tx.unsafe('reset role');
      expect((await tx`select last_attempt_at::text t from public.sos_automation_feeds where election_id=${id}`)[0].t).toBe(previousAttempt);
      expect((await tx`select poll_requested_at>last_attempt_at pending from public.sos_automation_feeds where election_id=${id}`)[0].pending).toBe(true);
      await tx.unsafe('set local role service_role');
      const claim = (await tx`select public.claim_sos_results_poll() r`)[0].r;
      expect(claim.election_id).toBe(id);
      await tx`select public.finish_sos_results_poll(${id},${claim.lease_id},false,null)`;
      expect((await tx`select public.claim_sos_results_poll() r`)[0].r).toBeNull();
      await tx.unsafe('reset role');
      // Normal hourly silence stays healthy and an early cron tick does not falsify attempts.
      await tx`update public.sos_automation_feeds set starts_at=now()-interval '8 hours',poll_requested_at=null,last_attempt_at=now()-interval '40 minutes' where election_id=${id}`;
      const silentAttempt = (await tx`select last_attempt_at::text t from public.sos_automation_feeds where election_id=${id}`)[0].t;
      await tx.unsafe('set local role anon');
      let health = (await tx`select public.get_sos_results_health(${id}) r`)[0].r;
      expect(health.status).toBe('healthy');
      expect(health.poll_interval_seconds).toBe(3600);
      expect(health.source_checks_expected).toBe(true);
      await fails(()=>tx`select public.claim_sos_results_poll()`, 'permission denied');
      await tx.unsafe('reset role');
      expect((await tx`select public.claim_sos_results_poll() r`)[0].r).toBeNull();
      expect((await tx`select frontend_private.invoke_sos_results_poll() r`)[0].r).toBeNull();
      expect((await tx`select last_attempt_at::text t from public.sos_automation_feeds where election_id=${id}`)[0].t).toBe(silentAttempt);
      // Hourly source silence does not hide an old publication behind fresh lease renewals.
      const pendingLease = crypto.randomUUID();
      const pendingJob = (await tx`insert into public.sos_automation_jobs(election_id,state,created_at,updated_at,lease_id,lease_until) values(${id},'importing',now()-interval '20 minutes',now()-interval '1 minute',${pendingLease},now()+interval '1 minute') returning id`)[0].id;
      await tx.unsafe('set local role service_role');
      expect((await tx`select public.renew_sos_results_job(${pendingJob},${pendingLease}) renewed`)[0].renewed).toBe(true);
      await tx.unsafe('set local role anon');
      health = (await tx`select public.get_sos_results_health(${id}) r`)[0].r;
      expect(health.status).toBe('delayed');
      expect(health.poll_interval_seconds).toBe(3600);
      expect(Date.parse(health.pending_since)).toBeLessThan(Date.now()-15*60*1000);
      await fails(()=>tx`select public.get_sos_collection_health()`, 'permission denied');
      await tx.unsafe('set local role authenticated');
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      await tx.unsafe('set local role service_role');
      const backlog = (await tx`select public.get_sos_collection_health() r`)[0].r.find((row:any)=>row.election_id===id);
      expect(backlog.job_state).toBe('importing');
      expect(Date.parse(backlog.job_created_at)).toBe(Date.parse(health.pending_since));
      expect(Date.parse(backlog.job_updated_at)).toBeGreaterThan(Date.now()-60*1000);
      expect(backlog.poll_interval_seconds).toBe(3600);
      await tx.unsafe('reset role');
      await tx`update public.sos_automation_jobs set state='pointer' where election_id=${id} and state<>'done'`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      // A genuinely recent job queues normally; an independently stale update still delays.
      await tx`update public.sos_automation_jobs set state='queued',created_at=now()-interval '2 minutes',updated_at=now() where election_id=${id} and state<>'done'`;
      await tx.unsafe('set local role anon');
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('queued');
      await tx.unsafe('reset role');
      await tx`update public.sos_automation_jobs set updated_at=now()-interval '16 minutes' where election_id=${id} and state<>'done'`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      await tx`delete from public.sos_automation_jobs where election_id=${id}`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('healthy');
      await tx`update public.sos_automation_feeds set last_attempt_at=now()-interval '126 minutes' where election_id=${id}`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      // Transition is due even when the most recent hourly check was recent.
      await tx`update public.sos_automation_feeds set last_attempt_at=now()-interval '2 minutes',poll_transition_at=now()-interval '1 minute' where election_id=${id}`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.poll_interval_seconds).toBe(300);
      const transitioned = (await tx`select public.claim_sos_results_poll() r`)[0].r;
      expect(transitioned.election_id).toBe(id);
      await tx`select public.finish_sos_results_poll(${id},${transitioned.lease_id},false,null)`;
      // An activation after the transition enters the five-minute phase directly.
      await tx`update public.sos_automation_feeds set enabled=false where election_id=${id}`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      expect((await tx`select public.configure_sos_results_feed(${id},true,now()-interval '1 minute',now()+interval '8 days') r`)[0].r.poll_interval_seconds).toBe(300);
      await tx.unsafe('reset role');
      // Transition has its own grace anchor: do not instantly alert on the previous hour.
      await tx`update public.sos_automation_feeds set starts_at=now()-interval '8 hours',poll_requested_at=null,last_attempt_at=now()-interval '40 minutes',poll_transition_at=now()-interval '10 minutes' where election_id=${id}`;
      health = (await tx`select public.get_sos_results_health(${id}) r`)[0].r;
      expect(health.status).toBe('healthy');
      await tx`update public.sos_automation_feeds set poll_transition_at=now()-interval '20 minutes' where election_id=${id}`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      await tx`update public.sos_automation_feeds set last_attempt_at=now(),poll_transition_at=now()-interval '1 hour' where election_id=${id}`;
      await tx`insert into public.sos_automation_jobs(election_id,updated_at) values(${id},now()-interval '16 minutes')`;
      expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('delayed');
      expect((await tx`select public.claim_sos_results_poll() r`)[0].r).toBeNull();
      // End-exclusive stop suppresses polling and stale-source alarms even while enabled.
      await tx`update public.sos_automation_feeds set ends_at=now() where election_id=${id}`;
      health = (await tx`select public.get_sos_results_health(${id}) r`)[0].r;
      expect(health.status).toBe('paused');
      expect(health.source_checks_expected).toBe(false);
      await tx.unsafe('set local role service_role');
      const operational = (await tx`select public.get_sos_collection_health() r`)[0].r.find((row:any)=>row.election_id===id);
      expect(operational.poll_interval_seconds).toBe(300);
      expect(operational.source_checks_expected).toBe(false);
      await tx.unsafe('reset role');
      expect((await tx`select count(*)::integer n from cron.job where jobname='sos-results-poll'`)[0].n).toBe(1);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await db.close(); }
}, 30_000);
