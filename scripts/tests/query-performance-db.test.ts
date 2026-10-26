import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const migration = 'supabase/migrations/20261123070000_query_performance_indexes.sql';

test.skipIf(!process.env.PERFORMANCE_TEST_DATABASE_URL)('performance migration preserves search and geometry access, results and paging', async () => {
  const sql = new SQL(process.env.PERFORMANCE_TEST_DATABASE_URL!);
  const rollback = Error('rollback performance fixtures');
  try {
    await sql.begin(async tx => {
      const suffix = crypto.randomUUID(), admin = crypto.randomUUID(), user = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin},${`perf-admin-${suffix}@example.test`}),(${user},${`perf-user-${suffix}@example.test`})`;
      await tx`insert into admins(user_id) values (${admin})`;
      const [org] = await tx`insert into organizations(name,slug) values ('Performance QA',${`perf-${suffix}`}) returning id`;
      const [calendar] = await tx`insert into calendars(name,slug,organization_id) values ('Performance QA',${`perf-${suffix}`},${org.id}) returning id`;
      const marker = `perf${suffix.replaceAll('-', '')}`;
      const eventIds = [];
      for (const visibility of ['public','unlisted','private']) {
        const [event] = await tx`insert into events(calendar_id,title,starts_at,is_meeting,visibility,meeting_notes)
          values (${calendar.id},'Performance meeting','2026-01-01Z',true,${visibility},${marker}) returning id`;
        eventIds.push(event.id);
      }
      const maps = [], layers = [];
      for (const visibility of ['public','unlisted','private']) {
        const [map] = await tx`insert into maps(name,slug,visibility) values ('Performance map',${`perf-${visibility}-${suffix}`},${visibility}) returning id`;
        const [layer] = await tx`insert into layers(name,source_type,visibility) values ('Performance layer','postgis',${visibility}) returning id`;
        maps.push(map.id); layers.push(layer.id);
        for (let position=0;position<3;position++) await tx`insert into layer_features(layer_id,position,properties,geometry)
          values (${layer.id},${position},jsonb_build_object('name',${marker}::text,'index',${position}::integer),extensions.st_setsrid(extensions.st_makepoint(-83,32),4326))`;
      }
      // Exercise every combination: public/unlisted map access, private layers,
      // private maps, a layer not on the requested map, and admin-only access.
      for (const map of maps) for (const layer of layers) await tx`insert into map_layers(map_id,layer_id) values (${map},${layer})`;
      const missing = crypto.randomUUID();
      const role = async (name: string, id: string) => {
        await tx.unsafe(`set local role ${name}`);
        await tx`select set_config('request.jwt.claim.sub',${id},true)`;
      };
      const snapshot = async () => {
        const result: unknown[] = [];
        for (const [name,id] of [['anon',''],['authenticated',user],['authenticated',admin]]) {
          await role(name,id);
          const matches = await tx`select * from search_site(${marker},'event',100,0)`;
          expect(matches.map(r=>r.id).sort()).toEqual((id===admin ? eventIds : [eventIds[0]]).toSorted());
          for (const query of ['',marker,'Macon','FSS-2']) for (const type of [null,'person','organization','event','layer']) {
            result.push(await tx`select * from search_site(${query},${type},20,0)`);
          }
          for (const map of [...maps,missing]) for (const layer of layers) {
            await tx.unsafe('savepoint geometry_read');
            try {
              const rows = await tx`select get_layer_geojson_page(${layer}::uuid,${map}::uuid,1,1) as geo`;
              expect(rows[0].geo.numberMatched).toBe(3);
              expect(rows[0].geo.features).toHaveLength(1);
              expect(rows[0].geo.features[0].properties.index).toBe(1);
              result.push(rows);
            } catch (error) {
              expect((error as {errno:string}).errno).toBe('42501');
              result.push('42501');
            } finally { await tx.unsafe('rollback to savepoint geometry_read'); }
          }
          await tx.unsafe('reset role');
        }
        return result;
      };
      const before = await snapshot();
      await tx.unsafe(await Bun.file(migration).text());
      const after = await snapshot();
      expect(after).toEqual(before);
      const indexes = await tx`select count(*)::int n from pg_indexes where schemaname='public' and indexname in
        ('map_layers_layer_id_idx','meeting_attendance_person_id_idx','meeting_vote_choices_meeting_person_idx',
         'meeting_vote_choices_vote_meeting_idx','records_request_transfers_actor_idx',
         'records_request_transfers_from_user_idx','records_request_transfers_to_user_idx')`;
      expect(indexes[0].n).toBe(7);
      throw rollback;
    });
  } catch (error) { if (error!==rollback) throw error; }
  finally { await sql.close(); }
}, 120000);
