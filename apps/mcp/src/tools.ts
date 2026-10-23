import { createToolkit, ok, fail } from "./toolkit";
import { registerExtendedTools } from "./extended-tools";
import { McpServer } from "@modelcontextprotocol/server";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

const VISIBILITY = z.enum(["public", "unlisted", "private"]);
const ELECTION_KIND = z.enum([
  "special",
  "special_runoff",
  "primary",
  "primary_runoff",
  "general",
  "general_runoff",
  "other",
]);
const ELECTION_DATE_KIND = z.enum([
  "election_day",
  "early_voting",
  "registration_deadline",
  "absentee_request_deadline",
  "absentee_return_deadline",
  "other",
]);
const PERSON_KIND = z.enum(["elected_official", "appointed_official", "candidate", "other"]);

export function buildServer(supabase: SupabaseClient, user: Pick<User, "id" | "email">): McpServer {
  const server = new McpServer({ name: "Civic Pulse", version: "1.2.0" });

  const { register, readRpc, getRpc, create, update, remove, ensureAdmin } = createToolkit(server, supabase);

  // --- Identity ----------------------------------------------------------

  server.registerTool(
    "whoami",
    { description: "Return the authenticated user's id, email, role (user or admin), and admin status.", inputSchema: z.object({}), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async () => {
      try {
        const { data: isAdmin, error } = await supabase.rpc("is_admin");
        if (error) throw new Error(error.message);
        return ok({ user_id: user.id, email: user.email ?? null, is_admin: Boolean(isAdmin), role: isAdmin ? "admin" : "user" });
      } catch (error) {
        return fail(error);
      }
    },
  );

  // Account-directory reads contain personal information and require an admin.
  register("search_users", "Search registered accounts by email or display name (admin only). Returns up to 50 accounts with id, email, display_name, role and created_at. Empty query lists accounts; use offset increments of 50 to paginate. Civic people records are separate from login accounts.", {
    query: z.string().trim().max(200).default(""),
    offset: z.number().int().min(0).default(0),
  }, async ({ query, offset }) => {
    await ensureAdmin();
    const { data, error } = await supabase.rpc("admin_list_users", { p_query: query, p_offset: offset });
    if (error) throw new Error(error.message);
    return data;
  });

  register("promote_user_to_admin", "Promote an existing registered user to admin (admin only). Grants content editing, private-content access and permission to promote other users immediately. Resolve the exact account with search_users and act only on an explicit request to promote that person. Cannot promote yourself, create an account or demote an admin. Repeating a promotion of another existing admin is harmless.", {
    user_id: z.string().uuid(),
  }, async ({ user_id }) => {
    const { error } = await supabase.rpc("promote_user_to_admin", { p_user_id: user_id });
    if (error) throw new Error(error.message);
    return { user_id, role: "admin" };
  }, { write: true, destructive: true, idempotent: true });

  // --- Read: search + get ------------------------------------------------

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
  readRpc(
    "list_calendars",
    "List calendars the caller can see, optionally for one organization.",
    { organization_id: z.string().uuid().nullish() },
    "list_calendars",
    ({ organization_id }) => ({ p_organization_id: organization_id ?? null }),
  );

  register("get_map", "Fetch one map with visible layers and their effective styles.", { id: z.string().uuid() }, async ({ id }) => {
    const result = await supabase.rpc("get_map", { p_id: id });
    if (result.error) throw new Error(result.error.message);
    if (result.data?.status !== "ok") return result.data;
    const layers = await supabase.rpc("get_map_layers", { p_map_id: id });
    if (layers.error) throw new Error(layers.error.message);
    return { ...result.data, layers: layers.data };
  });
  getRpc("get_event", "Fetch one event (with calendar + organization) by id.", "get_event");
  getRpc("get_person", "Fetch one person (with affiliations) by id.", "get_person");
  getRpc("get_election", "Fetch one election (with contests and key dates) by id.", "get_election");

  // --- Write: organizations ---------------------------------------------

  const orgShape = {
    slug: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    address_line: z.string().nullish(),
    website_url: z.string().nullish(),
    social_url: z.string().nullish(),
    logo_path: z.string().nullish(),
    sos_control_number: z.string().nullish(),
    sos_business_type: z.string().nullish(),
    sos_status: z.string().nullish(),
    sos_formation_date: z.iso.date().nullish(),
    sos_last_annual_registration: z.string().nullish(),
    sos_principal_office: z.string().nullish(),
    sos_registered_agent: z.string().nullish(),
    sos_county: z.string().nullish(),
    sos_naics_code: z.string().nullish(),
    sos_officers: z.string().nullish(),
    sos_record_url: z.string().regex(/^https:\/\/ecorp\.sos\.ga\.gov\/[^\s]+$/).nullish(),
  };
  create("organization", "organizations", "Create an organization (admin only).", orgShape, "id, slug, name");
  update("organization", "organizations", "Update an organization (admin only).", orgShape, "id, slug, name");
  remove("organization", "organizations", "Delete an organization (admin only).");

  // --- Write: calendars --------------------------------------------------

  const calendarShape = {
    organization_id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    visibility: VISIBILITY.optional(),
  };
  create("calendar", "calendars", "Create a calendar (admin only).", calendarShape, "id, slug, name");
  update(
    "calendar",
    "calendars",
    "Update a calendar (admin only).",
    { ...calendarShape, organization_id: calendarShape.organization_id.optional() },
    "id, slug, name",
  );
  remove("calendar", "calendars", "Delete a calendar (admin only).");

  // --- Write: events -----------------------------------------------------

  const eventShape = {
    calendar_id: z.string().uuid(),
    title: z.string(),
    starts_at: z.string().describe("ISO 8601 timestamp"),
    ends_at: z.string().nullish(),
    all_day: z.boolean().optional(),
    location: z.string().nullish(),
    url: z.string().nullish(),
    description: z.string().nullish(),
    visibility: VISIBILITY.optional(),
    election_id: z.string().uuid().nullish(),
    election_date_kind: ELECTION_DATE_KIND.nullish(),
  };
  create("event", "events", "Create a calendar event (admin only).", eventShape, "id, title, starts_at");
  update(
    "event",
    "events",
    "Update a calendar event (admin only).",
    { ...eventShape, calendar_id: eventShape.calendar_id.optional(), title: eventShape.title.optional(), starts_at: eventShape.starts_at.optional() },
    "id, title, starts_at",
  );
  remove("event", "events", "Delete a calendar event (admin only).");

  // --- Write: people -----------------------------------------------------

  const personShape = {
    slug: z.string(),
    full_name: z.string(),
    kind: PERSON_KIND.optional(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    fax: z.string().nullish(),
    website_url: z.string().nullish(),
    social_url: z.string().nullish(),
    address_line: z.string().nullish(),
    address_line2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    image_path: z.string().nullish(),
    visibility: VISIBILITY.optional(),
  };
  create("person", "people", "Create a person (admin only).", personShape, "id, slug, full_name");
  update(
    "person",
    "people",
    "Update a person (admin only).",
    { ...personShape, slug: personShape.slug.optional(), full_name: personShape.full_name.optional() },
    "id, slug, full_name",
  );
  remove("person", "people", "Delete a person (admin only).");

  // --- Write: elections --------------------------------------------------

  const electionShape = {
    slug: z.string(),
    name: z.string(),
    election_date: z.string().describe("YYYY-MM-DD"),
    kind: ELECTION_KIND.optional(),
    description: z.string().nullish(),
    organization_id: z.string().uuid().nullish(),
    visibility: VISIBILITY.optional(),
  };
  create("election", "elections", "Create an election (admin only).", electionShape, "id, slug, name");
  update(
    "election",
    "elections",
    "Update an election (admin only).",
    { ...electionShape, slug: electionShape.slug.optional(), name: electionShape.name.optional(), election_date: electionShape.election_date.optional() },
    "id, slug, name",
  );
  remove("election", "elections", "Delete an election (admin only).");

  registerExtendedTools(server, supabase, user);
  return server;
}
