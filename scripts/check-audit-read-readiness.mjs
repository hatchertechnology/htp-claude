// Finite offline Claude readiness evidence for the canonical additive audit read
// profile 1.3.0. Verifies the vendored 1.3 tree, the four shipped Claude skill
// files against the 1.3 source lock, and semantic conformance. Gated: no host
// auth, no backend call, no producer activation. The two reads stay gated until
// the deployed 25-tool host discovers them and the H15 producer gates are on.
//
// Absent tool => `unsupported`, never an empty report. A discovered but
// producer-disabled read returns `availability:producer_unavailable`, which is
// not an empty history, not a zero count and not proof that no events exist.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const tree = join(root, 'contract/audit-reads-1.3');
const lock = JSON.parse(readFileSync(join(root, 'contract/audit-reads-1.3.lock.json'), 'utf8'));
assert.equal(lock.contractVersion, '1.3.0');
assert.equal(lock.canonicalCommit, '4e7dc94e4f92a30fb57e4061fa1f06d517157c63');
assert.equal(lock.mergedTree, '36a9456c6e2a819e7b4233ef0ae40b30a509efb8');
assert.equal(lock.sourcePR, 82);
assert.equal(lock.baseCommit, '8c9e84d168afc19572216ceef1362a1d76693307');
assert.equal(lock.revisionStatus, 'merged');
assert.match(lock.canonicalRevision, /merged into main/);
assert.deepEqual(lock.activationGates, [
  'exact-head contract review and canonical merge',
  'H15 producer/processor activation is independently gated and disabled',
  'three host source/readiness companions at exact canonical merge; runtime support separately verified',
  'fresh tools/list and input-schema discovery on the deployed host',
]);

const expected = [
  'docs/plugin-contract/v1.3/README.md',
  'docs/plugin-contract/v1.3/audit-reads.json',
  'docs/plugin-contract/v1.3/conformance.json',
  'docs/plugin-contract/v1.3/skills.lock.json',
  'docs/plugin-contract/v1.3/historical-v1.2-source/plugins/htp/skills/repository-settings/SKILL.md',
  'docs/plugin-contract/v1.3/historical-v1.2-source/plugins/htp/skills/seo-review/SKILL.md',
  'docs/plugin-contract/v1.3/historical-v1.2-source/plugins/htp/skills/seo-review/references/data.md',
  'docs/plugin-contract/v1.3/historical-v1.2-source/plugins/htp/skills/website-management/SKILL.md',
  'plugins/htp/skills/repository-settings/SKILL.md',
  'plugins/htp/skills/seo-review/SKILL.md',
  'plugins/htp/skills/seo-review/references/data.md',
  'plugins/htp/skills/website-management/SKILL.md',
  'scripts/audit-read-contract.mjs',
  'scripts/check-audit-read-contract.mjs',
  'scripts/plugin-contract.mjs',
].sort();
assert.deepEqual(Object.keys(lock.files).sort(), expected, 'lock inventory drift');
const inventory = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`symlink in vendored tree: ${path}`);
  if (entry.isDirectory()) return inventory(path);
  return [path.slice(tree.length + 1)];
});
assert.deepEqual(inventory(tree).sort(), expected, 'vendored tree inventory drift');
const hash = (base, path) => createHash('sha256').update(readFileSync(join(base, path))).digest('hex');
for (const path of expected) assert.equal(hash(tree, path), lock.files[path], 'contract drift: ' + path);

// The four shipped shared skills must be byte-equal to the 1.3 source lock.
const shippedSkills = expected.filter((p) => p.startsWith('plugins/'));
const shippedInventory = readdirSync(join(root, 'plugins/htp/skills'), { withFileTypes: true })
  .flatMap((entry) => {
    const dir = join(root, 'plugins/htp/skills', entry.name);
    if (!entry.isDirectory()) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((file) => {
      const path = join(dir, file.name);
      if (file.isDirectory()) {
        return readdirSync(path, { withFileTypes: true }).map((nested) => join(path, nested.name).slice(root.length));
      }
      return [path.slice(root.length)];
    });
  })
  .filter((p) => !p.startsWith('plugins/htp/skills/seosmith-operations/'))
  .sort();
assert.deepEqual(shippedInventory, shippedSkills.slice().sort(), 'shipped skill inventory drift');
for (const path of shippedSkills) assert.equal(hash(root, path), lock.files[path], 'shipped skill drift: ' + path);

const {
  auditReadProfile,
  auditReadFixtures,
  validateAuditReadResults,
  syntheticAuditReadResults,
} = await import('../contract/audit-reads-1.3/scripts/audit-read-contract.mjs');

assert.equal(auditReadProfile.contractVersion, '1.3.0');
assert.deepEqual(auditReadProfile.extends, ['1.0.0', '1.1.0', '1.2.0']);
assert.equal(auditReadProfile.availability.disabledValue, 'producer_unavailable');
assert.match(auditReadProfile.availability.meaning, /not an empty history/i);
assert.match(auditReadProfile.discovery, /unsupported/i);
assert.match(auditReadProfile.discovery, /never substitute/i);
const readIds = ['htp.website_audit_events', 'htp.website_operational_episodes'];
assert.deepEqual(auditReadProfile.operations.map((op) => op.id).sort(), readIds.slice().sort());
for (const op of auditReadProfile.operations) {
  assert.equal(op.effect, 'read');
  assert.equal(op.authorization, 'htp-owner-oauth');
  assert.equal(op.collection, false, `${op.id} must not collect`);
  assert.equal(op.idempotency, true);
  assert.equal(op.destructive, false);
  assert.ok(op.resultFields.includes('availability'));
  assert.ok(op.resultFields.includes(op.pageField));
}
assert.equal(auditReadFixtures.contractVersion, '1.3.0');
assert.equal(auditReadFixtures.evidenceKind, 'synthetic');
assert.equal(auditReadFixtures.scenarios.length, 16);
for (const id of readIds) {
  for (const suffix of ['owner.page', 'owner.producer_unavailable', 'owner.trailing_page', 'anonymous', 'non_owner', 'missing_capability', 'unpaired_cursor', 'limit_out_of_range']) {
    assert.ok(auditReadFixtures.scenarios.some((s) => s.id === `${id}.${suffix}`), `missing scenario ${id}.${suffix}`);
  }
  const missing = auditReadFixtures.scenarios.find((s) => s.id === `${id}.missing_capability`);
  assert.deepEqual(missing.expected.result, { code: 'unsupported' });
  const disabled = auditReadFixtures.scenarios.find((s) => s.id === `${id}.owner.producer_unavailable`);
  assert.equal(disabled.expected.result.availability, 'producer_unavailable');
}
validateAuditReadResults(auditReadFixtures, syntheticAuditReadResults('claude'));

let mode = 'synthetic';
const args = process.argv.slice(2);
if (args.length) {
  assert.deepEqual(args.length, 2, 'usage: node scripts/check-audit-read-readiness.mjs [--audit-read-results path]');
  assert.equal(args[0], '--audit-read-results');
  assert.ok(statSync(args[1]).size <= 1024 * 1024, 'evidence file must be at most 1 MiB');
  const evidence = JSON.parse(readFileSync(args[1], 'utf8'));
  assert.equal(evidence.contractVersion, '1.3.0');
  assert.equal(evidence.host, 'claude');
  validateAuditReadResults(auditReadFixtures, evidence);
  mode = 'measured';
}
console.log(mode === 'synthetic'
  ? 'Synthetic offline audit read semantics passed. Absent tool is unsupported; producer_unavailable is explicit and never an empty success. This is vendored-source readiness, not host or backend evidence.'
  : 'Measured Claude audit read traces passed the canonical semantic validator. Provenance, live auth, discovery and producer support remain independent acceptance obligations.');
console.log(`Claude audit read profile ${lock.contractVersion}: ${expected.length} canonical artifacts, ${auditReadFixtures.scenarios.length} synthetic scenarios. H15 producer gates and deployed 25-tool discovery remain gated; no host auth, backend or live run.`);
