import { createMcpHandler } from "@modelcontextprotocol/server";
import { createClient, type User } from "@supabase/supabase-js";
import { buildServer } from "./tools";

export interface Env {
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

function allowedOrigin(origin: string | null): string | null {
  switch (origin) {
    case "https://www.civpulse.org": return "https://www.civpulse.org";
    case "https://new.civpulse.org": return "https://new.civpulse.org";
    case "https://civpulse.org": return "https://civpulse.org";
    case "https://api.civpulse.org": return "https://api.civpulse.org";
    case "http://localhost:8789": return "http://localhost:8789";
    case "http://127.0.0.1:8789": return "http://127.0.0.1:8789";
    default: return null;
  }
}

async function respond(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const endpoint = new URL(env.MCP_RESOURCE_URL);
  const path = url.pathname.replace(/^\/functions\/v1(?=\/)/, "");
  const endpointPath = endpoint.pathname.replace(/^\/functions\/v1(?=\/)/, "");
  const metadataUrl = `${env.MCP_RESOURCE_URL}/.well-known/oauth-protected-resource`;
  if (![endpoint.hostname, new URL(env.SUPABASE_URL).hostname, "localhost", "127.0.0.1"].includes(url.hostname)) {
    return new Response("Forbidden host", { status: 403 });
  }
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(origin)) {
    return new Response("Forbidden origin", { status: 403 });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": allowedOrigin(origin) ?? "https://www.civpulse.org",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
    "Access-Control-Expose-Headers": "WWW-Authenticate", "Vary": "Origin",
  } });

  if (
    path === "/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource/mcp" ||
    path === `${endpointPath}/.well-known/oauth-protected-resource`
  ) {
    return Response.json(protectedResourceMetadata(env));
  }

  if (path === "/") {
    return Response.json({
      name: "Civic Pulse MCP",
      mcp_endpoint: env.MCP_RESOURCE_URL,
      authorization_server: env.AUTHORIZATION_SERVER,
      protected_resource_metadata: metadataUrl,
    });
  }

  if (path === endpointPath || path === `${endpointPath}/`) {
    const authorization = request.headers.get("Authorization") ?? "";
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
    const unauthorized = (invalid = false) => Response.json(
      { error: invalid ? "invalid_token" : "unauthorized", error_description: "A valid Supabase user access token is required." },
      { status: 401, headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"${invalid ? ', error="invalid_token"' : ""}`,
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
      if (result.error || !result.data.user || result.data.user.is_anonymous) return unauthorized(true);
      const { data, error } = await supabase.auth.getClaims(token);
      if (error && (!error.status || error.status >= 500)) throw error;
      const claims = data?.claims;
      const audience = claims?.aud;
      if (error || !claims || claims.iss !== env.AUTHORIZATION_SERVER ||
        !(audience === "authenticated" || (Array.isArray(audience) && audience.includes("authenticated"))) ||
        claims.role !== "authenticated" || claims.is_anonymous === true || !claims.sub || !claims.exp || claims.exp <= Date.now() / 1000) {
        return unauthorized(true);
      }
      if (result.data.user.id !== claims.sub) return unauthorized(true);
      user = result.data.user;
    } catch {
      return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } });
    }

    const handler = createMcpHandler(() => buildServer(supabase, user));
    return handler.fetch(request);
  }

  return new Response("Not found", { status: 404 });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const response = await respond(request, env);
  const origin = allowedOrigin(request.headers.get('Origin'));
  if (origin && response.status !== 403) {
    const headers = new Headers(response.headers);
    // Keep response values literal as well as checking the request allowlist.
    switch (origin) {
      case "https://www.civpulse.org": headers.set('Access-Control-Allow-Origin', "https://www.civpulse.org"); break;
      case "https://new.civpulse.org": headers.set('Access-Control-Allow-Origin', "https://new.civpulse.org"); break;
      case "https://civpulse.org": headers.set('Access-Control-Allow-Origin', "https://civpulse.org"); break;
      case "https://api.civpulse.org": headers.set('Access-Control-Allow-Origin', "https://api.civpulse.org"); break;
      case "http://localhost:8789": headers.set('Access-Control-Allow-Origin', "http://localhost:8789"); break;
      case "http://127.0.0.1:8789": headers.set('Access-Control-Allow-Origin', "http://127.0.0.1:8789"); break;
    }
    headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
    headers.set('Vary', 'Origin');
    return new Response(response.body, { status: response.status, headers });
  }
  return response;
}
