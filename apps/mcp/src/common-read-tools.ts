import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit } from './toolkit';
import type { RelatedReadCatalog } from './related-read-catalog';

export type ToolCatalog = 'legacy' | 'compact';
const civicTypes = ['organization', 'person', 'election', 'contest', 'ballot_question', 'article', 'map', 'layer', 'calendar', 'event'] as const;
const uuid = z.string().uuid();
const query = z.string().max(500).default('');
const limit = z.number().int().min(1).max(100).default(20);
const offset = z.number().int().min(0).default(0);

/** Both catalogs use the caller's client and the original visibility-aware RPCs. */
export function registerCommonReadTools(server: McpServer, supabase: SupabaseClient, catalog: ToolCatalog, reads?: RelatedReadCatalog) {
  const { register, readRpc } = createToolkit(server, supabase, undefined, reads);
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async function getRecord(type: string, id: string) {
    if (['map', 'event', 'person', 'election'].includes(type)) {
      const record = await rpc('get_' + type, { p_id: id });
      if (type !== 'map' || record?.status !== 'ok') return record;
      return { ...record, layers: await rpc('get_map_layers', { p_map_id: id }) };
    }
    return rpc('mcp_get_record', { p_type: type, p_id: id });
  }
  if (catalog === 'compact') {
    register('search_site', 'Search or browse ten civic types. mode=site (default) returns ranked site rows, includes past events, and supports limit/offset. mode=directory requires organization/person/map/election/event and returns the original directory rows/order; event filters require directory event mode. Directory mode has no offset. Visibility follows your account.', {
      query: z.string().default(''), type: z.enum(civicTypes).nullish(),
      mode: z.enum(['site', 'directory']).default('site'),
      limit: z.number().int().min(1).max(100).optional(), offset,
      organization_id: uuid.nullish(), calendar_id: uuid.nullish(), include_past: z.boolean().optional(),
    }, async ({ query, type, mode, limit, offset, organization_id, calendar_id, include_past }) => {
      const eventFilters = organization_id != null || calendar_id != null || include_past !== undefined;
      if (mode === 'site') {
        if (query.length > 500) throw new Error('Site query must be at most 500 characters');
        if (eventFilters) throw new Error('Event filters require mode=directory and type=event');
        return rpc('search_site', { p_query: query, p_type: type ?? null, p_limit: limit ?? 20, p_offset: offset });
      }
      if (!type || !['organization', 'person', 'map', 'election', 'event'].includes(type)) throw new Error('Directory mode requires type=organization, person, map, election or event; use site mode for other types');
      if (offset !== 0) throw new Error('Directory mode does not support offset; use site mode for pagination');
      if (type !== 'event' && eventFilters) throw new Error('Event filters require type=event');
      const max = type === 'person' || type === 'organization' ? 50 : 100;
      if (limit !== undefined && limit > max) throw new Error('Directory limit for ' + type + ' must be at most ' + max);
      const pageLimit = limit ?? (type === 'event' || type === 'election' ? 50 : 20);
      const names = { organization: 'search_organizations', person: 'search_people', map: 'search_maps', election: 'search_elections', event: 'search_events' };
      return rpc(names[type as keyof typeof names], { p_query: query, p_limit: pageLimit,
        ...(type === 'event' ? { p_organization_id: organization_id ?? null, p_calendar_id: calendar_id ?? null, p_include_past: include_past ?? false } : {}) });
    });
    register('get_civic_record', 'Get one civic record by type and UUID through its existing visibility gate. Preserves person affiliations, election contests/key dates, event calendar/organization and map layers/effective styles. Other types retain their original record envelope; article association sets remain admin-only. Related lists and geometry have separate tools.', {
      type: z.enum(civicTypes), id: uuid,
    }, ({ type, id }) => getRecord(type, id));
  } else {
    readRpc(
      "search_organizations",
      "Full-text search of community organizations.",
      { query: z.string().default(""), limit: z.number().int().min(1).max(50).default(20) },
      "search_organizations",
      ({ query, limit }) => ({ p_query: query, p_limit: limit }),
    );
    readRpc(
      "search_maps",
      "Full-text search of maps.",
      { query: z.string().default(""), limit: z.number().int().min(1).max(100).default(20) },
      "search_maps",
      ({ query, limit }) => ({ p_query: query, p_limit: limit }),
    );
    readRpc(
      "search_events",
      "Search calendar events. Regular users see public listings; only admins can discover unlisted and private events.",
      {
        query: z.string().default(""),
        organization_id: z.string().uuid().nullish(),
        calendar_id: z.string().uuid().nullish(),
        include_past: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      },
      "search_events",
      ({ query, organization_id, calendar_id, include_past, limit }) => ({
        p_query: query,
        p_organization_id: organization_id ?? null,
        p_calendar_id: calendar_id ?? null,
        p_include_past: include_past,
        p_limit: limit,
      }),
    );
    readRpc(
      "search_people",
      "Full-text search of people (officials, candidates).",
      { query: z.string().default(""), limit: z.number().int().min(1).max(50).default(20) },
      "search_people",
      ({ query, limit }) => ({ p_query: query, p_limit: limit }),
    );
    readRpc(
      "search_elections",
      "Full-text search of elections.",
      { query: z.string().default(""), limit: z.number().int().min(1).max(100).default(50) },
      "search_elections",
      ({ query, limit }) => ({ p_query: query, p_limit: limit }),
    );
    register("get_map", "Fetch one map with visible layers and their effective styles.", { id: z.string().uuid() }, ({ id }) => getRecord("map", id));
    register("get_event", "Fetch one event (with calendar + organization) by id.", { id: uuid }, ({ id }) => getRecord("event", id));
    register("get_person", "Fetch one person (with affiliations) by id.", { id: uuid }, ({ id }) => getRecord("person", id));
    register("get_election", "Fetch one election (with contests and key dates) by id.", { id: uuid }, ({ id }) => getRecord("election", id));

    // Search all ten content types, with stable pagination and relationship matches.
    readRpc('search_site', 'Search or browse all civic content, including related names, roles and stored-layer properties. Visibility follows your account.',
      { query, type: z.enum(['organization', 'person', 'election', 'contest', 'ballot_question', 'article', 'map', 'layer', 'calendar', 'event']).nullish(), limit, offset },
      'search_site', input => ({ p_query: input.query, p_type: input.type ?? null, p_limit: input.limit, p_offset: input.offset }));
    for (const [plural, type] of [['calendars', 'calendar'], ['layers', 'layer'], ['articles', 'article'], ['contests', 'contest'], ['ballot_questions', 'ballot_question']]) {
      readRpc(`search_${plural}`, `Search or browse ${plural.replaceAll('_', ' ')} with pagination. Use the returned id with get_${type}.`,
        { query, limit, offset }, 'search_site', input => ({ p_query: input.query, p_type: type, p_limit: input.limit, p_offset: input.offset }));
    }
    for (const type of ['organization', 'calendar', 'layer', 'article', 'contest', 'ballot_question']) {
      register(`get_${type}`, `Get one ${type.replaceAll('_', ' ')} by id. Article association sets are returned only to admins.`,
        { id: uuid }, ({ id }) => getRecord(type, id));
    }
  }
  readRpc(
    "list_calendars",
    "List calendars the caller can see, optionally for one organization.",
    { organization_id: z.string().uuid().nullish() },
    "list_calendars",
    ({ organization_id }) => ({ p_organization_id: organization_id ?? null }),
  );

}
