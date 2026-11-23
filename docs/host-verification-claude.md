# Claude host verification record (Wave 1)

Evidence kinds are kept separate. Nothing here is production verification.
The complete distribution command/result record is in
[the distribution acceptance report](distribution-acceptance-2026-11-23.md).

## Git distribution checks (Claude Code 2.1.331, 2026-11-23)

Used fresh isolated `CLAUDE_CONFIG_DIR` and XDG profiles, an unrelated scratch
working directory, no inherited credentials, disabled SSH fallback, and only
non-inference plugin-management commands. No login, MCP calls, model sessions,
audits, release tags or user-profile edits were performed. The first missing-tag
probe attempted the host's SSH fallback and failed host-key verification before
authentication; SSH was disabled for subsequent commands.

| Evidence | Result |
| --- | --- |
| Canonical GitHub `marketplace add hatchertechnology/htp-claude`, install, list, uninstall and marketplace remove | Passed at main/PR5 merge `4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43`, package 1.2.0. |
| Canonical `marketplace update htp`, then `plugin update htp@htp` | Passed with "already at the latest version (1.2.0)". Main did not change; **no upgrade transition**. |
| Canonical historical branch selection and reinstall | Passed at `@wave0/claude-export-readiness`, observed SHA `e090c94d7fb11a187b329cb116343c19a29bca7e`, package 1.1.0. This is a mutable branch, not a release tag. |
| Canonical exact commit selection | `marketplace add hatchertechnology/htp-claude@e090c94d7fb11a187b329cb116343c19a29bca7e` and install passed. Installed registry recorded exactly that SHA and 1.1.0. |
| Documented `@v1.1.0` rollback | Failed: ref absent. `git ls-remote` advertised no upstream tags. No release-tag rollback accepted. |
| Re-add a different ref while `htp` is already declared | Rejected as a source mismatch with `extraKnownMarketplaces`, in both main-to-branch and branch-to-main directions. |
| Remove `htp` marketplace with its plugin still installed | Also uninstalled the plugin and warned of local options/secrets/data deletion. A subsequent `plugin update` failed because htp was no longer installed; reinstall was required. |
| Actual in-place 1.1.0 → 1.2.0 update | Passed against a labeled loopback **smart-Git controlled mirror** using unmodified exact commits above. `installedAt` stayed unchanged and the resulting registry SHA was the PR5 merge. This is controlled transition evidence, not canonical-main advancement or session reload evidence. |

Use the reviewed source-switch procedure and installed-revision check in
[compatibility](compatibility-claude.md#rollback-and-existing-marketplace-settings).
Removing a marketplace can affect every plugin installed from it. It is not a
data-preserving operation; server-side preservation and retained sign-in were
not verified. Pre-existing project/managed declarations require their owner's
supported configuration path. The isolated checks preserved an unrelated fixture
package, its registry entry, an unrelated setting and sentinel file hashes; that
does not establish preservation of the removed plugin's local state.

The controlled mirror advanced only a local branch from
`e090c94d7fb11a187b329cb116343c19a29bca7e` to
`4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43`; it created no release tags or
package edits. Its loopback HTTP server was stopped after testing. All other
live-host and release gates below remain open.

## Real host checks (Claude Code 2.1.330, isolated `CLAUDE_CONFIG_DIR`, local-directory marketplace)

- `claude plugin validate .` and `claude plugin validate ./plugins/htp`: passed.
- `claude plugin marketplace add <repo path>`, `install htp@htp`, `list`, `marketplace update htp`, `update htp@htp`,
  `uninstall htp@htp`, `marketplace remove htp`: all succeeded. A local-directory marketplace is read in place, so
  `update` reported "nothing to update"; it did not exercise a version change.

## Not verified (open)

- **Published release-tag rollback and an upgrade driven by canonical-main advancement.**
  Canonical install and commit-selected reinstall and the controlled two-version
  update are verified above. Earlier `file://` and dumb-HTTP failures do not apply
  to the successful smart-Git mirror. No previous release tag existed at testing;
  the immutable historical commit is supported but is not a tagged release.
- Minimum supported Claude Code version. Tested 2.1.330 and 2.1.331 lifecycle
  checks do not establish a minimum.
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
