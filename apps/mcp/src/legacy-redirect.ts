// Compatibility URL only. Tool execution is hosted by Supabase Edge Functions.
const endpoint = 'https://api.civpulse.org/functions/v1/mcp';
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
      return Response.redirect(`${endpoint}/.well-known/oauth-protected-resource`, 308);
    }
    if (url.pathname === '/' || url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return Response.redirect(endpoint, 308);
    }
    return new Response('Not found', { status: 404 });
  },
};
