# Claude host verification record (Wave 1)

Evidence kinds are kept separate. Nothing here is production verification.

## Real host checks (Claude Code 2.1.330, isolated `CLAUDE_CONFIG_DIR`, local-directory marketplace)

- `claude plugin validate .` and `claude plugin validate ./plugins/htp`: passed.
- `claude plugin marketplace add <repo path>`, `install htp@htp`, `list`, `marketplace update htp`, `update htp@htp`,
  `uninstall htp@htp`, `marketplace remove htp`: all succeeded. A local-directory marketplace is read in place, so
  `update` reported "nothing to update"; it did not exercise a version change.

## Not verified (open)

- **Version-to-version upgrade (1.1.0 to 1.2.0) and tag rollback.** `file://` and dumb-HTTP git sources were rejected or
  failed in the host, so the documented upgrade/rollback commands come from CLI help and are unverified end to end.
  Verify against the published GitHub marketplace after release.
- `${CLAUDE_PLUGIN_ROOT}` substitution inside `SKILL.md` text in a live session (no live skill invocation was run).
- Interactive OAuth sign-in, reconnect, sign-out, auth expiry and denied-website behavior (needs a browser session).
- A live SEOsmith crawl through a Claude session. Real-adapter tests cover capabilities and rejection paths only and never
  start a crawl (`SEOSMITH_REAL_BIN=<path> node --test scripts/test-seosmith-ops.mjs`, run against a locally built seosmith
  debug binary reporting adapter_version 1).
- Deployed export-v1 and report-request tool discovery and use.

## Fixture tests (synthetic, not production evidence)

`scripts/test-seosmith-ops.mjs` uses a fixture binary to prove helper behavior: binary resolution, capability gating,
request bounds, argv-only execution without a shell, PATH-only environment (no credentials), no automatic retry,
uncertain timeouts, unknown execution state, non-terminal cancellation, partial reports, export receipts, the offline
missing-binary envelope and mode reporting.
