#!/usr/bin/env node
// PREPARES (does not perform) the owner-attended Claude acceptance. It installs the release ref into a
// fresh, isolated profile so the owner can run the interactive checks without touching ~/.claude.
// It makes no HTP call, never signs in, starts no model session, and deletes nothing.
//
// usage: node scripts/prepare-owner-acceptance-claude.mjs --root <new dir> --ref <tag|sha> [--source hatchertechnology/htp-claude]
//        node scripts/prepare-owner-acceptance-claude.mjs --root <new dir> --ref v1.3.0
//
// Output: the isolated profile, the exact commands for the owner, and results.template.json.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const rootArg = opt('--root'); const ref = opt('--ref'); const source = opt('--source', 'hatchertechnology/htp-claude');
assert.ok(rootArg && ref, 'usage: --root <new dir> --ref <tag|sha> [--source owner/repo|url]');
assert.match(ref, /^[A-Za-z0-9._\/-]+$/, 'ref must be a plain tag, branch or sha');
const root = resolve(rootArg);
assert.ok(!existsSync(root), '--root must not exist; this script deletes nothing');
assert.ok(!root.startsWith(resolve(process.env.HOME || '/nonexistent', '.claude')), 'root must not be inside ~/.claude');
for (const sub of ['config', 'home', 'xdg-config', 'xdg-data', 'xdg-cache', 'work', 'seosmith']) mkdirSync(join(root, sub), { recursive: true });
const env = {
  PATH: process.env.PATH, HOME: join(root, 'home'), CLAUDE_CONFIG_DIR: join(root, 'config'),
  XDG_CONFIG_HOME: join(root, 'xdg-config'), XDG_DATA_HOME: join(root, 'xdg-data'), XDG_CACHE_HOME: join(root, 'xdg-cache'),
  GIT_TERMINAL_PROMPT: '0', NO_COLOR: '1',
};
const claude = (...a) => spawnSync('claude', a, { cwd: join(root, 'work'), env, encoding: 'utf8', timeout: 180000 });
const must = (...a) => { const r = claude(...a); assert.equal(r.status, 0, `claude ${a.join(' ')}: ${(r.stderr || r.stdout).trim().replace(/\s+/g, ' ').slice(-400)}`); return r.stdout; };

const spec = source.includes('://') ? `${source}#${ref}` : `${source}@${ref}`;
must('plugin', 'marketplace', 'add', spec);
must('plugin', 'install', 'htp@htp');
const records = JSON.parse(readFileSync(join(root, 'config/plugins/installed_plugins.json'), 'utf8')).plugins['htp@htp'] || [];
assert.equal(records.length, 1, 'one installed record');
const rec = records[0];
const manifest = JSON.parse(readFileSync(join(rec.installPath, '.claude-plugin/plugin.json'), 'utf8'));
assert.equal(manifest.version, rec.version);
assert.equal(manifest.engines && manifest.engines['claude-code'], '>=2.1.331', 'declared minimum host version');
console.log(`installed htp@htp ${rec.version} at ${rec.gitCommitSha} into the isolated profile ${root}`);

const template = {
  release: { ref, installedVersion: rec.version, installedSha: rec.gitCommitSha },
  hostVersion: spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim(),
  checks: {
    signIn: null, ownerSavedRead: null, nonOwnerDenied: null, reconnect: null, logout: null,
    discoveryExportV1: null, discoveryReportRequest: null, discoveryParity14: null, discoveryAuditEvents: null,
    seosmithLiveBoundedRun: null,
  },
  notes: 'Record only: pass/fail, the sanitized error code or status, and SHA-256 receipts. No tokens, cookies or customer data.',
};
writeFileSync(join(root, 'results.template.json'), JSON.stringify(template, null, 2) + '\n');
console.log(`
Owner steps (run in a separate shell; this profile is isolated from ~/.claude):

  export HOME=${join(root, 'home')} CLAUDE_CONFIG_DIR=${join(root, 'config')}
  export XDG_CONFIG_HOME=${join(root, 'xdg-config')} XDG_DATA_HOME=${join(root, 'xdg-data')} XDG_CACHE_HOME=${join(root, 'xdg-cache')}
  cd ${join(root, 'work')} && claude

Then follow docs/owner-acceptance-claude.md. Fill ${join(root, 'results.template.json')} as you go.
SEOsmith work directory for the bounded run: ${join(root, 'seosmith')} (set SEOSMITH_BIN to a trusted absolute binary).
`);
