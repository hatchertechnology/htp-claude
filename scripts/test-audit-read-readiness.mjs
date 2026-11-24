import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, cpSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syntheticAuditReadResults } from '../contract/audit-reads-1.3/scripts/audit-read-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tmpRoot = mkdtempSync(join(tmpdir(), 'claude-audit-read-'));

function run(results, mutate) {
  const dir = mkdtempSync(join(tmpRoot, 'case-'));
  let cwd = root;
  if (mutate) {
    cwd = join(dir, 'repo');
    for (const p of ['scripts', 'contract', 'plugins', '.claude-plugin']) {
      cpSync(join(root, p), join(cwd, p), { recursive: true });
    }
    mutate(cwd);
  }
  const args = [join(cwd, 'scripts/check-audit-read-readiness.mjs')];
  if (results) {
    const file = join(dir, 'results.json');
    writeFileSync(file, JSON.stringify(results));
    args.push('--audit-read-results', file);
  }
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 20000 });
}

test('synthetic CLI checks all 16 scenarios with an explicit label', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Synthetic offline audit read semantics passed/);
  assert.match(r.stdout, /16 synthetic scenarios/);
});

test('measured Claude traces pass and are labelled measured', () => {
  const r = run(syntheticAuditReadResults('claude'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Measured Claude audit read traces/);
});

for (const [name, mutate] of [
  ['wrong host', (r) => { r.host = 'pi'; }],
  ['erased producer availability', (r) => {
    const obs = r.observations.find((o) => o.id === 'htp.website_audit_events.owner.producer_unavailable');
    delete obs.result.availability;
  }],
  ['missing tool substituted as empty success', (r) => {
    const obs = r.observations.find((o) => o.id === 'htp.website_operational_episodes.missing_capability');
    obs.result = { version: 1, episodes: [], has_more: false, next_cursor: null, availability: 'producer_unavailable' };
  }],
  ['unpaired cursor accepted', (r) => {
    const obs = r.observations.find((o) => o.id === 'htp.website_audit_events.unpaired_cursor');
    obs.result = { semantics_version: 1, events: [], has_more: false, next_cursor: null, availability: 'producer_unavailable' };
  }],
  ['out-of-range limit accepted', (r) => {
    const obs = r.observations.find((o) => o.id === 'htp.website_operational_episodes.limit_out_of_range');
    obs.result = { version: 1, episodes: [], has_more: false, next_cursor: null, availability: 'producer_unavailable' };
  }],
  ['dropped scenario', (r) => r.observations.pop()],
]) {
  test('CLI rejects ' + name, () => {
    const results = syntheticAuditReadResults('claude');
    mutate(results);
    assert.notEqual(run(results).status, 0);
  });
}

const tree = 'contract/audit-reads-1.3/';
for (const [name, mutate] of [
  ['validator drift', (d) => appendFileSync(join(d, tree + 'scripts/audit-read-contract.mjs'), '\n')],
  ['source skill drift', (d) => appendFileSync(join(d, tree + 'plugins/htp/skills/seo-review/SKILL.md'), '\n')],
  ['shipped skill drift', (d) => appendFileSync(join(d, 'plugins/htp/skills/website-management/SKILL.md'), '\ndrift\n')],
  ['shipped skill extra file', (d) => writeFileSync(join(d, 'plugins/htp/skills/website-management/extra.md'), 'x')],
  ['lock drift', (d) => {
    const p = join(d, 'contract/audit-reads-1.3.lock.json');
    const l = JSON.parse(readFileSync(p, 'utf8'));
    l.canonicalCommit = '0'.repeat(40);
    writeFileSync(p, JSON.stringify(l));
  }],
  ['gate removal', (d) => {
    const p = join(d, 'contract/audit-reads-1.3.lock.json');
    const l = JSON.parse(readFileSync(p, 'utf8'));
    l.activationGates = [];
    writeFileSync(p, JSON.stringify(l));
  }],
]) {
  test('readiness rejects ' + name, () => assert.notEqual(run(null, mutate).status, 0));
}

test('temporary evidence directory cleanup', () => {
  rmSync(tmpRoot, { recursive: true, force: true });
});
