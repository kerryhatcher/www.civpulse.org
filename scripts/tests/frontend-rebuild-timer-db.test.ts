import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const url = process.env.REBUILD_TEST_DATABASE_URL;
test.skipIf(!url)('20-minute timer migration preserves the existing job ID and command without duplicates', async () => {
  const sql = new SQL(url!); const rollback = Error('rollback');
  try { await sql.begin(async tx => {
    await tx.unsafe('create extension if not exists pg_cron with schema pg_catalog');
    await tx`select cron.schedule('frontend-rebuild-hourly','17 * * * *','select frontend_private.invoke_rebuild();')`;
    const [before] = await tx`select jobid,command from cron.job where jobname='frontend-rebuild-hourly' and username=current_user`;
    await tx.unsafe(await Bun.file('supabase/migrations/20261125000300_frontend_rebuild_twenty_minutes.sql').text());
    const jobs = await tx`select jobid,schedule,command,active from cron.job where jobname='frontend-rebuild-hourly' and username=current_user`;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobid).toBe(before.jobid);
    expect(jobs[0].schedule).toBe('*/20 * * * *');
    expect(jobs[0].command).toBe(before.command);
    expect(jobs[0].active).toBe(true);
    throw rollback;
  }); } catch (e) { if (e !== rollback) throw e; } finally { await sql.close(); }
});
