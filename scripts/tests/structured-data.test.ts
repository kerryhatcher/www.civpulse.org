import { expect, test } from 'bun:test';
import { breadcrumbStructuredData, eventStructuredData, organizationStructuredData, personStructuredData, serializeStructuredData, siteStructuredData } from '../../apps/web/src/lib/structured-data';
import type { Person } from '../../apps/web/src/lib/people';
import type { Organization } from '../../apps/web/src/lib/organizations';
import type { EventRecord } from '../../apps/web/src/lib/calendars';
import { shouldNoIndex } from '../../apps/web/src/lib/indexing-policy.mjs';

const origin = 'https://www.civpulse.org';
const page = new URL('/people/example/', origin);
const person = { id: 'person-id', slug: 'example', full_name: 'Example Person', visibility: 'public',
  title: 'Former chair', website_url: 'https://example.test/', social_url: 'https://social.test/',
  description: 'A **recorded** biography', internal: 'secret' } as unknown as Person;
const event = { id: 'event-id', title: 'Community meeting', description: 'Recorded meeting',
  starts_at: '2026-11-01T04:00:00Z', ends_at: '2026-11-02T05:00:00Z', all_day: true,
  location: 'Recorded library venue', visibility: 'public', calendar_visibility: 'public',
  election_id: null, election_date_kind: null, internal: 'secret',
  organization_name: 'Calendar publisher, not necessarily organizer' } as unknown as EventRecord;

test('identity graphs use stable absolute IDs and only explicit displayed facts', () => {
  const home = new URL('/', origin), site = siteStructuredData(home);
  expect(site).toEqual([
    { '@type': 'Organization', '@id': `${origin}/#publisher`, name: 'Civic Pulse', url: home.href },
    { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Civic Pulse', url: home.href, publisher: { '@id': `${origin}/#publisher` } },
  ]);
  const affiliations = [{ id: 'organization-id', slug: 'example-org', name: 'Example Organization', role: 'Former chair' }];
  const [node] = personStructuredData(person, affiliations, page, 'https://images.test/person.png');
  expect(node['@id']).toBe(`${origin}/#person-person-id`);
  expect(node).not.toHaveProperty('jobTitle'); expect(node).not.toHaveProperty('worksFor');
  expect(node).not.toHaveProperty('sameAs'); expect(node).not.toHaveProperty('internal');
  expect(node).not.toHaveProperty('description');
  const org = { id: 'organization-id', slug: 'example-org', name: 'Example Organization', description: 'Visible summary' } as Organization;
  const [orgNode] = organizationStructuredData(org, new URL('/orgs/example-org/', origin), null);
  expect(node.affiliation).toEqual([{ '@type': 'Organization', '@id': orgNode['@id'], name: org.name, url: orgNode.url }]);
  expect(orgNode).not.toHaveProperty('parentOrganization');
  expect(personStructuredData(person, [], new URL('/people/renamed/', origin), null)[0]['@id']).toBe(node['@id']);
  for (const visibility of ['unlisted', 'private'] as const) expect(personStructuredData({ ...person, visibility }, affiliations, page, null)).toEqual([]);
  expect(personStructuredData(person, [], page, 'javascript:alert(1)')[0].image).toBeUndefined();
});

test('breadcrumbs retain visible names, positions and canonical absolute URLs', () => {
  const node = breadcrumbStructuredData([{ name: 'Home', href: '/' }, { name: 'People', href: '/people/' }, { name: person.full_name, href: page.pathname }], page);
  expect(node['@id']).toBe(`${page.href}#breadcrumbs`);
  expect(node.itemListElement).toEqual([
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'People', item: `${origin}/people/` },
    { '@type': 'ListItem', position: 3, name: person.full_name, item: page.href },
  ]);
});

test('event facts preserve public parents, inclusive all-day dates and exact venue without inferred address/organizer', () => {
  const url = new URL('/records/events/event-id/', origin);
  const [node] = eventStructuredData(event, url);
  expect(node.startDate).toBe('2026-11-01'); expect(node.endDate).toBe('2026-11-01');
  expect(node.location).toEqual({ '@type': 'Place', name: event.location });
  expect(node).not.toHaveProperty('organizer'); expect(node).not.toHaveProperty('eventStatus');
  expect(node).not.toHaveProperty('offers'); expect(node).not.toHaveProperty('internal');
  expect(eventStructuredData({ ...event, all_day: false }, url)[0].startDate).toBe(event.starts_at);
  expect(eventStructuredData({ ...event, ends_at: null }, url)[0]).not.toHaveProperty('endDate');
  for (const patch of [
    { visibility: 'unlisted' }, { visibility: 'private' }, { calendar_visibility: 'private' },
    { election_id: 'election', election_visibility: 'unlisted' }, { election_id: 'election', election_visibility: 'private' },
    { election_date_kind: 'registration_deadline' }, { election_date_kind: 'early_voting' },
    { location: null }, { location: 'Online via Zoom' }, { location: 'https://meeting.test/' },
    { starts_at: 'invalid' }, { ends_at: '2026-10-01T00:00:00Z' },
  ]) expect(eventStructuredData({ ...event, ...patch } as EventRecord, url)).toEqual([]);
});

test('untrusted record text cannot terminate the JSON-LD script or change the graph', () => {
  const text = '</script><script>alert("x")</script> & > \u2028\u2029';
  const serialized = serializeStructuredData([{ '@type': 'Person', name: text }]);
  expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(serialized)).toEqual({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person', name: text }] });
});

const dist = process.env.STRUCTURED_DATA_TEST_DIST;
test.skipIf(!dist)('built markup matches canonical identity and visible breadcrumb text; restricted shells emit none', async () => {
  let people = 0, organizations = 0, events = 0, breadcrumbs = 0;
  for await (const file of new Bun.Glob('**/*.html').scan({ cwd: dist!, absolute: false })) {
    const route = '/' + file.replace(/index\.html$/, '');
    const html = await Bun.file(`${dist}/${file}`).text();
    let heading = '';
    await new HTMLRewriter().on('h1', { text(chunk) { heading += chunk.text; } }).transform(new Response(html)).text();
    heading = heading.replace(/&#(\d+);|&#x([\da-f]+);|&(amp|lt|gt|quot|apos);/gi, (_, decimal, hex, named) =>
      decimal || hex ? String.fromCodePoint(parseInt(decimal || hex, decimal ? 10 : 16))
        : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase() as 'amp']) );
    const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    if (shouldNoIndex(route)) { expect(scripts, route).toHaveLength(0); continue; }
    const nodes = scripts.flatMap(script => {
      expect(script[1], route).not.toContain('<');
      const data = JSON.parse(script[1]); expect(data['@context']).toBe('https://schema.org'); return data['@graph'];
    });
    if (route === '/') expect(nodes.map(node => node['@type'])).toEqual(['Organization', 'WebSite']);
    for (const node of nodes) {
      expect(node['@id'], route).toStartWith(`${origin}/`);
      if (node['@type'] === 'BreadcrumbList') {
        breadcrumbs++;
        expect(html, route).toContain('aria-label="Breadcrumb"');
        for (const item of node.itemListElement) expect(new URL(item.item).origin).toBe(origin);
        expect(node.itemListElement.at(-1).item).toBe(`${origin}${route}`);
        continue;
      }
      expect(node.url, route).toBe(`${origin}${route}`);
      if (route !== '/') expect(node.name, route).toBe(heading.trim());
      expect(node).not.toHaveProperty('sameAs'); expect(node).not.toHaveProperty('aggregateRating');
      if (node['@type'] === 'Person') people++;
      if (node['@type'] === 'Organization' && route !== '/') organizations++;
      if (node['@type'] === 'Event') events++;
    }
    if (route.startsWith('/records/events/') && html.includes('deadline')) expect(nodes.some(node => node['@type'] === 'Event')).toBe(false);
  }
  expect(people).toBeGreaterThan(0); expect(organizations).toBeGreaterThan(0); expect(breadcrumbs).toBeGreaterThan(people + organizations);
  console.log({ people, organizations, events, breadcrumbs });
});
