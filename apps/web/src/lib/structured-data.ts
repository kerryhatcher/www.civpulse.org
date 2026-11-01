import type { Person, OrganizationAffiliation } from './people';
import type { Organization } from './organizations';
import type { EventRecord } from './calendars';
import { isPublicEvent } from './calendar-snapshot';
import { dayKey } from './calendar-display';

export type SchemaNode = Record<string, unknown>;
export interface Breadcrumb { name: string; href: string }

/** Escape the HTML parser's script terminator, not just JSON string quotes. */
export function serializeStructuredData(nodes: SchemaNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function entityId(page: URL, kind: string, id: string): string {
  return new URL(`/#${kind}-${id}`, page).href;
}
function httpUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

export function siteStructuredData(home: URL): SchemaNode[] {
  const publisher = new URL('/#publisher', home).href;
  return [
    { '@type': 'Organization', '@id': publisher, name: 'Civic Pulse', url: home.href },
    { '@type': 'WebSite', '@id': new URL('/#website', home).href, name: 'Civic Pulse',
      url: home.href, publisher: { '@id': publisher } },
  ];
}

export function breadcrumbStructuredData(items: Breadcrumb[], page: URL): SchemaNode {
  return { '@type': 'BreadcrumbList', '@id': `${page.href}#breadcrumbs`,
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1,
      name: item.name, item: new URL(item.href, page).href })) };
}

export function personStructuredData(person: Person, affiliations: OrganizationAffiliation[], page: URL, image: string | null): SchemaNode[] {
  if (person.visibility !== 'public') return [];
  return [{ '@type': 'Person', '@id': entityId(page, 'person', person.id), name: person.full_name,
    url: page.href, mainEntityOfPage: page.href, image: httpUrl(image),
    // These are the same public relationships displayed on the profile. A role
    // label or historical title does not establish employment or current office.
    ...(affiliations.length ? { affiliation: affiliations.map(org => ({ '@type': 'Organization',
      '@id': entityId(page, 'organization', org.id), name: org.name,
      url: new URL(`/orgs/${org.slug}/`, page).href })) } : {}),
  }];
}

export function organizationStructuredData(org: Organization, page: URL, logo: string | null): SchemaNode[] {
  return [{ '@type': 'Organization', '@id': entityId(page, 'organization', org.id), name: org.name,
    url: page.href, mainEntityOfPage: page.href, ...(org.description ? { description: org.description } : {}),
    logo: httpUrl(logo) }];
}

/** A single public occurrence with a recorded physical venue, not a deadline,
 * voting period, virtual link or calendar listing. Venue text is not an address
 * or evidence that the calendar's publisher is the event organizer. */
export function eventStructuredData(event: EventRecord, page: URL): SchemaNode[] {
  if (!isPublicEvent(event) || event.election_date_kind || !event.title.trim() || !event.location?.trim()
    || /https?:\/\/|\b(online|virtual|zoom|tbd|assigned)\b/i.test(event.location)
    || !Number.isFinite(Date.parse(event.starts_at))
    || (event.ends_at && (!Number.isFinite(Date.parse(event.ends_at)) || Date.parse(event.ends_at) < Date.parse(event.starts_at)))) return [];
  const end = event.ends_at ? new Date(Date.parse(event.ends_at) - (event.all_day && Date.parse(event.ends_at) > Date.parse(event.starts_at) ? 1 : 0)) : null;
  return [{ '@type': 'Event', '@id': entityId(page, 'event', event.id), name: event.title,
    url: page.href, mainEntityOfPage: page.href,
    startDate: event.all_day ? dayKey(event.starts_at) : event.starts_at,
    ...(end ? { endDate: event.all_day ? dayKey(end) : event.ends_at } : {}),
    ...(event.description ? { description: event.description } : {}),
    location: { '@type': 'Place', name: event.location },
  }];
}
