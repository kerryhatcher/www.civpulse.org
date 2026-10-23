#!/usr/bin/env bun
// Integration test against the running LOCAL Supabase stack. Never uses hosted credentials.
import assert from 'node:assert/strict';
import { runCrudSuite } from './test-mcp-crud.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const status = Bun.spawnSync(['bun', 'run', 'supabase', 'status', '--output', 'json'], { cwd: root });
assert.equal(status.exitCode, 0, 'Start local Supabase first: bun run db:start');
const env = JSON.parse(status.stdout.toString());
assert.equal(new URL(env.API_URL).hostname, '127.0.0.1', 'Tests must only use local Supabase');
const auth = `${env.API_URL}/auth/v1`;
const mcp = 'http://localhost:8789/mcp';
const directory = await mkdtemp(join(tmpdir(), 'civpulse-mcp-auth-'));
const users = [];
const clients = [];
const people = [];
const organizations = [];
let worker;

async function request(url, { token, method = 'GET', body, ...options } = {}) {
  const response = await fetch(url, {
    method, headers: { apikey: env.ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), ...options,
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : null };
}

async function rpc(token, method, params = {}) {
  const response = await fetch(mcp, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  const json = text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data:'))?.slice(5) : text;
  return { response, data: json ? JSON.parse(json) : null };
}

async function tool(token, name, args = {}) {
  const result = await rpc(token, 'tools/call', { name, arguments: args });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.result, JSON.stringify(result.data));
  return result.data.result;
}

async function makeUser(admin) {
  const email = `mcp-auth-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();
  const created = await request(`${auth}/admin/users`, {
    token: env.SERVICE_ROLE_KEY, method: 'POST', body: { email, password, email_confirm: true },
  });
  assert.ok(created.response.ok, JSON.stringify(created.data));
  users.push(created.data.id);
  if (admin) {
    const grant = await request(`${env.API_URL}/rest/v1/admins`, {
      token: env.SERVICE_ROLE_KEY, method: 'POST', body: { user_id: created.data.id },
    });
    assert.ok(grant.response.ok, JSON.stringify(grant.data));
  }
  const signedIn = await request(`${auth}/token?grant_type=password`, { method: 'POST', body: { email, password, gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' } } });
  assert.ok(signedIn.response.ok, JSON.stringify(signedIn.data));
  return signedIn.data;
}

async function authorization(discovery, clientId) {
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const state = crypto.randomUUID();
  const url = new URL(discovery.authorization_endpoint);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: 'http://localhost:8790/callback',
    scope: 'email profile', state, code_challenge: challenge, code_challenge_method: 'S256', resource: mcp }).toString();
  const response = await fetch(url, { redirect: 'manual' });
  const location = response.headers.get('location');
  assert.ok(location, `Expected consent redirect, got ${response.status}: ${await response.text()}`);
  const id = new URL(location).searchParams.get('authorization_id');
  assert.ok(id, 'Consent redirect must include authorization_id');
  return { id, verifier, state };
}

async function consent(user, pending, action) {
  const details = await request(`${auth}/oauth/authorizations/${pending.id}`, { token: user.access_token });
  assert.ok(details.response.ok, JSON.stringify(details.data));
  const decision = await request(`${auth}/oauth/authorizations/${pending.id}/consent`, {
    token: user.access_token, method: 'POST', body: { action },
  });
  assert.ok(decision.response.ok, JSON.stringify(decision.data));
  const redirect = new URL(decision.data.redirect_url);
  assert.equal(redirect.searchParams.get('state'), pending.state);
  return redirect;
}

async function tokenRequest(discovery, values) {
  const response = await fetch(discovery.token_endpoint, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  return { response, data: await response.json() };
}

try {
  const discoveryResult = await request(`${auth}/.well-known/oauth-authorization-server`);
  assert.ok(discoveryResult.response.ok, 'Enable local auth.oauth_server first');
  const discovery = discoveryResult.data;
  await Bun.write(join(directory, 'wrangler.json'), JSON.stringify({
    name: 'civpulse-mcp-auth-test', main: join(root, 'apps/mcp/src/index.ts'), compatibility_date: '2026-10-01',
    compatibility_flags: ['nodejs_compat'], vars: {
      SUPABASE_URL: env.API_URL, SUPABASE_ANON_KEY: env.ANON_KEY, MCP_RESOURCE_URL: mcp, AUTHORIZATION_SERVER: auth,
    },
  }));
  worker = Bun.spawn(['bun', 'run', '--cwd', 'apps/mcp', 'wrangler', 'dev', '--config', join(directory, 'wrangler.json'),
    '--port', '8789', '--inspector-port', '9239'], { cwd: root, stdout: 'ignore', stderr: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(mcp); ready = true; break; } catch { await Bun.sleep(200); }
  }
  assert.ok(ready, 'Local test Worker failed to start');
  for (const token of [null, 'not-a-token', 'e2JhZA.e30.abc', env.ANON_KEY, env.SERVICE_ROLE_KEY]) {
    const result = await rpc(token, 'initialize', {});
    assert.equal(result.response.status, 401, 'Missing, malformed, anon and service-role tokens must be rejected');
    assert.match(result.response.headers.get('www-authenticate'), /resource_metadata=/);
  }
  console.log('PASS missing/malformed/anon/service-role rejection and OAuth challenge');

  const admin = await makeUser(true);
  const reader = await makeUser(false);
  const needle = `McpAuth${crypto.randomUUID().replaceAll('-', '')}`;
  for (const visibility of ['public', 'unlisted', 'private']) {
    const created = await tool(admin.access_token, 'create_person', {
      slug: `mcp-auth-${crypto.randomUUID()}`, full_name: `${needle} ${visibility}`, visibility,
    });
    assert.ok(!created.isError, JSON.stringify(created));
    people.push(JSON.parse(created.content[0].text).id);
  }
  const anonymousSearch = await request(`${env.API_URL}/rest/v1/rpc/search_people`, {
    method: 'POST', body: { p_query: needle, p_limit: 50 },
  });
  assert.ok(anonymousSearch.response.ok, JSON.stringify(anonymousSearch.data));
  assert.equal(anonymousSearch.data.length, 1, 'Anonymous database search must only expose the public fixture');
  const tampered = admin.access_token.split('.');
  tampered[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(tampered[1], 'base64url').toString()), sub: reader.user.id })).toString('base64url');
  assert.equal((await rpc(tampered.join('.'), 'tools/list')).response.status, 401);
  console.log('PASS forged signature rejection');
  const signingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const originalClaims = JSON.parse(Buffer.from(admin.access_token.split('.')[1], 'base64url').toString());
  for (const claims of [{ ...originalClaims, exp: Math.floor(Date.now() / 1000) - 60 },
    { ...originalClaims, aud: 'another-resource' }, { ...originalClaims, iss: 'https://another-project.example/auth/v1' }]) {
    const message = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(message))).toString('base64url');
    assert.equal((await rpc(`${message}.${signature}`, 'tools/list')).response.status, 401);
  }
  console.log('PASS expired token, incorrect audience and incorrect issuer rejection');

  const registered = await request(discovery.registration_endpoint, { method: 'POST', body: {
    client_name: 'Civic Pulse local auth integration test', redirect_uris: ['http://localhost:8790/callback'],
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
  } });
  assert.ok(registered.response.ok, JSON.stringify(registered.data));
  const clientId = registered.data.client_id;
  clients.push(clientId);
  const denied = await consent(reader, await authorization(discovery, clientId), 'deny');
  assert.equal(denied.searchParams.get('error'), 'access_denied');
  console.log('PASS discovery, dynamic registration and denied authorization');

  const sessions = [];
  for (const [user, isAdmin] of [[reader, false], [admin, true]]) {
    const pending = await authorization(discovery, clientId);
    const redirect = await consent(user, pending, 'approve');
    const exchange = { grant_type: 'authorization_code', client_id: clientId, code: redirect.searchParams.get('code'),
      redirect_uri: 'http://localhost:8790/callback', code_verifier: pending.verifier };
    const badPkce = await tokenRequest(discovery, { ...exchange, code_verifier: 'incorrect-verifier'.repeat(4) });
    assert.ok(!badPkce.response.ok, 'Incorrect PKCE must fail');
    // Some providers consume the code on failed PKCE. Start a fresh request in that case.
    let tokens = await tokenRequest(discovery, exchange);
    if (!tokens.response.ok) {
      const fresh = await authorization(discovery, clientId);
      const approved = await consent(user, fresh, 'approve');
      tokens = await tokenRequest(discovery, { ...exchange, code: approved.searchParams.get('code'), code_verifier: fresh.verifier });
    }
    assert.ok(tokens.response.ok, JSON.stringify(tokens.data));
    const identity = JSON.parse((await tool(tokens.data.access_token, 'whoami')).content[0].text);
    assert.equal(identity.user_id, user.user.id);
    assert.equal(identity.is_admin, isAdmin);
    assert.equal(identity.role, isAdmin ? 'admin' : 'user');
    assert.ok(!(await tool(tokens.data.access_token, 'search_organizations')).isError);
    const visible = JSON.parse((await tool(tokens.data.access_token, 'search_people', { query: needle })).content[0].text);
    assert.equal(visible.length, isAdmin ? 3 : 1, 'Only admin OAuth search includes unlisted and private fixtures');
    for (const id of people) {
      const record = JSON.parse((await tool(tokens.data.access_token, 'get_person', { id })).content[0].text);
      assert.equal(record.status, !isAdmin && id === people[2] ? 'private' : 'ok');
    }
    const slug = `mcp-auth-${crypto.randomUUID()}`;
    const created = await tool(tokens.data.access_token, 'create_organization', { slug, name: 'Disposable local MCP auth test' });
    assert.equal(Boolean(created.isError), !isAdmin);
    if (isAdmin) {
      const record = JSON.parse(created.content[0].text);
      organizations.push(record.id);
      assert.ok(!(await tool(tokens.data.access_token, 'delete_organization', { id: record.id })).isError);
    }
    const refreshed = await tokenRequest(discovery, { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.data.refresh_token });
    assert.ok(refreshed.response.ok, JSON.stringify(refreshed.data));
    const grants = await request(`${auth}/user/oauth/grants`, { token: user.access_token });
    assert.ok(grants.data.some(grant => grant.client.id === clientId));
    sessions.push({ user, isAdmin, refreshed });
    console.log(`PASS ${isAdmin ? 'admin' : 'reader'} PKCE, identity, reads, write permissions and refresh`);
  }
  const catalog = await rpc(admin.access_token, 'tools/list');
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.data.result.tools.length < 128, 'Keep the MCP tool catalog within client limits');
  if (process.env.MCP_TOOL_CATALOG) {
    await Bun.write(process.env.MCP_TOOL_CATALOG, JSON.stringify({ server: 'Civic Pulse', tools: catalog.data.result.tools }, null, 2));
  }
  await runCrudSuite({ adminToken: sessions[1].refreshed.data.access_token, readerToken: sessions[0].refreshed.data.access_token, tool, apiUrl: env.API_URL });

  // Use the existing disposable reader only after all non-admin CRUD checks.
  const adminToken = sessions[1].refreshed.data.access_token;
  const readerToken = sessions[0].refreshed.data.access_token;
  assert.ok((await tool(readerToken, 'search_users')).isError, 'Regular users cannot list accounts');
  assert.ok((await tool(readerToken, 'search_users', { query: reader.user.email })).isError, 'Even an own-email search requires admin access');
  assert.ok((await tool(readerToken, 'promote_user_to_admin', { user_id: reader.user.id })).isError, 'Regular users cannot promote themselves');
  assert.ok((await tool(readerToken, 'promote_user_to_admin', { user_id: admin.user.id })).isError, 'Regular users cannot change another account');
  const search = await tool(adminToken, 'search_users', { query: reader.user.email });
  assert.ok(!search.isError);
  const accounts = JSON.parse(search.content[0].text);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].id, reader.user.id);
  assert.equal(accounts[0].role, 'user');
  assert.deepEqual(Object.keys(accounts[0]).sort(), ['created_at', 'display_name', 'email', 'id', 'role']);
  const profile = JSON.parse((await tool(readerToken, 'get_my_profile')).content[0].text);
  const searchName = `Account Search QA ${crypto.randomUUID()}`;
  assert.ok(!(await tool(readerToken, 'update_my_profile', { display_name: searchName })).isError);
  const byName = JSON.parse((await tool(adminToken, 'search_users', { query: searchName })).content[0].text);
  assert.ok(byName.some(account => account.id === reader.user.id), 'Display-name search resolves registered accounts');
  assert.ok(!(await tool(readerToken, 'update_my_profile', { display_name: profile.display_name })).isError);
  const page = JSON.parse((await tool(adminToken, 'search_users', { query: 'mcp-auth-' })).content[0].text);
  const nextPage = JSON.parse((await tool(adminToken, 'search_users', { query: 'mcp-auth-', offset: 1 })).content[0].text);
  assert.equal(nextPage[0].id, page[1].id, 'Account pagination forwards the requested offset');
  assert.deepEqual(JSON.parse((await tool(adminToken, 'search_users', { query: "%'_no_such_account" })).content[0].text), [], 'Account search treats punctuation literally');
  assert.ok((await tool(adminToken, 'promote_user_to_admin', { user_id: admin.user.id })).isError, 'Admin cannot target themselves');
  assert.ok((await tool(adminToken, 'promote_user_to_admin', { user_id: crypto.randomUUID() })).isError, 'Missing account is rejected');
  for (let attempt = 0; attempt < 2; attempt++) {
    const promoted = await tool(adminToken, 'promote_user_to_admin', { user_id: reader.user.id });
    assert.ok(!promoted.isError, 'Promotion is idempotent for another existing account');
    assert.deepEqual(JSON.parse(promoted.content[0].text), { user_id: reader.user.id, role: 'admin' });
  }
  const promotedIdentity = JSON.parse((await tool(readerToken, 'whoami')).content[0].text);
  assert.equal(promotedIdentity.role, 'admin');
  assert.equal(promotedIdentity.is_admin, true, 'Promotion is visible through the existing OAuth token');
  const verified = JSON.parse((await tool(adminToken, 'search_users', { query: reader.user.email })).content[0].text);
  assert.equal(verified[0].role, 'admin');
  assert.ok(!(await tool(readerToken, 'search_users', { query: reader.user.email })).isError, 'Promoted user immediately gains admin tools');
  const promotedSlug = `mcp-promoted-${crypto.randomUUID()}`;
  const promotedCreate = await tool(readerToken, 'create_organization', { slug: promotedSlug, name: 'Disposable promoted-user test' });
  assert.ok(!promotedCreate.isError, 'Promoted user immediately gains content writes');
  const promotedOrganization = JSON.parse(promotedCreate.content[0].text);
  organizations.push(promotedOrganization.id);
  assert.ok(!(await tool(readerToken, 'delete_organization', { id: promotedOrganization.id })).isError);
  console.log('PASS admin-only account search, pagination, guarded promotion and immediate OAuth role changes');
  for (const { user, isAdmin, refreshed } of sessions) {
    const revoke = await request(`${auth}/user/oauth/grants?client_id=${clientId}`, { token: user.access_token, method: 'DELETE' });
    assert.ok(revoke.response.ok);
    assert.equal((await rpc(refreshed.data.access_token, 'tools/list')).response.status, 401, 'Revocation must stop existing access tokens');
    const revokedRefresh = await tokenRequest(discovery, { grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshed.data.refresh_token });
    assert.ok(!revokedRefresh.response.ok, 'Revoked refresh token must fail');
    console.log(`PASS ${isAdmin ? 'admin' : 'reader'} grant and token revocation`);
  }
} finally {
  worker?.kill();
  if (worker) await worker.exited;
  for (const id of organizations) await request(`${env.API_URL}/rest/v1/organizations?id=eq.${id}`, { token: env.SERVICE_ROLE_KEY, method: 'DELETE' });
  for (const id of people) await request(`${env.API_URL}/rest/v1/people?id=eq.${id}`, { token: env.SERVICE_ROLE_KEY, method: 'DELETE' });
  for (const id of clients) await request(`${auth}/admin/oauth/clients/${id}`, { token: env.SERVICE_ROLE_KEY, method: 'DELETE' });
  for (const id of users) await request(`${auth}/admin/users/${id}`, { token: env.SERVICE_ROLE_KEY, method: 'DELETE' });
  await rm(directory, { recursive: true, force: true });
}
