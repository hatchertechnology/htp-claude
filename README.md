# htp-claude

HTP plugin for Claude Code, distributed as a plugin marketplace.

## Install

Add the marketplace, then install the plugin. The install id is `<plugin>@<marketplace>`,
and both names are `htp`:

```
/plugin marketplace add hatchertechnology/htp-claude
/plugin install htp@htp
```

From a shell, the same steps are `claude plugin marketplace add hatchertechnology/htp-claude`
and `claude plugin install htp@htp`. Compatibility, tested versions and rollback are in
[docs/compatibility-claude.md](docs/compatibility-claude.md).

## Connect

The plugin registers the `htp` MCP server
(`https://htp-api-kerry-hatcher.fly.dev/mcp/secured`). Run `/mcp`, select
`plugin:htp:htp`, and complete the browser OAuth sign-in. No credentials are
stored in the plugin.

## Skills

- `seo-review` — review saved SEO and performance evidence, compare domains, prioritize fixes
- `website-management` — add, rename or delete websites; GA4 and Business Profile bindings; Seosmith audits
- `repository-settings` — attach, pause or remove a website's public GitHub repository
- `seosmith-operations` — explicit, bounded SEOsmith start/status/cancel/report/export via a locally configured binary (`SEOSMITH_BIN`); no HTP account needed. Gated and mode-aware; see compatibility.

The four shared skill files are checked against the pinned HTP 1.2 source snapshot (complete audit export, contract 1.2.0). Run `node scripts/check-claude-contract.mjs`, `node scripts/check-provider-request-readiness.mjs` and `node scripts/check-audit-export-readiness.mjs`; the export tests are `node --test scripts/test-audit-export-readiness.mjs`. This is offline readiness only: provider lifecycle use requires backend capability and live host verification; local SEOsmith operations are implemented but a live Claude-session crawl is not yet accepted. Host issue #1 remains open. See [compatibility](docs/compatibility-claude.md) for limits.

## License

MIT
