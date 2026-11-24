# Claude Code compatibility

This page is the Claude Code host contract for the `htp` plugin. It records what is
supported today, what was tested, and what is not yet available. It covers Wave 0
readiness for the shared plugin contract (HTP #34) and the Wave 1 host package for
htp-claude #1. It is not a production release; #1 stays open until the release
criteria at the end of this page are met with live evidence.

## Tested baseline

| Item | Value |
| --- | --- |
| Claude Code tested | 2.1.331 (canonical Git marketplace lifecycle and controlled upgrade); 2.1.330 (local-directory lifecycle and validation); 2.1.325 for earlier readiness work |
| Minimum version | Not yet verified. Do not rely on a minimum until it is tested. |
| Plugin version | 1.2.1 (`plugins/htp/.claude-plugin/plugin.json`, matches the marketplace entry) |
| Install id | `htp@htp` (plugin `htp`, marketplace `htp`) |
| Validation | `claude plugin validate ./plugins/htp` and `claude plugin validate .` pass |
| Installed-package SEOsmith helper acceptance | Passed on 2.1.331: the shipped helper run from the installed plugin directory against a real adapter-v1 binary and seeded stored state produced report content, byte-exact export and terminal cancellation |

`claude plugin validate` reports two plugin-directory listing warnings, `ICON_MISSING` and
`PRIVACY_URL_MISSING`. They do not affect loading. They are needed only for submission to
Anthropic's directory and are tracked as open listing gaps.

## Transport

The plugin declares one remote MCP server, `htp`, in `plugins/htp/.mcp.json`:

```json
{ "mcpServers": { "htp": { "type": "http", "url": "https://htp-api-kerry-hatcher.fly.dev/mcp/secured" } } }
```

- Use `http`. Claude Code documents HTTP as the recommended transport for remote servers.
- Do not add an `sse` entry. Claude Code documents SSE as deprecated.
- Tools from the plugin server are named `mcp__plugin_htp_htp__<tool>`.

## Authentication

- Sign-in uses the host's OAuth flow. Run `/mcp` in an interactive session and complete the
  browser sign-in for the HTP server. From a shell, `claude mcp login <name>` runs the same
  flow; use `--no-browser` over SSH. The server name for a plugin-provided server is **not
  verified**. Take it from `/mcp` or `claude mcp list` rather than assuming `htp`.
- The plugin stores no credential. No `userConfig` secret is declared, and no token,
  client secret or refresh grant is committed or prompted for.
- `claude -p` and Agent SDK runs have no `/mcp` panel, so OAuth cannot run there. Sign in
  from an interactive session first.
- `claude mcp logout <name>` clears stored OAuth credentials (CLI help). The official MCP docs
  add two points. The `/mcp` menu's "Clear authentication" is described as revoking access. To
  revoke tokens where the authorization server supports revocation, run `claude mcp logout <name>`
  before `claude mcp remove <name>`. `remove` alone deletes local tokens but does not revoke them
  at the issuer.
- Expired or missing sign-in must be reported as needing sign-in. It must never appear as
  an empty result. Website access that HTP denies stays denied on every host.

## Install, upgrade and rollback

Install from the marketplace:

```
/plugin marketplace add hatchertechnology/htp-claude
/plugin install htp@htp
```

From a shell: `claude plugin marketplace add hatchertechnology/htp-claude` and
`claude plugin install htp@htp`.

Lifecycle commands tested in isolated `CLAUDE_CONFIG_DIR` profiles (see
[host verification](host-verification-claude.md) for exact refs and limits):

| Action | Command |
| --- | --- |
| Install | `claude plugin marketplace add hatchertechnology/htp-claude` then `claude plugin install htp@htp` |
| Upgrade | `claude plugin marketplace update htp` then `claude plugin update htp@htp`, then restart or `/reload-plugins`. A real 1.1.0 → 1.2.0 CLI transition passed on a controlled smart-Git mirror; canonical unchanged-main checks were no-ops. The 1.2.0 → 1.2.1 step uses the same procedure and was not separately exercised. Session reload was not tested. |
| Uninstall | `claude plugin uninstall htp@htp`; optionally `claude plugin marketplace remove htp` |
| Rollback | Source-switch reinstall, with the precautions and post-install revision check below. No published rollback tag was available at verification time. |

### Rollback and existing marketplace settings

On Claude Code 2.1.331, adding `htp` from a different ref while its previous
`extraKnownMarketplaces` declaration remains is rejected as a source mismatch.
Uninstalling the plugin alone does not remove that declaration. Also,
`claude plugin marketplace remove htp` uninstalls **all plugins from that
marketplace** and warns that it deletes their saved options, secrets and data
where possible. This is a reinstall procedure, not a data-preserving downgrade.
There is no guarantee of preserving plugin-local data or sign-in. These CLI
checks did not verify server-side data preservation.

First inspect `claude plugin marketplace list` and `claude plugin list --json`.
Identify the declaration's scope and any other installed packages from `htp`.
For a project or managed declaration, have its owner change the source through
that scope's supported configuration; do not overwrite unrelated settings or
bypass a managed source restriction. Test a candidate in a fresh isolated
profile first. Before replacing a user-scope declaration, arrange any required
backup of target-plugin local state and account for every affected package.
Stop if the source's ownership or the removal's effects are unclear.

Close every Claude Code session using the target profile before changing the
marketplace. Use a separate shell for the CLI commands and keep those sessions
closed until the revision check below succeeds. On 2.1.331, installation enables
the plugin immediately. If the sequence stops after installation, run the
disable command and confirm the disabled state before opening a session.

The following commands were verified against the canonical repository for a
**user-scope** `htp` declaration containing only the target plugin. After the
last command, confirm that the `htp@htp` entry reports `enabled: false`.

```sh
claude plugin uninstall htp@htp
claude plugin marketplace remove htp
claude plugin marketplace add hatchertechnology/htp-claude@e090c94d7fb11a187b329cb116343c19a29bca7e
claude plugin install htp@htp
claude plugin disable htp@htp
claude plugin list --json
```

The full commit selector above was tested on 2.1.331 and installed package
1.1.0 at exactly `e090c94d7fb11a187b329cb116343c19a29bca7e`. The separately
tested historical ref `@wave0/claude-export-readiness` resolved to that same
commit, but is a **mutable development branch**, not an immutable pin or release
tag. No upstream tags were advertised; `@v1.1.0` failed because the ref does
not exist. Check the installed revision before enabling or restarting with the plugin. The version
string alone does not identify the installed commit. For this tested user-scope
installation, the host records it in `plugins/installed_plugins.json`:

```sh
python3 - <<'PY'
import json, os
from pathlib import Path
root = Path(os.environ.get('CLAUDE_CONFIG_DIR', str(Path.home() / '.claude')))
records = json.loads((root / 'plugins/installed_plugins.json').read_text())
entries = [p for p in records['plugins'].get('htp@htp', []) if p['scope'] == 'user']
expected = 'e090c94d7fb11a187b329cb116343c19a29bca7e'
if len(entries) != 1 or entries[0].get('gitCommitSha') != expected or entries[0].get('version') != '1.1.0':
    raise SystemExit('Installed revision/version mismatch; keep htp disabled and investigate')
print('Verified htp 1.1.0 at', expected)
PY
```

Only after that check succeeds, run `claude plugin enable htp@htp`, then
restart or `/reload-plugins`. If using a branch instead, do not accept a moved
revision merely because it still reports 1.1.0. The registry check is an
observed host implementation detail for 2.1.331; fail closed if the field is
missing. This procedure verifies rollback by commit. A release-tag procedure
requires a published tag and its own verification. Return to main through the same reviewed uninstall/remove/
add/install process and verify its intended revision before enabling.

The 1.1.0 skills and `.mcp.json` are unchanged in 1.2.0. 1.2.0 adds one
skill (`seosmith-operations`) and one helper (`bin/seosmith-ops.mjs`). 1.2.1
keeps the same skills and MCP declaration and makes the helper entry guard
resolve real paths, so the helper also runs when the plugin directory is reached
through a symlink. Sign-in is stored by the host, not
the plugin, so uninstall/reinstall may require signing in again. Minimum supported version stays
unverified; the tested versions above are evidence, not a minimum-version guarantee. The plugin version in `plugin.json` and the marketplace entry must
always match; the validator and contract checker both check it.

## Skills

Skills are the default `skills/` scan in the plugin root. Each is a `<name>/SKILL.md` folder
with `name` and `description` frontmatter, and `name` equals its folder name.

| Skill | Operations |
| --- | --- |
| `seo-review` | Reads saved HTP evidence: website list, saved data, repository history, audit history and detail. Reads never start collection. |
| `website-management` | Website CRUD, GA4 and Business Profile bindings, report requests, provider status, indexed URL inspection, audit import. |
| `repository-settings` | Attach, pause or remove a website's public repository. |
| `seosmith-operations` | Host-specific. Explicit bounded SEOsmith start, status, cancel, report and export through the local adapter helper. Not part of the shared pinned set. |

Shared skills are synchronized byte-for-byte with the pinned 1.2 lock; `seosmith-operations` is exempt from
those pins and is listed explicitly in `scripts/check-claude-contract.mjs`. To resynchronize, replace the
vendored `contract/` snapshot and lock together, rerun the three checks, and bump the plugin version.

The four shipped skill files match the pinned canonical 1.2 source lock (`contract/audit-export-1.2.lock.json`) at HTP merge `6c065c8327970b0773ba90f163f99a6e56e1e204` (PR 48). The checker requires parity with the pinned snapshot, without a sibling checkout. The 1.1 provider snapshot under `contract/provider-request-1.1/` is retained byte-for-byte as historical evidence; its shipped-skill equality check moved to the 1.2 pin because the shipped skills now carry the export section.

## HTP tool coverage

The skill folders name all 18 HTP tools the server exposes. Seventeen appear in `SKILL.md`
files. `hello_world_secured` appears only in `seo-review/references/data.md`, where it is
described as an authentication greeting. No `SKILL.md` uses it for data reads.

Tools named in `SKILL.md` files: `list_websites`, `get_website`, `create_website`, `update_website`,
`delete_website`, `set_website_ga4_property`, `set_website_business_location`,
`set_website_repository`, `request_website_report`, `website_saved_data`,
`website_audit_history`, `website_audit_detail`, `import_website_audit`,
`get_provider_connection`, `disconnect_provider`, `inspect_website_url`,
`website_repository_history`.

The profile additionally references `get_website_report_request` and `cancel_website_report_request` as gated lifecycle tools. Keyed submission and these references require capability discovery, a deployed compatible backend, and host verification; they are not baseline availability. Backend PR 45 is pinned at `48485a55773b1ca97e165a4715d343704270266e`.

## SEOsmith operations

Three modes are kept distinct. `node plugins/htp/bin/seosmith-ops.mjs modes` reports them.

| Mode | Status | Needs |
| --- | --- | --- |
| Local execution | Supported when a trusted adapter binary is configured | Absolute `SEOSMITH_BIN` (or `--binary`) whose `operations capabilities` reports `adapter_version` 1 and all five operations. No HTP account. |
| Configured private worker | Detected only; **not driven** by this package | Operator-only protected-network HTTP. The package never reads its token. |
| HTP-authorized orchestration | Gated | A signed-in session with deployed `request_website_report`, `get_website_report_request`, `cancel_website_report_request`; discovered per session. |

Local operations: `prepare`, `start`, `status`, `cancel`, `report`, `export`. Start is synchronous and bounded
(every bound explicit; 10-7200 s, 1-20000 pages); run it in the background and poll status. The helper uses
`execFile` with an argv array, a `PATH`-only environment and per-operation timeouts, validates requests before
launch, never auto-retries a mutation, and reports timeouts as uncertain. Unsupported, missing or
version-mismatched binaries are reported as unavailable; no other command is substituted. Unknown
`execution_state`, partial coverage, cancelled and failed runs are never presented as a clean audit.
Evidence v2, authorized staging and baseline CI are advertised false by adapter 1 and are not offered.

## Capability gates

| Capability | Status in this package |
| --- | --- |
| Saved-data reads (`seo-review`) | Available |
| Website management and bindings | Available |
| Repository settings | Available |
| HTP audit import and history | Available |
| SEOsmith explicit start, status, cancel, report, export (local) | Implemented; fixture and real-binary non-crawl tests pass, and the installed-package helper passed report content, byte-exact export and terminal cancellation on seeded stored state; a live crawl through a Claude session is **not yet accepted** |
| Standalone local SEOsmith audit | Same as above; needs a configured binary, no HTP account |
| Baseline-aware CI and staging profiles | Unsupported until a backend release ships them |
| Forms, orchestration, browser or AI workflows | Unsupported until backend releases ship them |

## Release criteria for closing htp-claude #1

Open until all hold with recorded live evidence: (1) real OAuth sign-in, reconnect and sign-out through `/mcp`
in an interactive session, plus a denied-website read that stays denied; (2) a live local SEOsmith
start/status/cancel/report/export through a Claude session with a trusted binary (bounded, isolated data);
the installed-package helper path on seeded data is already verified, so this gate is specifically the
live crawl and live-session invocation.
(3) deployed export-v1 and report-request tools discovered, then exercised; (4) two independent exact-head
reviews and merge by the integration owner; (5) tagged release for rollback. Gated skills for forms,
lifecycle, remediation, provider outcomes, browser/AI workflows and baseline CI are **not** shipped: no
backend release provides them, and a skill must not be added until discovery shows the tools.

## Checks

`scripts/check-claude-contract.mjs` uses only Node built-ins. It checks the manifest,
marketplace entry, MCP transport and URL, the absence of credentials and `sse` entries, each
skill's frontmatter, the HTP tool set, the absence of SEOsmith tools, and README install
steps. Every Markdown file under a skill folder, including `references/`, is scanned for SEOsmith
operations and for unknown tool names: `mcp__plugin_htp_htp__<name>` and tool-shaped backticked
identifiers. Run it with `node scripts/check-claude-contract.mjs`. Helper tests: `node --test scripts/test-seosmith-ops.mjs` (fixture binary; set `SEOSMITH_REAL_BIN` to also run the non-crawling real-adapter checks).

These checks validate the package's declared contract. They do not prove that a live
sign-in, a live tool call or a live SEOsmith operation works. Those need host smoke tests
against the deployed service.

The separate contract 1.2.0 audit-export readiness snapshot is offline evidence, distinct from package version 1.2.1. Its checks run with `node scripts/check-audit-export-readiness.mjs` (`--export-results PATH` accepts Claude measured results) and `node --test scripts/test-audit-export-readiness.mjs`. Complete audit export is gated: it requires discovered deployed `website_audit_export_start_v1`, `_chunk_v1` and `_close_v1` tools, a verified backend, and host acceptance. Small `website_audit_detail` results are unchanged; a large unsafe result returns `EXPORT_REQUIRED`, which Claude hosts must follow to the export workflow.

The separate contract 1.1.0 readiness snapshot is offline evidence, distinct from package version 1.2.1. Run `node scripts/check-provider-request-readiness.mjs` for synthetic traces or add `--provider-results PATH` for Claude results. Measured context and counters require independent provenance. Neither this check nor the source lock proves deployment, OAuth, live host normalization or lifecycle behavior; host issue #1 remains open. HTP lifecycle and SEOsmith host adapter live acceptance gates both remain in force.
