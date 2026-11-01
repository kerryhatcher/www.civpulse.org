import { expect, spyOn, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GEORGIA_COUNTY_HUBS } from '../../apps/web/src/lib/county-scope';
import * as buildSupabase from '../../apps/web/src/lib/supabase-build';
import { countyStatisticsCsv, formatStatistic, getCountyStatisticDownloadRecords, readCountyStatisticSnapshot, type StatisticRecord } from '../../apps/web/src/lib/county-statistics';

function fixture(): StatisticRecord[] {
  return ['13000', ...GEORGIA_COUNTY_HUBS.map(c => c.fips)].sort().flatMap((fips, county) => Array.from({ length: 59 }, (_, i) => ({
    county_fips: fips, indicator_code: `indicator-${i}`, value: (county + i) % 45,
    status: 'available', label: `Measure ${i}`, unit: 'percent', period: '2024', source_id: `source-${fips === '13000' ? 'st' : 'co'}`,
    source_url: 'https://www.census.gov/synthetic', source_title: 'Synthetic source', publisher: 'Census', retrieved_on: '2026-10-01',
    sha256: 'synthetic', source_variables: 'synthetic', numerator: null, denominator: null, margin_of_error: null,
    lower_bound: 0, upper_bound: 48, confidence_level: 90, detail: '', components: {}, definition: 'Synthetic measure',
    topic_id: i < 18 ? 'age' : i < 21 ? 'poverty' : 'other', topic_title: 'Synthetic topic', topic_note: 'Synthetic note', topic_position: 0,
    indicator_position: i, headline_position: i < 6 ? i : null, county_name: fips, county_slug: fips,
  } as StatisticRecord)));
}
function clientFor(rows: StatisticRecord[], failAt = -1) {
  let calls = 0;
  const client = { from(table: string) {
    expect(table).toBe('county_statistic_records');
    const query = {
      select(columns: string) { expect(columns).toBe('*'); return query; },
      order() { return query; },
      async range(start: number, end: number) {
        calls++;
        return start === failAt ? { data: null, error: { message: 'offline' } } : { data: rows.slice(start, end + 1), error: null };
      },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { client, calls: () => calls };
}

test('all 159 county groups/downloads match the previous filter projection and share one snapshot', async () => {
  const rows = fixture();
  // A suppressed extreme must not stretch chart scales; unavailable values stay null.
  rows[20] = { ...rows[20], status: 'suppressed', value: null, upper_bound: 900 };
  rows[60] = { ...rows[60], status: 'unavailable', value: null };
  const source = clientFor(rows);
  const first = readCountyStatisticSnapshot(source.client);
  expect(readCountyStatisticSnapshot(source.client)).toBe(first);
  const snapshot = await first;
  expect(snapshot.records).toEqual(rows);
  expect(snapshot.georgiaByCode.size).toBe(59);
  const buildClient = spyOn(buildSupabase, 'getBuildSupabase').mockReturnValue(source.client);
  try {
    for (const county of GEORGIA_COUNTY_HUBS) {
      const local = rows.filter(row => row.county_fips === county.fips);
      const download = rows.filter(row => row.county_fips === '13000' || row.county_fips === county.fips);
      expect(snapshot.byFips.get(county.fips)).toEqual(local);
      expect(JSON.stringify({ records: snapshot.downloadsByFips.get(county.fips) })).toBe(JSON.stringify({ records: download }));
      expect(countyStatisticsCsv(snapshot.downloadsByFips.get(county.fips)!)).toBe(countyStatisticsCsv(download));
      expect(await getCountyStatisticDownloadRecords(county.fips)).toEqual(download);
      for (const row of local) expect(snapshot.georgiaByCode.get(row.indicator_code)).toBe(rows.find(state => state.county_fips === '13000' && state.indicator_code === row.indicator_code)!);
    }
    await expect(getCountyStatisticDownloadRecords('unknown')).rejects.toThrow('Unknown Georgia county unknown');
  } finally { buildClient.mockRestore(); }
  expect(snapshot.povertyScaleMax).toBe(Math.max(50, Math.ceil(Math.max(...rows.filter(row => row.topic_id === 'poverty' && row.status === 'available').map(row => Number(row.upper_bound ?? row.value))) / 20) * 20));
  expect(snapshot.ageScaleMax).toBe(Math.max(10, Math.ceil(Math.max(...rows.filter(row => row.topic_id === 'age' && row.status === 'available').map(row => Number(row.value))) / 5) * 5));
  expect(formatStatistic(rows[20])).toBe('Suppressed by Census');
  expect(formatStatistic(rows[60])).toBe('Not available');
  expect(formatStatistic({ value: 0, status: 'available', unit: 'percent' })).toBe('0.0%');
  expect(await readCountyStatisticSnapshot(source.client)).toBe(snapshot);
  expect(source.calls()).toBe(19);
});

test('incomplete/duplicate statistics, headline loss, missing state codes and mismatched comparison period/source fail closed', async () => {
  const changes: Array<(rows: StatisticRecord[]) => void> = [
    rows => { rows.pop(); },
    rows => { rows[60].indicator_code = rows[59].indicator_code; },
    rows => { rows[59].headline_position = null; },
    rows => { rows[0].indicator_code = 'missing-comparison'; },
    rows => { rows[60].period = '2023'; },
    rows => { rows[60].source_id = 'different-source-co'; },
  ];
  for (const change of changes) {
    const rows = fixture(); change(rows);
    await expect(readCountyStatisticSnapshot(clientFor(rows).client)).rejects.toThrow();
  }
  await expect(readCountyStatisticSnapshot(clientFor(fixture(), 500).client)).rejects.toThrow('offline');
});

test('development expiry replaces records, groups, state lookups, downloads and chart scales together', async () => {
  const previous = process.env.DEV;
  const clock = spyOn(Date, 'now').mockReturnValue(1000);
  process.env.DEV = 'true';
  try {
    const rows = fixture(), source = clientFor(rows);
    const first = await readCountyStatisticSnapshot(source.client);
    rows[0] = { ...rows[0], value: 99 };
    rows[18] = { ...rows[18], upper_bound: 99 };
    clock.mockReturnValue(30999);
    expect(await readCountyStatisticSnapshot(source.client)).toBe(first);
    clock.mockReturnValue(31000);
    const refreshed = await readCountyStatisticSnapshot(source.client);
    expect(refreshed).not.toBe(first);
    expect(refreshed.records).not.toBe(first.records);
    expect(refreshed.byFips).not.toBe(first.byFips);
    expect(refreshed.georgiaByCode.get('indicator-0')!.value).toBe(99);
    expect(refreshed.downloadsByFips.get('13021')![0].value).toBe(99);
    expect(first.downloadsByFips.get('13021')![0].value).not.toBe(99);
    expect(refreshed.ageScaleMax).toBe(100);
    expect(refreshed.povertyScaleMax).toBe(100);
    expect(source.calls()).toBe(38);
  } finally {
    clock.mockRestore();
    if (previous === undefined) delete process.env.DEV; else process.env.DEV = previous;
  }
});

const baseline = process.env.COUNTY_STATISTICS_BASELINE_DIR;
test.skipIf(!baseline)('all 159 built county HTML/charts/CSV/JSON, including Bibb, match the saved baseline bytes', async () => {
  const dist = process.env.COUNTY_STATISTICS_DIST ?? 'apps/web/dist/counties';
  for (const county of GEORGIA_COUNTY_HUBS) {
    for (const filename of ['index.html', 'statistics.csv', 'statistics.json']) {
      const path = `${county.slug}/${filename}`;
      expect(await Bun.file(`${dist}/${path}`).text(), path).toBe(await Bun.file(`${baseline}/${path}`).text());
    }
  }
});
