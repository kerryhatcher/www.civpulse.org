import { readRows } from './build-rows';
import { getBuildSupabase } from './supabase-build';
import type { Person, PersonVisibility } from './people';

export interface PersonRelationship {
  id: string; person_id: string; related_person_id: string;
  relationship: string; reverse_relationship: string; source_url: string | null;
}
export interface RelatedPerson extends PersonRelationship {
  related_person_name: string; related_person_slug: string; related_person_visibility: PersonVisibility;
}
/** Both endpoints must belong to the anonymous public snapshot, even if a caller
 * accidentally supplies a wider relationship list. Never prerender hidden IDs. */
export function groupPublicPersonRelationships(people: Person[], links: PersonRelationship[]): Map<string, RelatedPerson[]> {
  const byId = new Map(people.filter(p => p.visibility === 'public').map(p => [p.id, p]));
  const result = new Map<string, RelatedPerson[]>();
  for (const link of links) {
    const a = byId.get(link.person_id), b = byId.get(link.related_person_id);
    if (!a || !b) continue;
    for (const [owner, other, forward] of [[a, b, true], [b, a, false]] as const) {
      const rows = result.get(owner.id) ?? [];
      rows.push({ ...link, person_id: owner.id, related_person_id: other.id,
        relationship: forward ? link.relationship : link.reverse_relationship,
        reverse_relationship: forward ? link.reverse_relationship : link.relationship,
        related_person_name: other.full_name, related_person_slug: other.slug, related_person_visibility: 'public' });
      result.set(owner.id, rows);
    }
  }
  for (const rows of result.values()) rows.sort((a,b) => a.related_person_name.localeCompare(b.related_person_name) || a.related_person_id.localeCompare(b.related_person_id));
  return result;
}

export async function fetchPublicPersonRelationships(people: Person[]): Promise<Map<string, RelatedPerson[]>> {
  const client = getBuildSupabase();
  if (!client) return new Map();
  return groupPublicPersonRelationships(people, await readRows<PersonRelationship>(client, 'person_relationships', 'id,person_id,related_person_id,relationship,reverse_relationship,source_url', ['id']));
}
