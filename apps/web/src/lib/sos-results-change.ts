import type { SosScope } from './sos-results-reader';

// Publication identities, ordering indexes and timestamps are transport metadata.
// Retain complete source result objects, including reporting statuses and unknown counts.
const metadata = /^(snapshot_id|revision|schema_version|jurisdiction_index|item_index|url|source_url|published_at|source_created_at|createdAt|updatedAt|lastUpdated|timestamp)$/;
function canonical(value: unknown, field?: string): string {
  if (Array.isArray(value)) {
    const entries = value.map(entry => canonical(entry));
    // Ballot choices are identified by source ID; unknown arrays retain source order.
    if (field === 'ballotOptions') entries.sort();
    return `[${entries.join(',')}]`;
  }
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([key]) => !metadata.test(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry, key)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function sosResultsFingerprint(scope: SosScope): string {
  return canonical({ jurisdiction: { id: scope.jurisdiction.id, name: scope.jurisdiction.name, reportingStatuses: scope.jurisdiction.reportingStatuses }, items: [...scope.items].sort((a, b) => String(a.data.id).localeCompare(String(b.data.id))).map(item => item.data) });
}
