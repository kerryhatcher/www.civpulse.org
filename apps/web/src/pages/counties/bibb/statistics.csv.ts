import type { APIRoute } from 'astro';
import { bibbCounty, statisticSource } from '../../../data/bibb-county';

/** Static, source-attributed export of the same snapshot displayed on the hub. */
export const GET: APIRoute = () => {
  const census = bibbCounty.census;
  const rows = [
    ['Topic', 'Measure', 'Bibb County', 'Georgia', 'Reference period', 'County source', 'Georgia source', 'Source checked', 'Bibb detail', 'Georgia detail', 'Definition notes'],
    ...census.groups.flatMap(group => group.statistics.map(stat => [
      group.title, stat.label, stat.value, stat.georgia, stat.period,
      statisticSource(stat), statisticSource(stat, true), census.checked,
      stat.detail ?? '', stat.stateDetail ?? '', group.note,
    ])),
  ];
  const csv = rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
