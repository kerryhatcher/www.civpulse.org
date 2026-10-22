import { createMcpHandler } from "agents/mcp";
import { createClient, type User } from "@supabase/supabase-js";
import { buildServer } from "./tools";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MCP_RESOURCE_URL: string;
  AUTHORIZATION_SERVER: string;
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
