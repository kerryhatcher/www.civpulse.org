import assert from 'node:assert/strict';

/** Runs with real OAuth user tokens against the local Worker and Supabase. */
export async function runCrudSuite({ adminToken, readerToken, tool, apiUrl }) {
  const cleanup = [];
  const needle = `McpCrud${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = async (name, input = {}) => value(adminToken, name, input);
  const reader = async (name, input = {}) => value(readerToken, name, input);
  async function value(token, name, input) {
    const result = await tool(token, name, input);
    assert.ok(!result.isError, `${name}: ${result.content[0].text}`);
    return JSON.parse(result.content[0].text);
  }
  async function denied(name, input) {
    assert.equal(Boolean((await tool(readerToken, name, input)).isError), true, `${name} must reject non-admin writes/admin-only reads`);
  }
  async function create(name, input, deleteName = `delete_${name.slice(7)}`) {
    await denied(name, input);
    const record = await admin(name, input);
    cleanup.push(() => admin(deleteName, { id: record.id }));
    return record;
  }
  async function link(kind, input, patch) {
    const name = `create_${kind}`;
    await denied(name, input);
    await admin(name, input);
    const keys = Object.fromEntries(Object.entries(input).filter(([key]) => key.endsWith('_id')));
    cleanup.push(() => admin(`delete_${kind}`, keys));
    await denied(`update_${kind}`, { ...keys, ...patch });
    await admin(`update_${kind}`, { ...keys, ...patch });
    await denied(`delete_${kind}`, keys);
    return keys;
  }

  try {
    const org = await create('create_organization', { slug: needle.toLowerCase(), name: `${needle} organization` });
    await denied('update_organization', { id: org.id, name: `${needle} updated` });
    await admin('update_organization', { id: org.id, name: `${needle} updated` });
    const organization = (await reader('get_organization', { id: org.id })).organization;
    assert.equal(organization.slug, needle.toLowerCase());
    assert.equal(organization.name, `${needle} updated`);
    const relatedOrg = await create('create_organization', { slug: `${needle.toLowerCase()}-related`, name: `${needle} related organization` });
    const relationshipInput = { organization_id: org.id, related_organization_id: relatedOrg.id,
      relationship: 'Governing board', reverse_relationship: 'School district', source_url: 'https://example.test/relationship' };
    const orgRelationship = await create('create_organization_relationship', relationshipInput);
    assert.equal((await reader('get_organization_relationships', { organization_id: org.id }))[0].related_organization_id, relatedOrg.id);
    assert.equal((await reader('get_organization_relationships', { organization_id: relatedOrg.id }))[0].relationship, 'School district');
    await denied('update_organization_relationship', { id: orgRelationship.id, relationship: 'Unauthorized' });
    await admin('update_organization_relationship', { id: orgRelationship.id, reverse_relationship: 'Updated district' });
    assert.equal((await reader('get_organization_relationships', { organization_id: relatedOrg.id }))[0].relationship, 'Updated district');
    assert.ok((await tool(adminToken, 'create_organization_relationship', { ...relationshipInput,
      organization_id: relatedOrg.id, related_organization_id: org.id })).isError, 'Reverse pairs must not duplicate a relationship');
    await denied('delete_organization_relationship', { id: orgRelationship.id });
    await admin('delete_organization_relationship', { id: orgRelationship.id });
    assert.equal((await reader('get_organization_relationships', { organization_id: org.id })).length, 0);
    const calendar = await create('create_calendar', { organization_id: org.id, slug: needle.toLowerCase(), name: `${needle} calendar`, visibility: 'private' });
    await admin('update_calendar', { id: calendar.id, description: 'A partial calendar edit' });
    assert.equal((await admin('get_calendar', { id: calendar.id })).calendar.visibility, 'private');
    assert.equal((await reader('get_calendar', { id: calendar.id })).status, 'missing');
    await admin('update_calendar', { id: calendar.id, visibility: 'public' });
    assert.ok((await reader('search_calendars', { query: needle })).some(row => row.id === calendar.id));
    assert.ok((await reader('list_calendars', { organization_id: org.id })).some(row => row.id === calendar.id));
    const event = await create('create_event', { calendar_id: calendar.id, title: `${needle} event`, starts_at: '2027-11-02T12:00:00Z', visibility: 'private' });
    await admin('update_event', { id: event.id, location: 'Partial event edit' });
    assert.equal((await reader('get_event', { id: event.id })).status, 'private');
    await admin('update_event', { id: event.id, visibility: 'public' });
    assert.equal((await reader('get_event', { id: event.id })).event.location, 'Partial event edit');
    assert.ok((await reader('search_events', { query: needle, include_past: true })).some(row => row.id === event.id));
    const person = await create('create_person', { slug: `${needle.toLowerCase()}-person`, full_name: `${needle} person`, visibility: 'private' });
    const secondPerson = await create('create_person', { slug: `${needle.toLowerCase()}-other`, full_name: `${needle} other`, visibility: 'unlisted' });
    await admin('update_person', { id: person.id, description: 'Partial person edit' });
    assert.equal((await reader('get_person', { id: person.id })).status, 'private');
    await admin('update_person', { id: person.id, visibility: 'public' });
    assert.equal((await reader('get_person', { id: person.id })).person.description, 'Partial person edit');
    assert.ok((await reader('search_people', { query: needle })).some(row => row.id === person.id));
    const affiliation = await link('person_organization', { person_id: person.id, organization_id: org.id, role: 'Candidate' }, { role: 'Member' });
    assert.ok((await reader('list_person_organizations', { person_id: person.id })).organizations.some(row => row.id === org.id && row.role === 'Member'));

    const map = await create('create_map', { slug: `${needle.toLowerCase()}-map`, name: `${needle} map`, organization_id: org.id, visibility: 'private' });
    await admin('update_map', { id: map.id, description: 'Partial map edit' });
    const remoteLayer = await create('create_layer', { name: `${needle} remote`, source_url: 'https://example.test/data.geojson', visibility: 'private', style: { color: '#123456' } });
    await admin('update_layer', { id: remoteLayer.id, description: 'Partial layer edit' });
    assert.equal((await reader('get_map', { id: map.id })).status, 'private');
    assert.equal((await reader('get_layer', { id: remoteLayer.id })).status, 'missing');
    await admin('update_map', { id: map.id, visibility: 'public' });
    await admin('update_layer', { id: remoteLayer.id, visibility: 'public' });
    await link('map_layer', { map_id: map.id, layer_id: remoteLayer.id, position: 1, style: { color: '#abcdef' } }, { position: 2 });
    const mapLayers = await reader('get_map_layers', { map_id: map.id });
    assert.equal(mapLayers.find(row => row.id === remoteLayer.id).style.color, '#abcdef');
    assert.ok((await reader('get_map', { id: map.id })).layers.some(row => row.id === remoteLayer.id));
    assert.ok((await reader('search_maps', { query: needle })).some(row => row.id === map.id));
    assert.ok((await reader('search_layers', { query: needle })).some(row => row.id === remoteLayer.id));
    await denied('list_map_layer_links', { map_id: map.id });
    assert.equal((await admin('list_map_layer_links', { map_id: map.id }))[0].position, 2);

    const initialGeometry = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'initial', properties: { label: needle }, geometry: { type: 'Point', coordinates: [-83.63, 32.84] } }] };
    await denied('save_postgis_layer', { name: `${needle} stored`, visibility: 'private', geojson: initialGeometry });
    const stored = await admin('save_postgis_layer', { name: `${needle} stored`, visibility: 'private', geojson: initialGeometry });
    cleanup.push(() => admin('delete_layer', { id: stored.id }));
    await admin('save_postgis_layer', { id: stored.id, description: 'Metadata only; retain private visibility and features' });
    assert.equal((await admin('get_layer', { id: stored.id })).layer.visibility, 'private');
    assert.equal((await reader('get_layer', { id: stored.id })).status, 'missing');
    await admin('save_postgis_layer', { id: stored.id, visibility: 'public' });
    await link('map_layer', { map_id: map.id, layer_id: stored.id, position: 0 }, { style: { color: '#332211' } });
    await denied('get_layer_geojson', { layer_id: stored.id });
    assert.equal((await reader('get_layer_geojson', { layer_id: stored.id, map_id: map.id })).features.length, 1);
    const featureInput = { layer_id: stored.id, geometry: { type: 'Point', coordinates: [-83.62, 32.83] }, feature_id: 'new', properties: { label: `${needle} added` } };
    await denied('create_layer_feature', featureInput);
    const feature = await admin('create_layer_feature', featureInput);
    const featureKeys = { layer_id: stored.id, id: feature.id };
    cleanup.push(() => admin('delete_layer_feature', featureKeys));
    assert.equal(typeof feature.id, 'string');
    await denied('update_layer_feature', { ...featureKeys, properties: { label: `${needle} revised` } });
    await admin('update_layer_feature', { ...featureKeys, properties: { label: `${needle} revised` } });
    const featureRead = (await reader('get_layer_feature', { ...featureKeys, map_id: map.id })).feature;
    assert.deepEqual(featureRead.geometry.coordinates, [-83.62, 32.83]);
    assert.equal(featureRead.feature_id, 'new');
    assert.ok((await reader('search_layer_features', { layer_id: stored.id, map_id: map.id, query: 'revised' })).some(row => row.id === feature.id));
    await denied('search_layer_features', { layer_id: stored.id, query: needle });
    const invalidFeature = await tool(adminToken, 'create_layer_feature', { ...featureInput, geometry: { type: 'Point', coordinates: [500, 32] } });
    assert.ok(invalidFeature.isError, 'Out-of-range geometry must roll back');
    assert.equal((await admin('get_layer_geojson', { layer_id: stored.id })).features.length, 2);
    await denied('delete_layer_feature', featureKeys);
    await admin('delete_layer_feature', featureKeys);
    assert.equal((await reader('get_layer_feature', { ...featureKeys, map_id: map.id })).status, 'missing');

    const election = await create('create_election', { slug: `${needle.toLowerCase()}-election`, name: `${needle} election`, election_date: '2027-11-02', visibility: 'private' });
    await admin('update_election', { id: election.id, description: 'Partial election edit' });
    assert.equal((await reader('get_election', { id: election.id })).status, 'private');
    await admin('update_election', { id: election.id, visibility: 'public' });
    assert.ok((await reader('search_elections', { query: needle })).some(row => row.id === election.id));
    const contest = await create('create_contest', { election_id: election.id, office: `${needle} commissioner`, partisan: false });
    await admin('update_contest', { id: contest.id, seat: 'Seat 1' });
    const candidate = await link('contest_candidate', { contest_id: contest.id, person_id: person.id, party: 'Independent', is_write_in: true }, { party: null });
    const candidacy = (await reader('get_contest_candidate', candidate)).candidate;
    assert.equal(candidacy.is_write_in, true);
    assert.equal(candidacy.party, null);
    assert.equal((await reader('list_contest_candidates', { contest_id: contest.id })).candidates.length, 1);
    assert.ok((await reader('list_contests', { election_id: election.id })).contests.some(row => row.id === contest.id));
    assert.ok((await reader('search_contests', { query: needle })).some(row => row.id === contest.id));
    assert.ok(JSON.stringify(await reader('get_person_candidacies', { person_id: person.id })).includes(election.id));
    const question = await create('create_ballot_question', { election_id: election.id, title: `${needle} question`, question_text: 'Should the test fixture pass?' });
    await admin('update_ballot_question', { id: question.id, choices: ['For', 'Against'] });
    assert.deepEqual((await reader('get_ballot_question', { id: question.id })).ballot_question.choices, ['For', 'Against']);
    assert.ok((await reader('list_ballot_questions', { election_id: election.id })).ballot_questions.some(row => row.id === question.id));
    assert.ok((await reader('search_ballot_questions', { query: needle })).some(row => row.id === question.id));
    assert.equal((await reader('get_election', { id: election.id })).status, 'ok');

    const articleInput = { title: `${needle} news`, url: `https://example.test/${needle}`, visibility: 'unlisted', fetched_on: '2026-10-21', people: [{ person_id: person.id, role: 'Subject' }], organizations: [{ organization_id: org.id, role: 'Publisher' }] };
    const article = await create('create_article', articleInput);
    await denied('update_article', { id: article.id, title: `${needle} forbidden` });
    await admin('update_article', { id: article.id, published_on: '2026-09-01' });
    const articleRead = await admin('get_article', { id: article.id });
    assert.equal(articleRead.article.title, articleInput.title);
    assert.equal(articleRead.article.fetched_on, '2026-10-21');
    assert.equal(articleRead.people[0].person_id, person.id);
    assert.equal(articleRead.organizations[0].organization_id, org.id);
    assert.equal((await reader('get_article', { id: article.id })).status, 'missing');
    await admin('update_article', { id: article.id, visibility: 'public' });
    assert.ok(!('people' in await reader('get_article', { id: article.id })), 'Do not expose admin-only association sets');
    assert.ok((await reader('search_articles', { query: needle })).some(row => row.id === article.id));
    assert.ok((await reader('get_person_articles', { person_id: person.id })).some(row => row.id === article.id));
    assert.ok((await reader('get_organization_articles', { organization_id: org.id })).some(row => row.id === article.id));
    const invalidArticle = await tool(adminToken, 'update_article', { id: article.id, title: 'Must roll back', people: [{ person_id: crypto.randomUUID() }] });
    assert.ok(invalidArticle.isError);
    assert.equal((await admin('get_article', { id: article.id })).article.title, articleInput.title, 'Article metadata must roll back with invalid links');
    await admin('update_article', { id: article.id, published_on: null });
    assert.equal((await admin('get_article', { id: article.id })).article.published_on, null);
    await link('article_person', { article_id: article.id, person_id: secondPerson.id, role: 'Mentioned' }, { role: 'Author' });
    await denied('list_article_people', { article_id: article.id });
    assert.equal((await admin('list_article_people', { article_id: article.id })).length, 2);
    await admin('delete_article_organization', { article_id: article.id, organization_id: org.id });
    await link('article_organization', { article_id: article.id, organization_id: org.id, role: 'Publisher' }, { role: 'Mentioned' });
    await denied('list_article_organizations', { article_id: article.id });
    assert.equal((await admin('list_article_organizations', { article_id: article.id }))[0].role, 'Mentioned');
    const allSearch = await reader('search_site', { query: needle, limit: 100 });
    for (const type of ['organization', 'person', 'map', 'layer', 'calendar', 'event', 'election', 'contest', 'ballot_question', 'article']) {
      assert.ok(allSearch.some(row => row.entity_type === type), `Unified search is missing ${type}`);
    }
    const page1 = await reader('search_site', { query: needle, limit: 1, offset: 0 });
    const page2 = await reader('search_site', { query: needle, limit: 1, offset: 1 });
    assert.notEqual(`${page1[0].entity_type}:${page1[0].id}`, `${page2[0].entity_type}:${page2[0].id}`);

    const profile = await reader('get_my_profile');
    await reader('update_my_profile', { display_name: `${needle} reader` });
    assert.equal((await reader('get_my_profile')).display_name, `${needle} reader`);
    await reader('update_my_profile', { display_name: profile.display_name });
    const path = `${profile.id}/${needle}.svg`;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>';
    const image = { bucket: 'person-images', path, content_type: 'image/svg+xml', data_base64: Buffer.from(svg).toString('base64') };
    await denied('upload_image', image);
    const uploaded = await admin('upload_image', image);
    cleanup.push(() => admin('delete_image', { bucket: image.bucket, path }));
    assert.ok(uploaded.url.startsWith(apiUrl));
    assert.ok((await reader('list_images', { bucket: image.bucket, prefix: profile.id, search: needle })).some(row => row.name === `${needle}.svg`));
    assert.equal((await reader('get_image_url', { bucket: image.bucket, path })).url, uploaded.url);
    assert.ok((await fetch(uploaded.url)).ok);
    assert.ok((await tool(adminToken, 'upload_image', image)).isError, 'Accidental overwrites must fail');
    await admin('upload_image', { ...image, overwrite: true });
    await denied('delete_image', { bucket: image.bucket, path });
    await admin('delete_image', { bucket: image.bucket, path });
    assert.ok(!(await fetch(uploaded.url)).ok);

    // Delete each primary resource explicitly and verify its detail read is gone.
    for (const [kind, id] of [['article', article.id], ['ballot_question', question.id], ['contest', contest.id], ['election', election.id], ['event', event.id], ['calendar', calendar.id], ['map', map.id], ['layer', remoteLayer.id], ['person', person.id]]) {
      await denied(`delete_${kind}`, { id });
      await admin(`delete_${kind}`, { id });
      assert.equal((await reader(`get_${kind}`, { id })).status, 'missing');
    }
    await admin('delete_person_organization', affiliation);
    console.log('PASS full content CRUD, partial edits, link CRUD, all-type search/pagination, PostGIS rollback, profile and image operations; non-admin writes denied');
  } finally {
    for (const run of cleanup.reverse()) {
      try { await run(); } catch (error) { console.error('Local fixture cleanup failed:', error.message); }
    }
  }
}
