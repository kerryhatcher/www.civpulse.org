/**
 * Sync and validate the Claude Code plugin (plugins/civpulse-claude).
 *
 * The skills and references are shared with the ChatGPT/Codex package in
 * plugins/civpulse, which stays the source of truth. A Claude Code plugin is
 * copied to a cache on install, so it must be self-contained: no symlinks and
 * no paths outside its own folder.
 *
 *   bun run plugin:claude:sync    copy shared skills/references, then validate
 *   bun run plugin:claude:check   fail if the copies drifted or anything is invalid
 */
import { cp, readFile, readdir, rm, lstat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const repo = resolve(import.meta.dir, '..');
const src = resolve(repo, 'plugins/civpulse');
const dest = resolve(repo, 'plugins/civpulse-claude');
const check = process.argv.includes('--check');
const sharedSkills = (await readdir(resolve(src, 'skills'))).sort();
const sharedReferences = await readdir(resolve(src, 'references'));

const read = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await read(path));
const frontmatter = (text, where) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${where}: missing YAML frontmatter`);
  return Bun.YAML.parse(m[1]);
};

async function sameFile(a, b) {
  try { return (await read(a)) === (await read(b)); } catch { return false; }
}

if (!check) {
  for (const name of sharedSkills) {
    const target = resolve(dest, 'skills', name);
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    // agents/openai.yaml is Codex-only metadata; Claude Code ignores it.
    await cp(resolve(src, 'skills', name, 'SKILL.md'), resolve(target, 'SKILL.md'));
  }
  await mkdir(resolve(dest, 'references'), { recursive: true });
  for (const file of sharedReferences) await cp(resolve(src, 'references', file), resolve(dest, 'references', file));
}

// Drift check: every shared file must match its source byte for byte.
for (const name of sharedSkills) {
  assert.ok(await sameFile(resolve(src, 'skills', name, 'SKILL.md'), resolve(dest, 'skills', name, 'SKILL.md')),
    `skills/${name}/SKILL.md differs from plugins/civpulse. Run: bun run plugin:claude:sync`);
}
for (const file of sharedReferences) {
  assert.ok(await sameFile(resolve(src, 'references', file), resolve(dest, 'references', file)),
    `references/${file} differs from plugins/civpulse. Run: bun run plugin:claude:sync`);
}

// Manifest, MCP config and marketplace.
const manifest = await json(resolve(dest, '.claude-plugin/plugin.json'));
const codex = await json(resolve(src, 'plugin.json'));
assert.equal(manifest.name, 'civpulse');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const mcp = await json(resolve(dest, '.mcp.json'));
const server = mcp.mcpServers?.civpulse;
assert.equal(server?.type, 'http');
assert.equal(server.url, 'https://api.civpulse.org/functions/v1/mcp/v2');
assert.equal(server.headers, undefined, 'No credentials or headers may be bundled');
const market = await json(resolve(repo, '.claude-plugin/marketplace.json'));
const entry = market.plugins.find((p) => p.name === manifest.name);
assert.ok(entry, 'marketplace.json must list the civpulse plugin');
assert.equal(entry.source, './plugins/civpulse-claude');

// Tool names agents may list come from the real compact catalog.
const tools = await json(resolve(dest, 'references/compact-tool-schemas.json'));
const toolByName = new Map(tools.map((t) => [t.name, t]));
const prefix = 'mcp__plugin_civpulse_civpulse__';

// Skills.
const skillNames = (await readdir(resolve(dest, 'skills'))).sort();
for (const name of sharedSkills) assert.ok(skillNames.includes(name), `missing shared skill ${name}`);
for (const name of skillNames) {
  const text = await read(resolve(dest, 'skills', name, 'SKILL.md'));
  const front = frontmatter(text, `skills/${name}`);
  assert.equal(front.name, name);
  assert.ok(front.description?.trim(), `skills/${name}: description required`);
  for (const [, link] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(link)) continue;
    const path = resolve(dest, 'skills', name, link);
    assert.ok(path.startsWith(dest + '/'), `skills/${name}: link escapes the plugin: ${link}`);
    assert.ok(await Bun.file(path).exists(), `skills/${name}: broken link ${link}`);
  }
}

// Agents: valid frontmatter, MCP tools exist, and read-only agents stay read-only.
const readOnlyAgents = new Set(['civic-researcher']);
const agentFiles = (await readdir(resolve(dest, 'agents'))).sort();
for (const file of agentFiles) {
  const name = file.replace(/\.md$/, '');
  const front = frontmatter(await read(resolve(dest, 'agents', file)), `agents/${file}`);
  assert.equal(front.name, name);
  assert.ok(front.description?.trim());
  const list = String(front.tools ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(list.length, `agents/${file}: declare an explicit tools list`);
  for (const tool of list.filter((t) => t.startsWith(prefix))) {
    const def = toolByName.get(tool.slice(prefix.length));
    assert.ok(def, `agents/${file}: unknown MCP tool ${tool}`);
    if (readOnlyAgents.has(name)) assert.ok(def.annotations.readOnlyHint, `agents/${file}: ${tool} is not read-only`);
  }
  if (readOnlyAgents.has(name)) {
    assert.ok(!list.some((t) => ['Write', 'Edit', 'Bash'].includes(t)), `agents/${file}: read-only agent has write tools`);
  }
}

// Commands.
for (const file of await readdir(resolve(dest, 'commands'))) {
  const front = frontmatter(await read(resolve(dest, 'commands', file)), `commands/${file}`);
  assert.ok(front.description?.trim());
}

// No symlinks or credential-looking files anywhere in the package.
async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const path = resolve(dir, entry);
    const stat = await lstat(path);
    assert.ok(!stat.isSymbolicLink(), `symlink not allowed: ${path}`);
    assert.ok(!/\.(env|pem|key)$|^\.env/.test(entry), `credential-like file: ${path}`);
    if (stat.isDirectory()) await walk(path);
  }
}
await walk(dest);

console.log(`${check ? 'Checked' : 'Synced and checked'} Claude Code plugin civpulse ${manifest.version}: ` +
  `${skillNames.length} skills, ${agentFiles.length} agents, ` +
  `${tools.length} compact tools (Codex package ${codex.version}).`);
