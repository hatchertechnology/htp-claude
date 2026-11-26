#!/usr/bin/env node
// Rehearses the Claude release lifecycle in DISPOSABLE homes against a LOCAL smart-Git mirror:
//   install v1.1.0 -> upgrade to the target -> roll back to v1.1.0 (tag and exact commit),
//   install v1.2.2 -> upgrade to the target -> roll back to v1.2.2,
//   and an engines-floor negative (a mirror-only commit whose engines floor is above the host).
//
// It never touches the owner's ~/.claude, never contacts GitHub, creates no tags in the real
// repository (tags exist only in the throwaway mirror clone), logs in to nothing, makes no MCP call
// and starts no model session. It deletes nothing: the --root directory must not exist yet.
//
// usage: node scripts/rehearse-release-claude.mjs --root <new dir> --target <sha> \
//          [--v110 0c0fba9414109ed3991d5bfdbaf71195e0eee621] [--v122 6f4dd3232bb4218f12cb6bf2fe1a8f2bfe3f0a5f] [--log file]
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- smart-HTTP git server (runs in a CHILD process: the main flow uses spawnSync, which would block it) ----
function serveGit(serveRoot) {
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const env = {
      PATH: process.env.PATH, GIT_PROJECT_ROOT: serveRoot, GIT_HTTP_EXPORT_ALL: '1',
      REQUEST_METHOD: req.method, PATH_INFO: u.pathname, QUERY_STRING: u.search.slice(1),
      CONTENT_TYPE: req.headers['content-type'] || '', REMOTE_ADDR: '127.0.0.1',
      ...(req.headers['content-length'] ? { CONTENT_LENGTH: req.headers['content-length'] } : {}),
      ...(req.headers['content-encoding'] ? { HTTP_CONTENT_ENCODING: req.headers['content-encoding'] } : {}),
      ...(req.headers['git-protocol'] ? { GIT_PROTOCOL: req.headers['git-protocol'] } : {}),
    };
    const child = spawn('git', ['http-backend'], { env });
    req.pipe(child.stdin);
    let buf = Buffer.alloc(0), sent = false;
    child.stdout.on('data', (d) => {
      if (sent) { res.write(d); return; }
      buf = Buffer.concat([buf, d]);
      const at = buf.indexOf('\r\n\r\n');
      if (at < 0) return;
      const head = buf.subarray(0, at).toString();
      let status = 200; const headers = {};
      for (const line of head.split('\r\n')) {
        const i = line.indexOf(':'); if (i < 0) continue;
        const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
        if (k.toLowerCase() === 'status') status = parseInt(v, 10); else headers[k] = v;
      }
      res.writeHead(status, headers); sent = true; res.write(buf.subarray(at + 4));
    });
    child.stdout.on('end', () => res.end());
    child.on('error', () => res.end());
  });
  server.listen(0, '127.0.0.1', () => console.log(server.address().port));
}
if (process.argv[2] === '--serve') { serveGit(process.argv[3]); await new Promise(() => {}); }

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const rootArg = opt('--root');
const target = opt('--target');
const V110 = opt('--v110', '0c0fba9414109ed3991d5bfdbaf71195e0eee621');
const V122 = opt('--v122', '6f4dd3232bb4218f12cb6bf2fe1a8f2bfe3f0a5f');
const logFile = opt('--log');
assert.ok(rootArg && target, 'usage: --root <new dir> --target <sha> [--v110 sha] [--v122 sha] [--log file]');
const root = resolve(rootArg);
assert.ok(!existsSync(root), '--root must not exist; this script deletes nothing');
assert.ok(!root.startsWith(resolve(process.env.HOME || '/nonexistent', '.claude')), 'root must not be inside ~/.claude');
mkdirSync(root, { recursive: true });

const results = [];
const out = (line) => { console.log(line); if (logFile) appendFileSync(logFile, line + '\n'); };
function step(name, fn) {
  try { const detail = fn(); results.push([name, true]); out(`PASS ${name}${detail ? ' :: ' + detail : ''}`); }
  catch (err) { results.push([name, false]); out(`FAIL ${name} :: ${String(err.message).split('\n')[0]}`); }
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();
const full = (sha) => git(repo, 'rev-parse', '--verify', sha + '^{commit}');
const fullTarget = full(target);
const fullV110 = full(V110);
const fullV122 = full(V122);
const manifestAt = (sha) => JSON.parse(git(repo, 'show', `${sha}:plugins/htp/.claude-plugin/plugin.json`));
const version = (sha) => manifestAt(sha).version;

// ---- mirror: bare clone served over smart HTTP on loopback ----
const mirror = join(root, 'serve', 'htp-claude.git');
mkdirSync(join(root, 'serve'), { recursive: true });
git(root, 'clone', '--bare', '--quiet', repo, mirror);
git(mirror, 'config', 'http.receivepack', 'false');
const setMain = (sha) => git(mirror, 'update-ref', 'refs/heads/main', sha);
git(mirror, 'symbolic-ref', 'HEAD', 'refs/heads/main');
// Throwaway tags in the MIRROR only.
git(mirror, 'update-ref', 'refs/tags/v1.1.0', fullV110);
git(mirror, 'update-ref', 'refs/tags/v1.2.2', fullV122);
git(mirror, 'update-ref', 'refs/tags/v1.3.0', fullTarget);

const server = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve', join(root, 'serve')], { stdio: ['ignore', 'pipe', 'inherit'] });
const port = await new Promise((ok, bad) => { server.stdout.once('data', (d) => ok(parseInt(String(d), 10))); server.once('error', bad); });
const url = `http://127.0.0.1:${port}/htp-claude.git`;

// ---- disposable profile + claude wrapper ----
const claudeBin = spawnSync('which', ['claude'], { encoding: 'utf8' }).stdout.trim();
assert.ok(claudeBin, 'claude CLI not found');
const hostVersion = execFileSync(claudeBin, ['--version'], { encoding: 'utf8' }).trim();
out(`# host: ${hostVersion}; mirror: ${url}; target ${fullTarget}; v1.1.0 ${fullV110}; v1.2.2 ${fullV122}`);
let profileN = 0;
function profile() {
  const dir = join(root, `profile-${++profileN}`);
  for (const sub of ['config', 'home', 'xdg-config', 'xdg-data', 'xdg-cache', 'work']) mkdirSync(join(dir, sub), { recursive: true });
  const env = {
    PATH: process.env.PATH, HOME: join(dir, 'home'), CLAUDE_CONFIG_DIR: join(dir, 'config'),
    XDG_CONFIG_HOME: join(dir, 'xdg-config'), XDG_DATA_HOME: join(dir, 'xdg-data'), XDG_CACHE_HOME: join(dir, 'xdg-cache'),
    GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'false', NO_COLOR: '1',
  };
  const claude = (...args) => spawnSync(claudeBin, args, { cwd: join(dir, 'work'), env, encoding: 'utf8', timeout: 180000 });
  const must = (...args) => { const r = claude(...args); assert.equal(r.status, 0, `claude ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim().replace(/\s+/g, ' ').slice(-700)}`); return r.stdout; };
  const registry = () => {
    const f = join(dir, 'config/plugins/installed_plugins.json');
    const entries = (JSON.parse(readFileSync(f, 'utf8')).plugins['htp@htp'] || []).filter((p) => p.scope === 'user');
    assert.equal(entries.length, 1, 'exactly one user-scope htp@htp record');
    return entries[0];
  };
  return { dir, claude, must, registry };
}
const filesUnder = (d, base = d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = join(d, e.name);
  return e.isDirectory() ? filesUnder(p, base) : [p.slice(base.length + 1)];
}).sort();
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
// Every installed byte must equal the plugin source tree at the exact commit.
function assertInstalledEqualsTree(p, commit) {
  const rec = p.registry();
  const treeFiles = git(repo, 'ls-tree', '-r', '--name-only', commit, '--', 'plugins/htp').split('\n').filter(Boolean);
  const want = new Map(treeFiles.map((f) => [f.replace(/^plugins\/htp\//, ''), createHash('sha256').update(execFileSync('git', ['show', `${commit}:${f}`], { cwd: repo, maxBuffer: 64 << 20 })).digest('hex')]));
  const have = filesUnder(rec.installPath).filter((f) => !f.startsWith('.git/'));
  assert.deepEqual(have.filter((f) => want.has(f) || !f.startsWith('.')).sort(), [...want.keys()].sort(), 'installed file inventory differs from the commit tree');
  for (const [f, h] of want) assert.equal(sha(join(rec.installPath, f)), h, 'installed bytes differ: ' + f);
  return `${want.size} files byte-equal to ${commit.slice(0, 12)}`;
}
function assertRecord(p, commit) {
  const rec = p.registry();
  assert.equal(rec.gitCommitSha, commit, `registry gitCommitSha ${rec.gitCommitSha} != ${commit}`);
  assert.equal(rec.version, version(commit), `registry version ${rec.version} != manifest ${version(commit)}`);
  return `version ${rec.version} at ${commit.slice(0, 12)}`;
}

function lifecycle(label, baselineSha, baselineTag) {
  const p = profile();
  step(`${label}: install baseline ${baselineTag} from the mirror`, () => {
    setMain(baselineSha);
    p.must('plugin', 'marketplace', 'add', url);
    p.must('plugin', 'install', 'htp@htp');
    return assertRecord(p, baselineSha);
  });
  step(`${label}: baseline installed bytes equal the commit tree`, () => assertInstalledEqualsTree(p, baselineSha));
  let installedAt;
  step(`${label}: update commands on an unchanged mirror are a no-op`, () => {
    installedAt = p.registry().installedAt;
    p.must('plugin', 'marketplace', 'update', 'htp'); p.must('plugin', 'update', 'htp@htp');
    return assertRecord(p, baselineSha);
  });
  step(`${label}: upgrade to ${fullTarget.slice(0, 12)} (1.3.0)`, () => {
    setMain(fullTarget);
    p.must('plugin', 'marketplace', 'update', 'htp');
    p.must('plugin', 'update', 'htp@htp');
    assert.equal(p.registry().installedAt, installedAt, 'installedAt must be preserved by an in-place update');
    return assertRecord(p, fullTarget);
  });
  step(`${label}: upgraded bytes equal the target tree, with the 1.4 skill and engines floor`, () => {
    const d = assertInstalledEqualsTree(p, fullTarget);
    const rec = p.registry();
    assert.ok(existsSync(join(rec.installPath, 'skills/lifecycle-remediation/SKILL.md')), 'lifecycle-remediation skill installed');
    assert.equal(JSON.parse(readFileSync(join(rec.installPath, '.claude-plugin/plugin.json'), 'utf8')).engines['claude-code'], '>=2.1.331');
    return d;
  });
  step(`${label}: plugin list reports 1.3.0 enabled`, () => {
    const list = JSON.parse(p.must('plugin', 'list', '--json')).find((e) => e.id === 'htp@htp');
    assert.ok(list && list.version === '1.3.0' && list.enabled === true, JSON.stringify(list));
    return 'htp@htp 1.3.0 enabled';
  });
  step(`${label}: rollback to ${baselineTag} by tag (uninstall, remove marketplace, re-add at tag)`, () => {
    p.must('plugin', 'uninstall', 'htp@htp'); p.must('plugin', 'marketplace', 'remove', 'htp');
    p.must('plugin', 'marketplace', 'add', `${url}#${baselineTag}`);
    p.must('plugin', 'install', 'htp@htp'); p.must('plugin', 'disable', 'htp@htp');
    const r = assertRecord(p, baselineSha);
    assert.equal(p.registry().installPath && JSON.parse(p.must('plugin', 'list', '--json')).find((e) => e.id === 'htp@htp').enabled, false, 'rollback leaves the plugin disabled until verified');
    return r + ' (disabled until verified)';
  });
  step(`${label}: rolled-back bytes equal the baseline tree`, () => assertInstalledEqualsTree(p, baselineSha));
  step(`${label}: re-enable after the revision check`, () => {
    p.must('plugin', 'enable', 'htp@htp');
    assert.equal(JSON.parse(p.must('plugin', 'list', '--json')).find((e) => e.id === 'htp@htp').enabled, true);
    return 'enabled';
  });
  step(`${label}: roll forward again by the 1.3.0 tag`, () => {
    p.must('plugin', 'uninstall', 'htp@htp'); p.must('plugin', 'marketplace', 'remove', 'htp');
    p.must('plugin', 'marketplace', 'add', `${url}#v1.3.0`); p.must('plugin', 'install', 'htp@htp');
    return assertRecord(p, fullTarget);
  });
}

lifecycle('v1.1.0->1.3.0', fullV110, 'v1.1.0');
lifecycle('v1.2.2->1.3.0', fullV122, 'v1.2.2');

// ---- engines floor negative: a mirror-only commit whose floor exceeds the host ----
step('engines floor above the host is refused for a git source', () => {
  const tmp = join(root, 'engines-fixture');
  git(root, 'clone', '--quiet', mirror, tmp);
  git(tmp, 'checkout', '--quiet', '--detach', fullTarget);
  const mf = join(tmp, 'plugins/htp/.claude-plugin/plugin.json');
  const j = JSON.parse(readFileSync(mf, 'utf8')); j.engines['claude-code'] = '>=99.0.0'; writeFileSync(mf, JSON.stringify(j, null, 2) + '\n');
  const mk = join(tmp, '.claude-plugin/marketplace.json');
  const m = JSON.parse(readFileSync(mk, 'utf8')); m.plugins[0].version = j.version; writeFileSync(mk, JSON.stringify(m, null, 2) + '\n');
  git(tmp, '-c', 'commit.gpgsign=false', '-c', 'user.name=rehearsal', '-c', 'user.email=rehearsal@example.invalid', 'commit', '--quiet', '-am', 'rehearsal: engines floor 99');
  git(tmp, 'push', '--quiet', mirror, 'HEAD:refs/heads/rehearsal-engines');
  const p = profile();
  setMain(git(mirror, 'rev-parse', 'refs/heads/rehearsal-engines'));
  p.must('plugin', 'marketplace', 'add', url);
  const r = p.claude('plugin', 'install', 'htp@htp');
  const text = `${r.stdout}\n${r.stderr}`;
  const installed = existsSync(join(p.dir, 'config/plugins/installed_plugins.json')) && (JSON.parse(readFileSync(join(p.dir, 'config/plugins/installed_plugins.json'), 'utf8')).plugins['htp@htp'] || []).length > 0;
  assert.ok(r.status !== 0 && !installed, `expected refusal; status ${r.status}, installed ${installed}: ${text.trim().split('\n').slice(-2).join(' | ')}`);
  setMain(fullTarget);
  return `refused (${text.trim().split('\n').slice(-1)[0].slice(0, 160)})`;
});

server.kill();
const failed = results.filter(([, ok]) => !ok);
out(`# ${results.length - failed.length}/${results.length} steps passed; root ${root}`);
process.exit(failed.length ? 1 : 0);
