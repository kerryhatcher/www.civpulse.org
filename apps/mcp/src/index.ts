import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MCP_RESOURCE_URL: string;
  AUTHORIZATION_SERVER: string;
}

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

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }] };
}

function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Drop undefined keys so partial updates don't null out columns. */
function defined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function buildServer(supabase: SupabaseClient, user: Pick<User, "id" | "email">): McpServer {
  const server = new McpServer({ name: "Civic Pulse", version: "1.0.0" });

  const readRpc = (
    name: string,
    description: string,
    shape: z.ZodRawShape,
    rpc: string,
    toArgs: (input: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    server.registerTool(name, { description, inputSchema: z.object(shape) }, async (input) => {
      try {
        const { data, error } = await supabase.rpc(rpc, toArgs(input as Record<string, unknown>));
        if (error) throw new Error(error.message);
        return ok(data);
      } catch (error) {
        return fail(error);
      }
    });
  };

  const getRpc = (name: string, description: string, rpc: string) => {
    server.registerTool(
      name,
      { description, inputSchema: z.object({ id: z.string().uuid() }) },
      async ({ id }) => {
        try {
          const { data, error } = await supabase.rpc(rpc, { p_id: id });
          if (error) throw new Error(error.message);
          return ok(data);
        } catch (error) {
          return fail(error);
        }
      },
    );
  };

  const create = (resource: string, table: string, description: string, shape: z.ZodRawShape, columns: string) => {
    server.registerTool(
      `create_${resource}`,
      { description, inputSchema: z.object(shape) },
      async (input) => {
        try {
          const { data, error } = await supabase
            .from(table)
            .insert(defined(input as Record<string, unknown>))
            .select(columns)
            .single();
          if (error) throw new Error(error.message);
          return ok(data);
        } catch (error) {
          return fail(error);
        }
      },
    );
  };

  const update = (resource: string, table: string, description: string, shape: z.ZodRawShape, columns: string) => {
    server.registerTool(
      `update_${resource}`,
      { description, inputSchema: z.object({ id: z.string().uuid(), ...shape }) },
      async ({ id, ...rest }) => {
        try {
          const { data, error } = await supabase
            .from(table)
            .update(defined(rest as Record<string, unknown>))
            .eq("id", id)
            .select(columns)
            .single();
          if (error) throw new Error(error.message);
          return ok(data);
        } catch (error) {
          return fail(error);
        }
      },
    );
  };

  const remove = (resource: string, table: string, description: string) => {
    server.registerTool(
      `delete_${resource}`,
      { description, inputSchema: z.object({ id: z.string().uuid() }) },
      async ({ id }) => {
        try {
          const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
          if (error) throw new Error(error.message);
          return ok({ deleted: data?.length ?? 0, id });
        } catch (error) {
          return fail(error);
        }
      },
    );
  };

  // --- Identity ----------------------------------------------------------

  server.registerTool(
    "whoami",
    { description: "Return the authenticated user's id, email, and admin status.", inputSchema: z.object({}) },
    async () => {
      try {
        const { data: isAdmin, error } = await supabase.rpc("is_admin");
        if (error) throw new Error(error.message);
        return ok({ user_id: user.id, email: user.email ?? null, is_admin: Boolean(isAdmin) });
      } catch (error) {
        return fail(error);
      }
    },
  );

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
    "Search calendar events. Anonymous sees public; signed-in sees unlisted/private too.",
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

  getRpc("get_map", "Fetch one map (with visible layers) by id.", "get_map");
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

  return server;
}

function protectedResourceMetadata(env: Env) {
  return {
    resource: env.MCP_RESOURCE_URL,
    authorization_servers: [env.AUTHORIZATION_SERVER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile", "offline_access"],
    resource_name: "Civic Pulse",
    resource_documentation: "https://www.civpulse.org",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      return Response.json(protectedResourceMetadata(env));
    }

    if (url.pathname === "/") {
      return Response.json({
        name: "Civic Pulse MCP",
        mcp_endpoint: env.MCP_RESOURCE_URL,
        authorization_server: env.AUTHORIZATION_SERVER,
        protected_resource_metadata: `${url.origin}/.well-known/oauth-protected-resource`,
      });
    }

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const authorization = request.headers.get("Authorization") ?? "";
      const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
      const unauthorized = (invalid = false) => Response.json(
        { error: invalid ? "invalid_token" : "unauthorized", error_description: "A valid Supabase user access token is required." },
        { status: 401, headers: {
          "Cache-Control": "no-store",
          "WWW-Authenticate": `Bearer resource_metadata="${env.MCP_RESOURCE_URL.replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource"${invalid ? ', error="invalid_token"' : ""}`,
        } },
      );
      if (!token) {
        return unauthorized(Boolean(authorization));
      }

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      // getClaims verifies signature/expiry; getUser also checks the live session,
      // so revoking an OAuth grant stops existing access tokens at this endpoint.
      let user: User;
      try {
        const result = await supabase.auth.getUser(token);
        if (result.error && (!result.error.status || result.error.status >= 500)) throw result.error;
        if (result.error || !result.data.user) return unauthorized(true);
        const { data, error } = await supabase.auth.getClaims(token);
        if (error && (!error.status || error.status >= 500)) throw error;
        const claims = data?.claims;
        const audience = claims?.aud;
        if (error || !claims || claims.iss !== env.AUTHORIZATION_SERVER ||
          !(audience === "authenticated" || (Array.isArray(audience) && audience.includes("authenticated"))) ||
          claims.role !== "authenticated" || !claims.sub || !claims.exp || claims.exp <= Date.now() / 1000) {
          return unauthorized(true);
        }
        if (result.data.user.id !== claims.sub) return unauthorized(true);
        user = result.data.user;
      } catch {
        return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } });
      }

      const handler = createMcpHandler(() => buildServer(supabase, user), {
        route: "/mcp",
        allowedHostnames: ["mcp.civpulse.org", "localhost"],
        allowedOriginHostnames: ["new.civpulse.org", "www.civpulse.org", "civpulse.org"],
      });

      return handler(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
