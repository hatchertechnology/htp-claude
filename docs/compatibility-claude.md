# Claude Code compatibility

This page is the Claude Code host contract for the `htp` plugin. It records what is
supported today, what was tested, and what is not yet available. It is Wave 0
readiness documentation for the shared plugin contract (HTP #34). It is not a
release, and it does not complete host issue htp-claude #1, which stays open.

## Tested baseline

| Item | Value |
| --- | --- |
| Claude Code tested | 2.1.325 |
| Minimum version | Not yet verified. Do not rely on a minimum until it is tested. |
| Plugin version | 1.1.0 (`plugins/htp/.claude-plugin/plugin.json`, matches the marketplace entry) |
| Install id | `htp@htp` (plugin `htp`, marketplace `htp`) |
| Validation | `claude plugin validate ./plugins/htp` and `claude plugin validate .` pass |

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

Upgrade and rollback commands are **not yet verified** against the tested version and are
not documented here. The upgrade path must be checked before it is advertised. The plugin
version in `plugin.json` and the marketplace entry must always match; the validator checks
the manifest, and the contract checker checks the match.

## Skills

Skills are the default `skills/` scan in the plugin root. Each is a `<name>/SKILL.md` folder
with `name` and `description` frontmatter, and `name` equals its folder name.

| Skill | Operations |
| --- | --- |
| `seo-review` | Reads saved HTP evidence: website list, saved data, repository history, audit history and detail. Reads never start collection. |
| `website-management` | Website CRUD, GA4 and Business Profile bindings, report requests, provider status, indexed URL inspection, audit import. |
| `repository-settings` | Attach, pause or remove a website's public repository. |

The four shipped skill files match the pinned canonical 1.1 source lock at HTP merge `e19875d0d6e74b5d990e45e456656c99dacc89d1`. The checker requires parity with the pinned snapshot, without a sibling checkout.

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

**None are available in this package.** The plugin has no SEOsmith start, status, cancel,
report or export operation. The only SEOsmith-related operations are HTP's stored audit
history, detail and import, which read or write saved HTP evidence. They do not start a
crawl.

SEOsmith operations are gated on the shared SEOsmith operation adapter (seosmith #18).
Until that adapter exists, the Claude package must not advertise them, and a skill must not
claim them.

## Capability gates

| Capability | Status in this package |
| --- | --- |
| Saved-data reads (`seo-review`) | Available |
| Website management and bindings | Available |
| Repository settings | Available |
| HTP audit import and history | Available |
| SEOsmith explicit start, status, cancel, report, export | Unsupported until seosmith #18 |
| Standalone local SEOsmith audit | Unsupported until seosmith #18 |
| Baseline-aware CI and staging profiles | Unsupported until a backend release ships them |
| Forms, orchestration, browser or AI workflows | Unsupported until backend releases ship them |

## Checks

`scripts/check-claude-contract.mjs` uses only Node built-ins. It checks the manifest,
marketplace entry, MCP transport and URL, the absence of credentials and `sse` entries, each
skill's frontmatter, the HTP tool set, the absence of SEOsmith tools, and README install
steps. Every Markdown file under a skill folder, including `references/`, is scanned for SEOsmith
operations and for unknown tool names: `mcp__plugin_htp_htp__<name>` and tool-shaped backticked
identifiers. Run it with `node scripts/check-claude-contract.mjs`.

These checks validate the package's declared contract. They do not prove that a live
sign-in, a live tool call or a live SEOsmith operation works. Those need host smoke tests
against the deployed service.

The separate contract 1.1.0 readiness snapshot is offline evidence, distinct from package version 1.1.0. Run `node scripts/check-provider-request-readiness.mjs` for synthetic traces or add `--provider-results PATH` for Claude results. Measured context and counters require independent provenance. Neither this check nor the source lock proves deployment, OAuth, live host normalization or lifecycle behavior; host issue #1 remains open. HTP lifecycle and SEOsmith adapter gates both remain in force.
