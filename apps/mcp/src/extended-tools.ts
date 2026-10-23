import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit, defined } from './toolkit';

const uuid = z.string().uuid();
const visibility = z.enum(['public', 'unlisted', 'private']);
const query = z.string().max(500).default('');
const limit = z.number().int().min(1).max(100).default(20);
const offset = z.number().int().min(0).default(0);
const object = z.record(z.string(), z.unknown());
const url = z.string().url().max(2000).regex(/^https?:\/\//i);
const slug = z.string().max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const rowId = z.string().regex(/^[1-9][0-9]*$/).refine(value => BigInt(value) <= 9223372036854775807n, 'ID exceeds bigint range');
const geometry = z.object({ type: z.enum(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']), coordinates: z.array(z.unknown()) });

export function registerExtendedTools(server: McpServer, supabase: SupabaseClient, user: Pick<User, 'id' | 'email'>) {
  const { register, readRpc, create, update, remove, relationship, ensureAdmin } = createToolkit(server, supabase);
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }

  // Search all ten content types, with stable pagination and relationship matches.
  readRpc('search_site', 'Search or browse all civic content, including related names, roles and stored-layer properties. Visibility follows your account.',
    { query, type: z.enum(['organization', 'person', 'election', 'contest', 'ballot_question', 'article', 'map', 'layer', 'calendar', 'event']).nullish(), limit, offset },
    'search_site', input => ({ p_query: input.query, p_type: input.type ?? null, p_limit: input.limit, p_offset: input.offset }));
  for (const [plural, type] of [['calendars', 'calendar'], ['layers', 'layer'], ['articles', 'article'], ['contests', 'contest'], ['ballot_questions', 'ballot_question']]) {
    readRpc(`search_${plural}`, `Search or browse ${plural.replaceAll('_', ' ')} with pagination. Use the returned id with get_${type}.`,
      { query, limit, offset }, 'search_site', input => ({ p_query: input.query, p_type: type, p_limit: input.limit, p_offset: input.offset }));
  }
  for (const type of ['organization', 'calendar', 'layer', 'article', 'contest', 'ballot_question']) {
    readRpc(`get_${type}`, `Get one ${type.replaceAll('_', ' ')} by id. Article association sets are returned only to admins.`,
      { id: uuid }, 'mcp_get_record', ({ id }) => ({ p_type: type, p_id: id }));
  }
  readRpc('get_map_layers', 'Get visible layers in stacking order, including effective per-map styles.',
    { map_id: uuid }, 'get_map_layers', ({ map_id }) => ({ p_map_id: map_id }));
  readRpc('get_layer_geojson', 'Get stored layer geometry. Non-admin callers must provide a visible map containing this layer.',
    { layer_id: uuid, map_id: uuid.nullish() }, 'get_layer_geojson', ({ layer_id, map_id }) => ({ p_layer_id: layer_id, p_map_id: map_id ?? null }));
  readRpc('get_person_articles', 'Get a person’s permitted article reading list, with publication dates and relationship labels.',
    { person_id: uuid }, 'get_person_articles', ({ person_id }) => ({ p_person_id: person_id }));
  readRpc('get_organization_articles', 'Get an organization’s permitted article reading list.',
    { organization_id: uuid }, 'get_organization_articles', ({ organization_id }) => ({ p_organization_id: organization_id }));
  readRpc('get_person_candidacies', 'Get a person’s visible current and past election candidacies.',
    { person_id: uuid }, 'get_person_candidacies', ({ person_id }) => ({ p_person_id: person_id }));
  register('list_person_organizations', 'Get organization affiliations through the person visibility gate.', { person_id: uuid },
    async ({ person_id }) => {
      const data = await rpc('get_person', { p_id: person_id });
      return { status: data.status, organizations: data.organizations ?? [] };
    });
  for (const [name, field] of [['list_contests', 'contests'], ['list_ballot_questions', 'ballot_questions']]) {
    register(name, `List an election’s ${field.replaceAll('_', ' ')} through its visibility gate.`, { election_id: uuid }, async ({ election_id }) => {
      const data = await rpc('get_election', { p_id: election_id });
      return { status: data.status, [field]: data[field] ?? [] };
    });
  }
  register('list_contest_candidates', 'List the candidates of a visible contest, including party, status and certified write-in flag.',
    { contest_id: uuid }, async ({ contest_id }) => {
      const data = await rpc('mcp_get_record', { p_type: 'contest', p_id: contest_id });
      return { status: data.status, candidates: data.contest?.candidates ?? [] };
    });
  register('get_contest_candidate', 'Get one person’s candidacy through the contest/election visibility gate.',
    { contest_id: uuid, person_id: uuid }, async ({ contest_id, person_id }) => {
      const data = await rpc('mcp_get_record', { p_type: 'contest', p_id: contest_id });
      const candidate = data.contest?.candidates?.find((value: { person: { id: string } }) => value.person.id === person_id);
      return candidate ? { status: 'ok', contest_id, person_id, candidate } : { status: 'missing' };
    });

  const map = {
    slug, name: z.string().min(1).max(120), description: z.string().max(2000).nullish(),
    base_map: z.enum(['osm', 'osm-humanitarian', 'osm-topo']).optional(), visibility: visibility.optional(), organization_id: uuid.nullish(), view_options: object.optional(),
  };
  create('map', 'maps', 'Create a map (admin only). Add reusable layers using create_map_layer.', map, 'id,slug,name,visibility,base_map,organization_id,view_options');
  update('map', 'maps', 'Partially update a map (admin only). Layer links are managed separately.', map, 'id,slug,name,visibility,base_map,organization_id,view_options');
  remove('map', 'maps', 'Delete a map and its layer links, preserving reusable layers (admin only).');
  const layer = {
    name: z.string().min(1).max(120), description: z.string().max(2000).nullish(), source_url: url.max(1000),
    visibility: visibility.optional(), style: object.optional(), presentation: object.optional(),
  };
  create('layer', 'layers', 'Create a remote GeoJSON URL layer (admin only). Use save_postgis_layer for stored geometry.', layer, 'id,name,source_type,source_url,visibility,style,presentation');
  update('layer', 'layers', 'Partially update layer metadata (admin only). This does not replace stored geometry or change its source type.',
    { ...layer, source_url: layer.source_url.nullish() }, 'id,name,source_type,source_url,visibility,style,presentation');
  remove('layer', 'layers', 'Delete a reusable layer, its stored features and all map links (admin only).');
  register('save_postgis_layer', 'Create or update a stored PostGIS layer atomically (admin only). Creation requires name and a GeoJSON FeatureCollection. Use id to update; omitted metadata is preserved. Omit geojson on update to keep features; otherwise the entire dataset is replaced. Limit: 10 MB / 10,000 features.',
    { id: uuid.optional(), name: layer.name.optional(), description: layer.description, visibility: visibility.optional(), style: object.optional(), presentation: object.optional(), geojson: object.optional() },
    async ({ geojson, ...metadata }) => ({ id: await rpc('mcp_save_postgis_layer', { p_layer: defined(metadata), p_geojson: geojson ?? null }) }),
    { write: true });
  relationship('map_layer', 'map_layers', ['map_id', 'layer_id'], { position: z.number().int().optional(), style: object.nullish(), visible_by_default: z.boolean().optional() });
  register('list_map_layer_links', 'Get editable positions and style overrides for map-layer links (admin only).', { map_id: uuid }, async ({ map_id }) => {
    await ensureAdmin();
    const { data, error } = await supabase.from('map_layers').select('map_id,layer_id,position,style,visible_by_default').eq('map_id', map_id).order('position').order('layer_id');
    if (error) throw new Error(error.message);
    return data;
  });

  const contest = {
    election_id: uuid, office: z.string().min(1).max(160), district: z.string().max(160).nullish(), seat: z.string().max(160).nullish(),
    description: z.string().max(2000).nullish(), partisan: z.boolean().optional(), position: z.number().int().optional(),
  };
  create('contest', 'contests', 'Create an office contest within an election (admin only).', contest, 'id,election_id,office,district,seat,description,partisan,position');
  update('contest', 'contests', 'Partially update an election contest (admin only).', contest, 'id,election_id,office,district,seat,description,partisan,position');
  remove('contest', 'contests', 'Delete a contest and its candidacy links, preserving people (admin only).');
  relationship('contest_candidate', 'contest_candidates', ['contest_id', 'person_id'], {
    party: z.string().max(120).nullish(), status: z.enum(['running', 'withdrawn', 'won', 'lost', 'runoff', 'pending']).optional(),
    position: z.number().int().optional(), is_write_in: z.boolean().optional(),
  });
  const question = {
    election_id: uuid, title: z.string().trim().min(1).max(200), question_text: z.string().trim().min(1).max(20000),
    description: z.string().max(4000).nullish(), jurisdiction: z.string().max(200).nullish(),
    choices: z.array(z.string().min(1).max(4000)).min(2).max(20).optional(), source_url: url.nullish(), position: z.number().int().optional(),
  };
  create('ballot_question', 'ballot_questions', 'Create a referendum/amendment/ballot question (admin only). Defaults to Yes/No choices.', question,
    'id,election_id,title,question_text,description,jurisdiction,choices,source_url,position');
  update('ballot_question', 'ballot_questions', 'Partially update a ballot question (admin only).', question,
    'id,election_id,title,question_text,description,jurisdiction,choices,source_url,position');
  remove('ballot_question', 'ballot_questions', 'Delete a ballot question (admin only).');
  relationship('person_organization', 'person_organizations', ['person_id', 'organization_id'], { role: z.string().min(1).max(60) });

  readRpc('get_organization_relationships', 'List related organizations, with labels normalized for the requested profile and source URLs.',
    { organization_id: uuid }, 'get_organization_relationships', ({ organization_id }) => ({ p_organization_id: organization_id }));
  const organizationRelationship = {
    organization_id: uuid, related_organization_id: uuid,
    relationship: z.string().trim().min(1).max(160), reverse_relationship: z.string().trim().min(1).max(160), source_url: url.nullish(),
  };
  create('organization_relationship', 'organization_relationships', 'Link two different organizations (admin only). relationship labels the related organization on the first profile; reverse_relationship labels the first on the related profile. One row appears on both profiles; reverse duplicate pairs are rejected.', organizationRelationship);
  update('organization_relationship', 'organization_relationships', 'Update an organization relationship by id (admin only). Omitted fields are preserved.', organizationRelationship);
  remove('organization_relationship', 'organization_relationships', 'Delete an organization relationship from both profiles, preserving both organizations (admin only).');

  const article = {
    title: z.string().trim().min(1).max(500), url, visibility: visibility.optional(),
    fetched_on: z.iso.date().nullish(), published_on: z.iso.date().nullish(),
    people: z.array(z.object({ person_id: uuid, role: z.string().trim().min(1).max(80).optional() })).optional(),
    organizations: z.array(z.object({ organization_id: uuid, role: z.string().trim().min(1).max(80).optional() })).optional(),
  };
  async function saveArticle(input: Record<string, unknown>) {
    const { people, organizations, ...metadata } = input;
    return { id: await rpc('mcp_save_article', { p_article: defined(metadata), p_people: people ?? null, p_organizations: organizations ?? null }) };
  }
  register('create_article', 'Create an article and optional person/organization links atomically (admin only). Omit unknown dates; never infer publication dates from fetched dates.', article,
    input => saveArticle(input), { write: true, destructive: false });
  register('update_article', 'Partially update an article atomically (admin only). Omitted fields and association sets are preserved; null clears a date and [] clears that link set.',
    { id: uuid, ...z.object(article).partial().shape }, async input => {
      if (Object.keys(defined(input)).length === 1) throw new Error('Provide at least one field to update');
      return saveArticle(input);
    }, { write: true, idempotent: true });
  remove('article', 'articles', 'Delete an article and its association links, preserving people/organizations (admin only).');
  relationship('article_person', 'article_people', ['article_id', 'person_id'], { role: z.string().trim().min(1).max(80).optional() });
  relationship('article_organization', 'article_organizations', ['article_id', 'organization_id'], { role: z.string().trim().min(1).max(80).optional() });
  for (const [name, table, columns] of [['list_article_people', 'article_people', 'article_id,person_id,role'], ['list_article_organizations', 'article_organizations', 'article_id,organization_id,role']]) {
    register(name, 'List editable article association links (admin only). Profile reading lists remain available to other users.', { article_id: uuid }, async ({ article_id }) => {
      await ensureAdmin();
      const { data, error } = await supabase.from(table).select(columns).eq('article_id', article_id);
      if (error) throw new Error(error.message);
      return data;
    });
  }

  const featureFields = { position: z.number().int().optional(), feature_id: z.union([z.string(), z.number()]).nullish(), properties: object.optional(), geometry };
  readRpc('search_layer_features', 'Search or browse stored feature properties with pagination. IDs are bigint strings. Non-admins must supply a visible map containing the layer.',
    { layer_id: uuid, map_id: uuid.nullish(), query, limit, offset }, 'mcp_layer_features', input => ({
      p_layer_id: input.layer_id, p_map_id: input.map_id ?? null, p_query: input.query, p_limit: input.limit, p_offset: input.offset,
    }));
  register('get_layer_feature', 'Get one stored feature by its internal bigint-string id. Non-admins must provide a visible containing map.',
    { layer_id: uuid, map_id: uuid.nullish(), id: rowId }, async ({ layer_id, map_id, id }) => {
      const data = await rpc('mcp_layer_features', { p_layer_id: layer_id, p_map_id: map_id ?? null, p_id: id, p_limit: 1 });
      return data?.length ? { status: 'ok', feature: data[0] } : { status: 'missing' };
    });
  register('create_layer_feature', 'Create a stored-layer feature atomically (admin only). Geometry must be WGS84 longitude/latitude. Position defaults to the next available position.',
    { layer_id: uuid, ...featureFields }, async ({ layer_id, ...feature }) => ({ id: await rpc('mcp_save_layer_feature', { p_layer_id: layer_id, p_feature: defined(feature) }), layer_id }),
    { write: true, destructive: false });
  register('update_layer_feature', 'Partially update a stored feature without replacing the dataset (admin only). null clears the source feature_id; internal id remains unchanged.',
    { layer_id: uuid, id: rowId, ...z.object(featureFields).partial().shape }, async ({ layer_id, id, ...feature }) => {
      if (!Object.keys(defined(feature)).length) throw new Error('Provide at least one field to update');
      return { id: await rpc('mcp_save_layer_feature', { p_layer_id: layer_id, p_id: id, p_feature: defined(feature) }), layer_id };
    }, { write: true, idempotent: true });
  register('delete_layer_feature', 'Delete one stored feature (admin only).', { layer_id: uuid, id: rowId }, async ({ layer_id, id }) => {
    const { data, error } = await supabase.from('layer_features').delete().eq('layer_id', layer_id).eq('id', id).select('layer_id');
    if (error) throw new Error(error.message);
    return { id, layer_id, deleted: data?.length ?? 0 };
  }, { write: true, idempotent: true });

  register('get_my_profile', 'Get your own account profile.', {}, async () => {
    const { data, error } = await supabase.from('profiles').select('id,display_name,created_at,updated_at').eq('id', user.id).single();
    if (error) throw new Error(error.message);
    return data;
  });
  register('update_my_profile', 'Update your own display name. This does not grant admin access or edit another user.', { display_name: z.string().min(1).max(80).nullable() }, async ({ display_name }) => {
    const { data, error } = await supabase.from('profiles').update({ display_name }).eq('id', user.id).select('id,display_name').single();
    if (error) throw new Error(error.message);
    return data;
  }, { write: true, ownProfile: true, idempotent: true });

  const bucket = z.enum(['org-logos', 'person-images']);
  const path = z.string().min(1).max(512).regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/).refine(value => !value.split('/').some(part => !part || part === '.' || part === '..'), 'Use a relative object path without dot segments');
  register('list_images', 'Browse/search public organization logos or person images, with pagination.',
    { bucket, prefix: z.string().max(512).default(''), search: z.string().max(200).default(''), limit, offset }, async input => {
      const { data, error } = await supabase.storage.from(input.bucket).list(input.prefix, { search: input.search, limit: input.limit, offset: input.offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw new Error(error.message);
      return data;
    });
  register('get_image_url', 'Get the public URL for an organization logo or person image.', { bucket, path }, async input =>
    ({ path: input.path, url: supabase.storage.from(input.bucket).getPublicUrl(input.path).data.publicUrl }));
  register('upload_image', 'Upload a user-supplied PNG/JPEG/WebP/SVG image (admin only, max 2 MB). Base64 must omit any data-URL prefix. Set overwrite only when replacing an existing image; use the returned path in logo_path or image_path.',
    { bucket, path, content_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']), data_base64: z.string().min(4).max(2796204), overwrite: z.boolean().default(false) }, async input => {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data_base64)) throw new Error('Invalid base64');
      const binary = atob(input.data_base64);
      if (binary.length > 2097152) throw new Error('Image limit: 2 MB');
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const { data, error } = await supabase.storage.from(input.bucket).upload(input.path, bytes, { contentType: input.content_type, upsert: input.overwrite });
      if (error) throw new Error(error.message);
      return { path: data.path, url: supabase.storage.from(input.bucket).getPublicUrl(data.path).data.publicUrl };
    }, { write: true });
  register('delete_image', 'Remove an organization logo or person image object (admin only). Update any record referencing its path separately.', { bucket, path }, async input => {
    const { error } = await supabase.storage.from(input.bucket).remove([input.path]);
    if (error) throw new Error(error.message);
    return { deleted: true, bucket: input.bucket, path: input.path };
  }, { write: true, idempotent: true });
}
