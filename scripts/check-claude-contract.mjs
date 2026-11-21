#!/usr/bin/env node
// Checks the Claude Code package against docs/compatibility-claude.md.
// Uses Node built-ins only. Validates declared contract, not live behavior.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const readJson = (rel) => {
  try {
    return JSON.parse(read(rel));
  } catch (err) {
    fail(`${rel}: invalid JSON (${err.message})`);
    return null;
  }
};

// HTP MCP tools exposed by the server (18). Tools a skill may reference must be in this set.
const HTP_TOOLS = new Set([
  'list_websites', 'get_website', 'create_website', 'update_website', 'delete_website',
  'set_website_ga4_property', 'set_website_business_location', 'set_website_repository',
  'request_website_report', 'website_saved_data', 'website_audit_history', 'website_audit_detail',
  'import_website_audit', 'get_provider_connection', 'disconnect_provider', 'inspect_website_url',
  'website_repository_history', 'hello_world_secured',
]);
// References are conditional on backend capability and release gates.
const GATED_TOOLS = new Set(['get_website_report_request', 'cancel_website_report_request', 'website_audit_export_start_v1', 'website_audit_export_chunk_v1', 'website_audit_export_close_v1']);
// SEOsmith operations must not appear pending host adapter live acceptance.
const SEOSMITH_OP = /seosmith_(start|status|cancel|report|export)|run_seosmith|start_seosmith/i;
const SECRET_LIKE = /(sk-[A-Za-z0-9]{16,}|gho_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{16,})/;

// 1. Marketplace and plugin manifests
const marketplace = readJson('.claude-plugin/marketplace.json');
const manifest = readJson('plugins/htp/.claude-plugin/plugin.json');
if (marketplace && manifest) {
  if (marketplace.name !== 'htp') fail(`marketplace name must be "htp", found "${marketplace.name}"`);
  const entry = (marketplace.plugins || []).find((p) => p.name === 'htp');
  if (!entry) {
    fail('marketplace has no plugin entry named "htp" (install id htp@htp would not resolve)');
  } else {
    if (entry.source !== './plugins/htp') fail(`plugin source must be "./plugins/htp", found "${entry.source}"`);
    if (!entry.source.startsWith('./')) fail('relative source must start with "./"');
    if (entry.source.includes('..')) fail('source must not contain ".."');
    if (!existsSync(join(root, entry.source, '.claude-plugin', 'plugin.json'))) {
      fail(`source ${entry.source} has no .claude-plugin/plugin.json`);
    }
    if (entry.version !== manifest.version) {
      fail(`marketplace version ${entry.version} != plugin.json version ${manifest.version}`);
    }
  }
  if (manifest.name !== 'htp') fail(`plugin.json name must be "htp", found "${manifest.name}"`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) fail(`plugin.json version is not semver: ${manifest.version}`);
  for (const key of ['description', 'author', 'homepage', 'license']) {
    if (!manifest[key]) fail(`plugin.json missing ${key}`);
  }
  if (manifest.skills !== undefined) notes.push('plugin.json sets "skills"; default scan adds to it');
}

// 2. MCP transport: http only, https URL, no sse, no literal credentials
const mcp = readJson('plugins/htp/.mcp.json');
if (mcp) {
  const servers = mcp.mcpServers || {};
  const names = Object.keys(servers);
  if (names.join(',') !== 'htp') fail(`.mcp.json must declare exactly one server "htp", found: ${names.join(', ')}`);
  const s = servers.htp || {};
  if (s.type !== 'http') fail(`htp server type must be "http" (SSE is deprecated), found "${s.type}"`);
  let url;
  try {
    url = new URL(s.url);
  } catch {
    fail(`htp server url is not an absolute URL: ${s.url}`);
  }
  if (url && url.protocol !== 'https:') fail(`htp server url must be https, found ${url.protocol}`);
  if (s.headers && Object.keys(s.headers).some((h) => /authorization/i.test(h))) {
    fail('.mcp.json must not carry an Authorization header; sign-in is host OAuth');
  }
  const raw = read('plugins/htp/.mcp.json');
  if (SECRET_LIKE.test(raw)) fail('.mcp.json contains a credential-like value');
  if (/"sse"/i.test(raw)) fail('.mcp.json must not declare an SSE transport');
}

// 3. Skills: frontmatter, folder name, tool references, no SEOsmith operations
const skillsDir = join(root, 'plugins/htp/skills');
const skillFolders = readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory());
if (skillFolders.length === 0) fail('no skills found under plugins/htp/skills');

// Every Markdown file under a skill folder, including references/, is scanned.
const markdownUnder = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return markdownUnder(p);
    return n.endsWith('.md') ? [p] : [];
  });

// Backticked snake_case identifiers that are tool-shaped but are inputs, not tools.
const PARAM_NAMES = new Set(['website_id', 'request_key']);
const TOOL_VERB = /^(list|get|create|update|delete|set|request|import|inspect|disconnect|cancel)_[a-z0-9_]+$/;
const TOOL_WEBSITE = /^website_[a-z0-9_]+$/;
const MCP_NAME = /mcp__plugin_htp_htp__([a-z0-9_]+)/g;
const BACKTICK = /`([a-z][a-z0-9_]*)`/g;

const referenced = new Set();      // known HTP tools named anywhere in a skill folder
const inSkillMd = new Set();       // known HTP tools named in a SKILL.md
for (const folder of skillFolders) {
  const skillFile = join(skillsDir, folder, 'SKILL.md');
  if (!existsSync(skillFile)) {
    fail(`skill folder ${folder} has no SKILL.md`);
    continue;
  }
  const fmText = readFileSync(skillFile, 'utf8');
  const fm = fmText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) {
    fail(`${folder}/SKILL.md has no frontmatter`);
  } else {
    const nameLine = fm[1].match(/^name:\s*(.+)$/m);
    const descLine = fm[1].match(/^description:\s*(.+)$/m);
    if (!nameLine || nameLine[1].trim() !== folder) fail(`${folder}/SKILL.md name must equal its folder name`);
    if (!descLine || !descLine[1].trim()) fail(`${folder}/SKILL.md needs a description`);
  }

  for (const file of markdownUnder(join(skillsDir, folder))) {
    const rel = file.slice(root.length + 1);
    const text = readFileSync(file, 'utf8');
    if (SEOSMITH_OP.test(text)) fail(`${rel} references a SEOsmith operation, which is unsupported pending host adapter live acceptance`);
    const names = [];
    for (const m of text.matchAll(MCP_NAME)) names.push({ name: m[1], full: true });
    for (const m of text.matchAll(BACKTICK)) names.push({ name: m[1], full: false });
    for (const { name, full } of names) {
      if (GATED_TOOLS.has(name)) {
        continue; // gated lifecycle reference, not baseline availability
      } else if (HTP_TOOLS.has(name)) {
        referenced.add(name);
        if (file === skillFile) inSkillMd.add(name);
      } else if (full || (!PARAM_NAMES.has(name) && (TOOL_VERB.test(name) || TOOL_WEBSITE.test(name)))) {
        fail(`${rel} names an unknown HTP tool: ${name}`);
      }
    }
  }
}
const onlyInReferences = [...referenced].filter((t) => !inSkillMd.has(t)).sort();
notes.push(
  `tools named in skills: ${referenced.size} of ${HTP_TOOLS.size}; in SKILL.md: ${inSkillMd.size}; ` +
    `only in references/: ${onlyInReferences.join(', ') || 'none'}`,
);

// 4. Mandatory pinned source and shipped skill parity (1.1 snapshot, then 1.2 current pin)
try { execFileSync(process.execPath, [join(root, 'scripts/check-provider-request-readiness.mjs')], {stdio: 'pipe'}); }
catch (err) { fail(`provider readiness parity failed: ${err.stderr?.toString() || err.message}`); }
for (const script of ['scripts/check-audit-export-readiness.mjs']) {
  try { execFileSync(process.execPath, [join(root, script)], {stdio: 'pipe'}); }
  catch (err) { fail(`${script} failed: ${err.stderr?.toString() || err.message}`); }
}

// 5. README install steps must match the documented syntax
const readme = read('README.md');
if (/\/plugin install htp --marketplace/.test(readme)) fail('README uses non-documented "/plugin install htp --marketplace"');
if (!/\/plugin install htp@htp/.test(readme)) fail('README must document "/plugin install htp@htp"');

for (const n of notes) console.log(`note: ${n}`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('check-claude-contract: all checks passed');
