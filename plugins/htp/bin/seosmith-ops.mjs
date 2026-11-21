#!/usr/bin/env node
// Bounded SEOsmith local-operations helper for the HTP Claude Code plugin.
// Node built-ins only. It never uses a shell: the SEOsmith binary is run with an
// argv array (execFile), a fixed minimal environment and a timeout. It reads no
// HTP or SEOsmith credential, contacts no network service itself, and treats
// every failure as unavailable/uncertain, never as a clean audit.
//
// Contract: seosmith docs/operations (adapter_version 1). The binary must be an
// operator-installed absolute path given by --binary or SEOSMITH_BIN.
import { execFile } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, realpathSync, statSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ADAPTER_VERSION = 1;
export const REQUIRED_OPERATIONS = ['seosmith.start', 'seosmith.status', 'seosmith.cancel', 'seosmith.report', 'seosmith.export'];
export const LIMITS = { pages: [1, 20000], resources: [0, 20000], duration: [10, 7200], delay: [1000, 60000], requestBytes: 16384 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL = '00000000-0000-0000-0000-000000000000';
const SAFE_ENV = { PATH: '/usr/bin:/bin' };
const REQUEST_FIELDS = new Set(['request_id', 'website_id', 'binding_generation', 'url', 'max_pages', 'max_resources', 'max_duration_seconds', 'delay_ms', 'check_external_links']);

export class OpError extends Error {
  constructor(kind, message, extra = {}) { super(message); this.kind = kind; this.extra = extra; }
}
const fail = (kind, message, extra) => { throw new OpError(kind, message, extra); };

export function resolveBinary(configured) {
  if (!configured) fail('missing_binary', 'No SEOsmith binary configured. Set SEOSMITH_BIN or pass --binary with an absolute path to an operator-installed executable.');
  if (!isAbsolute(configured)) fail('missing_binary', 'The SEOsmith binary must be an absolute path; the working directory is never searched.');
  let real;
  try { real = realpathSync(configured); } catch { fail('missing_binary', 'The configured SEOsmith binary does not exist.'); }
  let ok = false;
  try { ok = statSync(real).isFile(); accessSync(real, constants.X_OK); } catch { ok = false; }
  if (!ok) fail('missing_binary', 'The configured SEOsmith binary is not an executable regular file.');
  return real;
}

export function run(binary, args, { timeoutMs = 30000, maxBuffer = 20 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    execFile(binary, args, { env: SAFE_ENV, timeout: timeoutMs, maxBuffer, encoding: 'utf8', shell: false, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : null) : 0, timedOut: Boolean(err && err.killed && err.signal), signal: err?.signal ?? null, stdout, stderr, spawnError: err && typeof err.code === 'string' ? err.code : null });
    });
  });
}

function parseJson(text, what) {
  try { return JSON.parse(text); } catch { fail('bad_output', `${what} did not return valid JSON; treating the operation as unavailable.`); }
}

// Run one adapter operation and convert process outcomes into typed results.
export async function op(binary, database, sub, extra, opts) {
  const args = [];
  if (database) args.push('--database', database);
  args.push('operations', sub, ...extra);
  const r = await run(binary, args, opts);
  if (r.timedOut) fail('timeout', `seosmith operations ${sub} exceeded the host deadline. The outcome is uncertain; query status before any further action.`, { uncertain: true });
  if (r.spawnError === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') fail('bad_output', `seosmith operations ${sub} exceeded the output limit; the outcome is uncertain.`, { uncertain: true });
  if (r.signal && !r.timedOut) fail('operation_failed', `seosmith operations ${sub} was interrupted by ${r.signal}; the outcome is uncertain.`, { uncertain: true });
  if (r.spawnError) fail('missing_binary', `Could not execute the SEOsmith binary (${r.spawnError}).`);
  if (r.code !== 0) {
    let reason = null;
    try { reason = JSON.parse(r.stderr).reason ?? null; } catch { /* clap syntax or unknown */ }
    if (r.code === 2) fail('unsupported_command', `seosmith operations ${sub} was rejected as an unknown or malformed command (exit ${r.code}). This binary is unsupported; do not substitute another command.`);
    fail('operation_failed', `seosmith operations ${sub} failed${reason ? `: ${reason}` : ' without a structured reason'}`, { reason, exit: r.code });
  }
  return r;
}

export async function capabilities(binary) {
  const r = await op(binary, null, 'capabilities', [], { timeoutMs: 5000 });
  const caps = parseJson(r.stdout, 'capabilities');
  if (caps.adapter_version !== ADAPTER_VERSION) fail('unsupported_adapter', `Adapter version ${caps.adapter_version} is not supported (need ${ADAPTER_VERSION}).`);
  const missing = REQUIRED_OPERATIONS.filter((o) => !Array.isArray(caps.operations) || !caps.operations.includes(o));
  if (missing.length) fail('unsupported_adapter', `Adapter lacks required operations: ${missing.join(', ')}.`);
  return caps;
}

function requireAbsolute(path, what) {
  if (!path || !isAbsolute(path) || path.includes('\0')) fail('invalid_argument', `${what} must be an absolute path.`);
  return path;
}
function requireUuid(id, what) {
  if (!UUID.test(id || '') || id === NIL) fail('invalid_argument', `${what} must be a non-nil UUID.`);
  return id.toLowerCase();
}

export function validateRequest(raw) {
  if (Buffer.byteLength(raw) > LIMITS.requestBytes) fail('invalid_request', 'Request exceeds 16 KiB.');
  let req;
  try { req = JSON.parse(raw); } catch { fail('invalid_request', 'Request is not valid JSON.'); }
  if (!req || typeof req !== 'object' || Array.isArray(req)) fail('invalid_request', 'Request must be a JSON object.');
  for (const k of Object.keys(req)) if (!REQUEST_FIELDS.has(k)) fail('invalid_request', `Unknown request field: ${k}.`);
  for (const k of REQUEST_FIELDS) if (!(k in req)) fail('invalid_request', `Every bound must be explicit; missing ${k}.`);
  requireUuid(req.request_id, 'request_id');
  requireUuid(req.website_id, 'website_id');
  if (!Number.isInteger(req.binding_generation) || req.binding_generation < 0) fail('invalid_request', 'binding_generation must be a non-negative integer.');
  const inRange = (v, [lo, hi], n) => { if (!Number.isInteger(v) || v < lo || v > hi) fail('invalid_request', `${n} must be an integer in ${lo}-${hi}.`); };
  inRange(req.max_pages, LIMITS.pages, 'max_pages');
  inRange(req.max_resources, LIMITS.resources, 'max_resources');
  inRange(req.max_duration_seconds, LIMITS.duration, 'max_duration_seconds');
  inRange(req.delay_ms, LIMITS.delay, 'delay_ms');
  if (typeof req.check_external_links !== 'boolean') fail('invalid_request', 'check_external_links must be a boolean.');
  let u;
  try { u = new URL(req.url); } catch { fail('invalid_request', 'url is not an absolute URL.'); }
  if (!['http:', 'https:'].includes(u.protocol)) fail('invalid_request', 'url must be http or https.');
  if (u.username || u.password) fail('invalid_request', 'url must not contain credentials.');
  if (u.search || u.hash) fail('invalid_request', 'url must not contain a query or fragment.');
  if (u.port) fail('invalid_request', 'url must not use a custom port.');
  return req;
}

// Create a private (0700) audit directory, a fresh request and a fresh database path.
export function prepare({ root, url, pages, resources, durationSeconds, delayMs, externalLinks = false, websiteId }) {
  requireAbsolute(root, '--root');
  const auditId = randomUUID();
  const dir = join(root, auditId);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if ((statSync(root).mode & 0o7777) !== 0o700) fail('invalid_argument', '--root must be a private directory with mode 0700.');
  mkdirSync(dir, { mode: 0o700 });
  chmodSync(dir, 0o700);
  const request = {
    request_id: auditId, website_id: websiteId ? requireUuid(websiteId, '--website-id') : randomUUID(), binding_generation: 1,
    url, max_pages: pages, max_resources: resources, max_duration_seconds: durationSeconds, delay_ms: delayMs, check_external_links: externalLinks,
  };
  const text = JSON.stringify(request);
  validateRequest(text);
  const requestPath = join(dir, 'request.json');
  writeFileSync(requestPath, text, { mode: 0o600, flag: 'wx' });
  return { request_id: auditId, database: join(dir, 'run.sqlite'), request: requestPath, directory: dir };
}

export async function modes(env = process.env) {
  const out = {
    local: { available: false, reason: '' },
    private_worker: {
      configured: Boolean(env.SEOSMITH_WORKER_URL),
      automated_by_this_package: false,
      note: 'Operator-only, protected-network HTTP access to an existing SEOsmith worker. This package does not drive it and never reads worker tokens; use the operator documentation for the private /v1 routes.',
    },
    htp_orchestration: {
      detectable_by_helper: false,
      note: 'Requires an authenticated HTP session with deployed report-request tools (request_website_report, get_website_report_request, cancel_website_report_request). Discover them in the session; do not assume.',
    },
  };
  try {
    const bin = resolveBinary(env.SEOSMITH_BIN);
    const caps = await capabilities(bin);
    out.local = { available: true, binary: bin, adapter_version: caps.adapter_version, engine_version: caps.engine_version, report_schema_version: caps.report_schema_version, delivery: caps.delivery, advanced: caps.advanced };
  } catch (e) {
    if (!(e instanceof OpError)) throw e;
    out.local = { available: false, reason: e.kind, message: e.message };
  }
  return out;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (!a.startsWith('--')) fail('invalid_argument', `Unexpected argument: ${a}`);
    const key = a.slice(2);
    if (key === 'external-links') { opts[key] = true; continue; }
    if (i + 1 >= rest.length) fail('invalid_argument', `Missing value for ${a}`);
    opts[key] = rest[++i];
  }
  return { command, opts };
}
const num = (v, n) => { const x = Number(v); if (!Number.isInteger(x)) fail('invalid_argument', `${n} must be an integer.`); return x; };

export async function main(argv, env = process.env) {
  const { command, opts } = parseArgs(argv);
  if (command === 'modes') return modes(env);
  if (command === 'prepare') {
    return prepare({ root: opts.root, url: opts.url, pages: num(opts.pages, '--pages'), resources: num(opts.resources, '--resources'),
      durationSeconds: num(opts.duration, '--duration'), delayMs: num(opts['delay-ms'], '--delay-ms'), externalLinks: Boolean(opts['external-links']), websiteId: opts['website-id'] });
  }
  const binary = resolveBinary(opts.binary || env.SEOSMITH_BIN);
  const caps = await capabilities(binary);
  if (command === 'capabilities') return caps;
  const database = requireAbsolute(opts.database, '--database');
  if (command === 'start') {
    const requestPath = requireAbsolute(opts.request, '--request');
    if (!existsSync(requestPath)) fail('invalid_argument', 'Request file not found.');
    const req = validateRequest(readFileSync(requestPath, 'utf8'));
    const r = await op(binary, database, 'start', ['--request', requestPath], { timeoutMs: (req.max_duration_seconds + 120) * 1000 });
    return { operation: 'start', note: 'Inspect state and report coverage; a finished command is not a clean audit.', result: parseJson(r.stdout, 'start') };
  }
  const id = requireUuid(opts.id, '--id');
  if (command === 'status' || command === 'cancel') {
    const r = await op(binary, database, command, ['--id', id], { timeoutMs: 15000 });
    const result = parseJson(r.stdout, command);
    if (command === 'cancel' && result.cancel_accepted === true && result.cancellation_terminal !== true) result.note = 'Cancellation accepted but not terminal; poll status. Confirm stopped only when state is cancelled, execution_state is terminal, and worker_active is false; null or unknown is unconfirmed.';
    return { operation: command, result };
  }
  if (command === 'report') {
    const r = await op(binary, database, 'report', ['--id', id], { timeoutMs: 60000 });
    return { operation: 'report', bytes: Buffer.byteLength(r.stdout), report: parseJson(r.stdout, 'report') };
  }
  if (command === 'export') {
    const output = requireAbsolute(opts.output, '--output');
    const r = await op(binary, database, 'export', ['--id', id, '--output', output], { timeoutMs: 60000 });
    const receipt = parseJson(r.stdout, 'export');
    if (!/^[0-9a-f]{64}$/.test(receipt.sha256 || '') || !Number.isInteger(receipt.bytes)) fail('bad_output', 'Export receipt lacks a byte count and SHA-256; the export is not verified.');
    return { operation: 'export', result: receipt };
  }
  return fail('invalid_argument', `Unknown command: ${command}. Use modes, capabilities, prepare, start, status, cancel, report or export.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (out) => { process.stdout.write(`${JSON.stringify({ ok: true, ...out })}\n`); },
    (e) => {
      const err = e instanceof OpError ? { kind: e.kind, message: e.message, ...e.extra } : { kind: 'internal', message: String(e && e.message || e) };
      process.stdout.write(`${JSON.stringify({ ok: false, error: err })}\n`);
      process.exit(1);
    },
  );
}
