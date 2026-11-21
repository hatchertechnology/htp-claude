// Host tests for plugins/htp/bin/seosmith-ops.mjs.
// Most tests run against a FIXTURE binary that mimics the adapter wire documented in
// seosmith docs/operations. They prove helper behavior, not SEOsmith behavior. The final
// group runs against a real binary only when SEOSMITH_REAL_BIN is set; it never starts a crawl.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, statSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as ops from '../plugins/htp/bin/seosmith-ops.mjs';

const HELPER = join(dirname(fileURLToPath(import.meta.url)), '../plugins/htp/bin/seosmith-ops.mjs');
const ID = 'b2a844c8-5bc9-49e5-bcf0-8fd1407d69f4';
const WEB = '4822f25e-af3c-4c60-a8c6-31bd99d2acda';
const CAPS = { adapter_version: 1, engine_version: '0.2.0', report_schema_version: 1, transport: 'local_cli', delivery: 'disabled',
  operations: ['seosmith.start', 'seosmith.status', 'seosmith.cancel', 'seosmith.report', 'seosmith.export'],
  advanced: { evidence_v2: false, authorized_staging: false, ci_baseline: false } };
const goodRequest = (o = {}) => ({ request_id: ID, website_id: WEB, binding_generation: 1, url: 'https://example.com/', max_pages: 20, max_resources: 20, max_duration_seconds: 60, delay_ms: 1000, check_external_links: false, ...o });

// Fixture binary: behavior comes from <dir>/behavior.json; it logs argv and env to <dir>/calls.log.
function fixture(behavior = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'seoops-'));
  const bin = join(dir, 'seosmith');
  writeFileSync(bin, `#!${process.execPath}
const fs = require('fs'); const path = require('path');
const dir = path.dirname(process.argv[1]);
const b = JSON.parse(fs.readFileSync(path.join(dir, 'behavior.json'), 'utf8'));
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify({ argv: process.argv.slice(2), env: process.env }) + '\\n');
const args = process.argv.slice(2); const i = args.indexOf('operations'); const sub = args[i + 1];
const r = b[sub] || {};
if (r.signal) process.kill(process.pid, r.signal);
if (r.sleepMs) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, r.sleepMs);
if (r.stdout !== undefined) process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout));
if (r.stderr !== undefined) process.stderr.write(typeof r.stderr === 'string' ? r.stderr : JSON.stringify(r.stderr));
process.exit(r.exit || 0);
`);
  chmodSync(bin, 0o755);
  const set = (extra) => writeFileSync(join(dir, 'behavior.json'), JSON.stringify({ capabilities: { stdout: CAPS }, ...behavior, ...extra }));
  set({});
  return { dir, bin, set, calls: () => (existsSync(join(dir, 'calls.log')) ? readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []) };
}
const rejects = (p, kind) => assert.rejects(p, (e) => e instanceof ops.OpError && e.kind === kind, `expected ${kind}`);

test('binary resolution never searches cwd and requires an executable regular file', () => {
  assert.throws(() => ops.resolveBinary(undefined), (e) => e.kind === 'missing_binary');
  assert.throws(() => ops.resolveBinary('seosmith'), (e) => e.kind === 'missing_binary');
  assert.throws(() => ops.resolveBinary('/nonexistent/seosmith'), (e) => e.kind === 'missing_binary');
  const f = fixture();
  assert.throws(() => ops.resolveBinary(f.dir), (e) => e.kind === 'missing_binary', 'directory');
  writeFileSync(join(f.dir, 'plain'), 'x', { mode: 0o644 });
  assert.throws(() => ops.resolveBinary(join(f.dir, 'plain')), (e) => e.kind === 'missing_binary', 'not executable');
  assert.equal(ops.resolveBinary(f.bin), f.bin);
});

test('capabilities gate: wrong version, missing operation, bad JSON, unknown command, timeout', async () => {
  const f = fixture();
  assert.equal((await ops.capabilities(f.bin)).adapter_version, 1);
  f.set({ capabilities: { stdout: { ...CAPS, adapter_version: 2 } } });
  await rejects(ops.capabilities(f.bin), 'unsupported_adapter');
  f.set({ capabilities: { stdout: { ...CAPS, operations: ['seosmith.start'] } } });
  await rejects(ops.capabilities(f.bin), 'unsupported_adapter');
  f.set({ capabilities: { stdout: 'not json' } });
  await rejects(ops.capabilities(f.bin), 'bad_output');
  f.set({ capabilities: { exit: 2, stderr: 'error: unrecognized subcommand' } });
  await rejects(ops.capabilities(f.bin), 'unsupported_command');
  f.set({ capabilities: { stdout: CAPS, sleepMs: 6500 } });
  await rejects(ops.capabilities(f.bin), 'timeout');
});

test('request validation rejects unbounded, credentialed, unknown and out-of-range input', () => {
  const v = (o, drop) => { const r = goodRequest(o); if (drop) delete r[drop]; return ops.validateRequest(JSON.stringify(r)); };
  assert.equal(v().max_pages, 20);
  for (const drop of ['max_pages', 'max_resources', 'max_duration_seconds', 'delay_ms', 'check_external_links']) assert.throws(() => v({}, drop), /explicit/, drop);
  assert.throws(() => v({ max_pages: 0 }), /max_pages/);
  assert.throws(() => v({ max_pages: 20001 }), /max_pages/);
  assert.throws(() => v({ max_duration_seconds: 9 }), /max_duration/);
  assert.throws(() => v({ delay_ms: 999 }), /delay_ms/);
  assert.throws(() => v({ url: 'https://user:pw@example.com/' }), /credentials/);
  assert.throws(() => v({ url: 'https://example.com/?token=1' }), /query/);
  assert.throws(() => v({ url: 'https://example.com/#x' }), /query or fragment/);
  assert.throws(() => v({ url: 'https://example.com:8443/' }), /port/);
  assert.throws(() => v({ url: 'file:///etc/passwd' }), /http/);
  assert.throws(() => v({ request_id: '00000000-0000-0000-0000-000000000000' }), /non-nil/);
  assert.throws(() => v({ extra: 1 }), /Unknown request field/);
  assert.throws(() => ops.validateRequest('{'), /valid JSON/);
  assert.throws(() => ops.validateRequest(JSON.stringify(goodRequest({ pad: 'x'.repeat(17000) }))), /16 KiB/);
});

test('prepare creates a private directory, 0600 request, fresh identity per audit', () => {
  const root = join(mkdtempSync(join(tmpdir(), 'seoprep-')), 'audits');
  const a = ops.prepare({ root, url: 'https://example.com/', pages: 5, resources: 5, durationSeconds: 30, delayMs: 1000 });
  const b = ops.prepare({ root, url: 'https://example.com/', pages: 5, resources: 5, durationSeconds: 30, delayMs: 1000 });
  assert.notEqual(a.request_id, b.request_id);
  assert.notEqual(a.database, b.database);
  assert.equal(statSync(a.directory).mode & 0o777, 0o700);
  chmodSync(root, 0o755);
  assert.throws(() => ops.prepare({ root, url: 'https://example.com/', pages: 5, resources: 5, durationSeconds: 30, delayMs: 1000 }), /mode 0700/);
  chmodSync(root, 0o700);
  assert.equal(statSync(a.request).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(a.request, 'utf8')).request_id, a.request_id);
  assert.throws(() => ops.prepare({ root: 'relative', url: 'https://example.com/', pages: 5, resources: 5, durationSeconds: 30, delayMs: 1000 }), /absolute/);
  assert.throws(() => ops.prepare({ root, url: 'https://example.com/', pages: 0, resources: 5, durationSeconds: 30, delayMs: 1000 }), /max_pages/);
});

test('start passes an argv array with no shell, strips credentials from the environment, never auto-retries', async () => {
  const f = fixture({ start: { stdout: { request_id: ID, state: 'completed' } } });
  const reqPath = join(f.dir, 'request.json');
  writeFileSync(reqPath, JSON.stringify(goodRequest()));
  process.env.HTP_TOKEN = 'secret-htp'; process.env.SEOSMITH_API_TOKEN = 'secret-worker'; process.env.GITHUB_TOKEN = 'secret-gh';
  const out = await ops.main(['start', '--binary', f.bin, '--database', join(f.dir, 'run.sqlite'), '--request', reqPath]);
  const startCall = f.calls().at(-1);
  assert.deepEqual(startCall.argv, ['--database', join(f.dir, 'run.sqlite'), 'operations', 'start', '--request', reqPath]);
  assert.deepEqual(Object.keys(startCall.env), ['PATH'], 'only PATH is passed');
  assert.match(out.note, /not a clean audit/);
  f.set({ start: { exit: 1, stderr: { error: 'operation_failed', reason: 'database_scope_conflict_use_fresh_database' } } });
  const before = f.calls().length;
  await assert.rejects(ops.main(['start', '--binary', f.bin, '--database', join(f.dir, 'run.sqlite'), '--request', reqPath]), (e) => e.kind === 'operation_failed' && e.extra.reason === 'database_scope_conflict_use_fresh_database');
  assert.equal(f.calls().length - before, 2, 'one capabilities probe plus exactly one start attempt');
  delete process.env.HTP_TOKEN; delete process.env.SEOSMITH_API_TOKEN; delete process.env.GITHUB_TOKEN;
});

test('start rejects an invalid request file before launching a crawl', async () => {
  const f = fixture();
  const reqPath = join(f.dir, 'request.json');
  writeFileSync(reqPath, JSON.stringify(goodRequest({ url: 'https://u:p@example.com/' })));
  await assert.rejects(ops.main(['start', '--binary', f.bin, '--database', join(f.dir, 'run.sqlite'), '--request', reqPath]), (e) => e.kind === 'invalid_request');
  assert.ok(!f.calls().some((c) => c.argv.includes('start')));
});

test('a host timeout reports an uncertain outcome and directs the caller to status', async () => {
  const f = fixture({ status: { stdout: {}, sleepMs: 1500 } });
  await assert.rejects(ops.op(f.bin, join(f.dir, 'run.sqlite'), 'status', ['--id', ID], { timeoutMs: 300 }), (e) => e.kind === 'timeout' && e.extra.uncertain === true && /status/.test(e.message));
});

test('status surfaces an unknown execution state and never infers a clean audit', async () => {
  const unknown = { request_id: ID, state: 'running', execution_state: 'unknown', worker_active: false, report_available: false, delivery_state: 'disabled', error: null };
  const f = fixture({ status: { stdout: unknown } });
  const out = await ops.main(['status', '--binary', f.bin, '--database', join(f.dir, 'run.sqlite'), '--id', ID]);
  assert.equal(out.result.execution_state, 'unknown');
  assert.equal(out.result.report_available, false);
});

test('cancellation accepted but not terminal is flagged; terminal passes through', async () => {
  const f = fixture({ cancel: { stdout: { request_id: ID, cancel_accepted: true, cancellation_terminal: false, state: 'cancelled', worker_active: true } } });
  const a = await ops.main(['cancel', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID]);
  assert.match(a.result.note, /not terminal/);
  f.set({ cancel: { stdout: { request_id: ID, cancel_accepted: true, cancellation_terminal: true, state: 'cancelled', worker_active: false } } });
  const b = await ops.main(['cancel', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID]);
  assert.equal(b.result.note, undefined);
  f.set({ cancel: { stdout: { request_id: ID, cancel_accepted: false, cancellation_terminal: false, state: 'completed' } } });
  const c = await ops.main(['cancel', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID]);
  assert.equal(c.result.cancel_accepted, false);
});

test('accepted cancellation transitions through unknown to confirmed terminal status', async () => {
  const f = fixture({ cancel: { stdout: { cancel_accepted: true, cancellation_terminal: false, state: 'cancelled', worker_active: true } } });
  const args = ['--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID];
  const cancel = await ops.main(['cancel', ...args]);
  assert.match(cancel.result.note, /worker_active is false/);
  f.set({ status: { stdout: { state: 'cancelled', execution_state: 'terminal', worker_active: null } } });
  const unknown = (await ops.main(['status', ...args])).result;
  const confirmed = (r) => r.state === 'cancelled' && r.execution_state === 'terminal' && r.worker_active === false;
  assert.equal(confirmed(unknown), false);
  f.set({ status: { stdout: { state: 'cancelled', execution_state: 'terminal', worker_active: false } } });
  assert.equal(confirmed((await ops.main(['status', ...args])).result), true);
});

test('abnormal process outcomes retain accurate diagnostics', async () => {
  const f = fixture({ status: { exit: 1, stderr: 'unstructured failure' } });
  const db = join(f.dir, 'r.sqlite');
  await rejects(ops.op(f.bin, db, 'status', ['--id', ID]), 'operation_failed');
  f.set({ status: { signal: 'SIGKILL' } });
  await rejects(ops.op(f.bin, db, 'status', ['--id', ID]), 'operation_failed');
  f.set({ status: { stdout: 'x'.repeat(2048) } });
  await rejects(ops.op(f.bin, db, 'status', ['--id', ID], { maxBuffer: 100 }), 'bad_output');
});

test('documented helper path works outside the plugin with spaces in its path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugin path '));
  const plugin = join(dir, 'plugin root');
  mkdirSync(join(plugin, 'bin'), { recursive: true });
  cpSync(HELPER, join(plugin, 'bin', 'seosmith-ops.mjs'));
  const shell = 'node "${CLAUDE_PLUGIN_ROOT}/bin/seosmith-ops.mjs" prepare --root "$AUDIT_ROOT" --url https://example.com/ --pages 2 --resources 0 --duration 10 --delay-ms 1000';
  const out = execFileSync('/bin/sh', ['-c', shell], { cwd: tmpdir(), env: { ...process.env, CLAUDE_PLUGIN_ROOT: plugin, AUDIT_ROOT: join(dir, 'audits') }, encoding: 'utf8' });
  assert.equal(JSON.parse(out).ok, true);
  const skill = readFileSync(join(dirname(HELPER), '../skills/seosmith-operations/SKILL.md'), 'utf8');
  for (const command of ['prepare', 'start', 'status', 'cancel', 'report', 'export']) assert.ok(skill.includes(`node "\${CLAUDE_PLUGIN_ROOT}/bin/seosmith-ops.mjs" ${command}`), command);
});

test('report keeps partial coverage visible and fails explicitly when unavailable or oversized', async () => {
  const partial = { schema_version: 1, outcome: 'partial', stop_reason: 'max_pages', coverage_complete: false, pages: [], findings: [] };
  const f = fixture({ report: { stdout: partial } });
  const out = await ops.main(['report', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID]);
  assert.equal(out.report.coverage_complete, false);
  assert.equal(out.report.outcome, 'partial');
  for (const reason of ['report_unavailable', 'report_too_large', 'run_not_found']) {
    f.set({ report: { exit: 1, stderr: { error: 'operation_failed', reason } } });
    await assert.rejects(ops.main(['report', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID]), (e) => e.extra.reason === reason);
  }
});

test('export requires an absolute new destination, keeps hostile paths as a single argument and verifies the receipt', async () => {
  const hash = 'a'.repeat(64);
  const f = fixture({ export: { stdout: { request_id: ID, bytes: 10, sha256: hash } } });
  const hostile = join(f.dir, 'out; touch pwned $(id).json');
  const out = await ops.main(['export', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID, '--output', hostile]);
  assert.equal(out.result.sha256, hash);
  assert.equal(f.calls().at(-1).argv.at(-1), hostile);
  assert.ok(!existsSync(join(f.dir, 'pwned')) && !existsSync('pwned'));
  await assert.rejects(ops.main(['export', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID, '--output', 'rel.json']), (e) => e.kind === 'invalid_argument');
  f.set({ export: { stdout: { request_id: ID, bytes: 10 } } });
  await assert.rejects(ops.main(['export', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID, '--output', join(f.dir, 'o.json')]), (e) => e.kind === 'bad_output');
  f.set({ export: { exit: 1, stderr: { error: 'operation_failed', reason: 'export_destination_unavailable' } } });
  await assert.rejects(ops.main(['export', '--binary', f.bin, '--database', join(f.dir, 'r.sqlite'), '--id', ID, '--output', join(f.dir, 'o.json')]), (e) => e.extra.reason === 'export_destination_unavailable');
});

test('relative database and malformed ids are rejected without running a binary operation', async () => {
  const f = fixture();
  await assert.rejects(ops.main(['status', '--binary', f.bin, '--database', 'rel.sqlite', '--id', ID]), (e) => e.kind === 'invalid_argument');
  await assert.rejects(ops.main(['status', '--binary', f.bin, '--database', join(f.dir, 'a'), '--id', 'not-a-uuid; rm -rf /']), (e) => e.kind === 'invalid_argument');
  await assert.rejects(ops.main(['bogus', '--binary', f.bin, '--database', join(f.dir, 'a')]), (e) => e.kind === 'invalid_argument');
});

test('modes distinguishes local, private worker and HTP orchestration and explains unavailability', async () => {
  const none = await ops.modes({});
  assert.equal(none.local.available, false);
  assert.equal(none.local.reason, 'missing_binary');
  assert.equal(none.private_worker.configured, false);
  assert.equal(none.htp_orchestration.detectable_by_helper, false);
  const f = fixture();
  const m = await ops.modes({ SEOSMITH_BIN: f.bin, SEOSMITH_WORKER_URL: 'https://worker.internal' });
  assert.equal(m.local.available, true);
  assert.equal(m.local.advanced.evidence_v2, false);
  assert.equal(m.private_worker.configured, true);
  assert.equal(m.private_worker.automated_by_this_package, false);
  const old = await (async () => { f.set({ capabilities: { stdout: { ...CAPS, adapter_version: 9 } } }); return ops.modes({ SEOSMITH_BIN: f.bin }); })();
  assert.equal(old.local.available, false);
  assert.equal(old.local.reason, 'unsupported_adapter');
});

test('CLI emits a JSON error envelope and non-zero exit (offline / missing binary)', () => {
  let out;
  try { execFileSync(process.execPath, [HELPER, 'capabilities'], { env: { PATH: process.env.PATH }, encoding: 'utf8', stdio: 'pipe' }); } catch (e) { out = e; }
  assert.equal(out.status, 1);
  const body = JSON.parse(out.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.error.kind, 'missing_binary');
});

// ---- real adapter binary (no crawl is started) -------------------------------------------------
const REAL = process.env.SEOSMITH_REAL_BIN;
test('REAL BINARY: capabilities and rejection paths match the helper contract', { skip: !REAL && 'set SEOSMITH_REAL_BIN to an absolute seosmith path' }, async () => {
  const caps = await ops.capabilities(ops.resolveBinary(REAL));
  assert.equal(caps.adapter_version, 1);
  assert.equal(caps.advanced.evidence_v2, false);
  assert.equal(caps.delivery, 'disabled');
  const dir = mkdtempSync(join(tmpdir(), 'seoreal-'));
  mkdirSync(join(dir, 'x'));
  await assert.rejects(ops.main(['status', '--binary', REAL, '--database', join(dir, 'none.sqlite'), '--id', ID]), (e) => e.kind === 'operation_failed' && e.extra.reason === 'run_not_found');
  await assert.rejects(ops.main(['report', '--binary', REAL, '--database', join(dir, 'none.sqlite'), '--id', ID]), (e) => e.kind === 'operation_failed');
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{}');
  // helper-side validation rejects before the binary; call the binary directly to confirm the adapter agrees
  const r = await ops.run(REAL, ['--database', join(dir, 'n.sqlite'), 'operations', 'start', '--request', bad]);
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.stderr).reason, 'explicit_bounds_required');
  assert.ok(!existsSync(join(dir, 'n.sqlite')), 'a rejected request creates no database');
  const evil = await ops.run(REAL, ['--evidence-contract-v2', 'operations', 'capabilities']);
  assert.notEqual(evil.code, 0, 'operations rejects the v2 evidence flag');
});
