// Release-shape tests: version, declared minimum Claude Code version, gated tool references.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, cpSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tmpRoot = mkdtempSync(join(tmpdir(), 'claude-release-'));
const manifestPath = 'plugins/htp/.claude-plugin/plugin.json';
const marketPath = '.claude-plugin/marketplace.json';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function check(mutate) {
  const dir = mkdtempSync(join(tmpRoot, 'case-'));
  const cwd = join(dir, 'repo');
  for (const p of ['scripts', 'contract', 'plugins', '.claude-plugin', 'README.md']) cpSync(join(root, p), join(cwd, p), { recursive: true });
  if (mutate) mutate(cwd);
  return spawnSync(process.execPath, [join(cwd, 'scripts/check-claude-contract.mjs')], { cwd, encoding: 'utf8', timeout: 60000 });
}

test('release package is 1.3.0 in both manifests and declares the minimum host version', () => {
  const manifest = readJson(join(root, manifestPath));
  const market = readJson(join(root, marketPath));
  assert.equal(manifest.version, '1.3.0');
  assert.equal(market.plugins[0].version, '1.3.0');
  assert.deepEqual(manifest.engines, { 'claude-code': '>=2.1.331' });
  assert.equal(manifest.minClaudeCodeVersion, undefined, 'the host ignores minClaudeCodeVersion');
});

test('the contract checker passes on the release tree', () => {
  const r = check();
  assert.equal(r.status, 0, r.stderr);
});

for (const [name, mutate] of [
  ['marketplace version drift', (d) => { const p = join(d, marketPath); const j = readJson(p); j.plugins[0].version = '1.2.2'; writeFileSync(p, JSON.stringify(j)); }],
  ['plugin version not 1.3.0', (d) => {
    for (const p of [manifestPath, marketPath]) {
      const f = join(d, p); const j = readJson(f);
      if (j.plugins) j.plugins[0].version = '1.2.2'; else j.version = '1.2.2';
      writeFileSync(f, JSON.stringify(j));
    }
  }],
  ['missing engines', (d) => { const p = join(d, manifestPath); const j = readJson(p); delete j.engines; writeFileSync(p, JSON.stringify(j)); }],
  ['lower engines floor', (d) => { const p = join(d, manifestPath); const j = readJson(p); j.engines['claude-code'] = '>=2.1.0'; writeFileSync(p, JSON.stringify(j)); }],
  ['ignored minClaudeCodeVersion field', (d) => { const p = join(d, manifestPath); const j = readJson(p); j.minClaudeCodeVersion = '2.1.331'; writeFileSync(p, JSON.stringify(j)); }],
  ['unknown tool in the host skill', (d) => appendFileSync(join(d, 'plugins/htp/skills/lifecycle-remediation/SKILL.md'), '\nUse `get_website_lifecycle_x`.\n')],
  ['SEOsmith operation in a shared skill', (d) => appendFileSync(join(d, 'plugins/htp/skills/website-management/SKILL.md'), '\nrun_seosmith\n')],
  ['1.4 read promoted to a baseline tool', (d) => {
    const p = join(d, 'scripts/check-claude-contract.mjs');
    writeFileSync(p, readFileSync(p, 'utf8').replace("'website_audit_events', 'website_operational_episodes',", "'website_audit_events', 'website_operational_episodes', 'website_audit_lifecycle',"));
  }],
]) {
  test('contract checker rejects ' + name, () => assert.notEqual(check(mutate).status, 0));
}

test('temporary directory cleanup', () => {
  rmSync(tmpRoot, { recursive: true, force: true });
});
