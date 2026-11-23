# Wave 1 — htp-claude #1 remaining distribution acceptance

Owner: t3mc, reported to t2wc. Performed 2026-11-23, approximately 22:41–22:46 UTC.

## Follow-up: verified documentation and exact-SHA rollback

Assigned by t2wc after the initial report; source branch `wave1/claude-verified-distribution`, base PR5 merge `4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43`. Changed documentation only: compatibility procedure, host verification and a verbatim copy of this task report at `docs/distribution-acceptance-2026-11-23.md` for both reviewers. Package content/version unchanged.

Fresh temporary profile root: `/mnt/storage/worktrees/htp-claude-sha-12hp_c6t` (independent cwd/profile/XDG directories; the same credential-free environment as the initial run, with SSH disabled before the first Git command). No real user profile was changed.

**Exact immutable commit selection is supported on Claude Code 2.1.331.** This canonical command exited 0:

```sh
claude plugin marketplace add hatchertechnology/htp-claude@e090c94d7fb11a187b329cb116343c19a29bca7e
claude plugin install htp@htp
claude plugin list --json
```

List reported enabled package 1.1.0, and `profile/plugins/installed_plugins.json` recorded `gitCommitSha=e090c94d7fb11a187b329cb116343c19a29bca7e`. Thus the documented procedure now uses the full immutable SHA; the earlier historical branch test remains explicitly mutable evidence, and absent `v1.1.0` remains a failed release-tag rollback.

The complete user-scope source-switch procedure was then exercised against canonical GitHub, all commands exit 0:

1. Uninstall htp; remove its marketplace; add canonical main; install and disable htp. Registry verified 1.2.0 at `4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43`.
2. Uninstall htp; remove its marketplace; add the full historical SHA above; install and disable htp; list confirmed `enabled:false`, 1.1.0.
3. Extract and execute the **exact Python revision-check snippet** from `docs/compatibility-claude.md` in that temporary environment. It printed `Verified htp 1.1.0 at e090c94d7fb11a187b329cb116343c19a29bca7e`, exit 0.
4. Enable htp; list confirmed `enabled:true`, 1.1.0. No Claude session or MCP operation was started.
5. Uninstall htp; remove the marketplace; list returned `[]`. Temporary target profile finished empty.
6. `claude plugin validate /mnt/storage/worktrees/w1-claude-distribution` and `claude plugin validate /mnt/storage/worktrees/w1-claude-distribution/plugins/htp` both exited 0. Plugin validation retained existing `ICON_MISSING` and `PRIVACY_URL_MISSING` directory-listing warnings; it also reports that skills/bin network hosts are not inferred. No listing or network declaration changes were made.

The docs explicitly describe pre-existing source declarations, source-scope ownership, all-packages effects of marketplace removal, and possible deletion of local options/secrets/data. They make no local-state, sign-in or server-data preservation guarantee. Project/managed declaration migration is not represented as tested. Verify installed commit/version while disabled before enabling; version equality alone is insufficient. Host registry SHA verification is documented as observed 2.1.331 behavior, not a portable minimum-host contract.

Package checks on this documentation change: `node scripts/check-claude-contract.mjs`, `node scripts/check-provider-request-readiness.mjs`, and `node scripts/check-audit-export-readiness.mjs` all exited 0. `node --test scripts/test-provider-request-readiness.mjs scripts/test-audit-export-readiness.mjs scripts/test-seosmith-ops.mjs` exited 0: **39 tests, 38 pass, 0 fail, 1 skip** (optional real-binary check; `SEOSMITH_REAL_BIN` deliberately unset). These remain offline/fixture checks; no live audit was run. Both host validators above passed on 2.1.331. `git diff --check` passed.

Raw additional evidence: `results.jsonl` (five initial exact-SHA probe commands), `switch-results.jsonl` (19 source-switch/check/cleanup/validation commands), and `checks.log` in the fresh temporary root. No new tags, model calls, subagents, audits or user-profile edits.

## Verdict

Canonical exact-commit reinstall rollback **PASS** in the follow-up above, without establishing a tagged release. Canonical public GitHub marketplace install/list/uninstall **PASS** on **Claude Code 2.1.331**. Canonical unchanged-main refresh **PASS, no version transition**. A genuine canonical 1.2.0 → 1.1.0 rollback **by uninstall/source removal/branch-selected reinstall** passes, followed by reinstall of 1.2.0. The documented tag rollback **FAILS**: `v1.1.0` does not exist, and re-adding an already-declared marketplace from a different ref is rejected. A genuine **in-place 1.1.0 → 1.2.0 update PASS** is separately demonstrated against a labeled loopback controlled mirror because canonical main cannot be advanced for this test. No tagged rollback or production rollout accepted; #1 must remain open for its other host/release gates.

## Scope and isolation

Read `/mnt/storage/projects/hatchtechplatform/AGENTS.md`, prior `coordination/tasks/wave1-claude-host.md`, merged PR5 docs and manifests. No AGENTS.md exists in this checkout or its directory ancestors. Worktree HEAD is the merged PR5 SHA below; source checkout left unchanged. Used herdr-core (`hc --skill`) only to run non-agent test programs/server and relay to t2wc; no new agents.

Scratch root: `/tmp/htp-claude-distribution-67y2jn3m`. Canonical profile `profile/`; mirror profile `mirror-profile/`; independent scratch cwd `cwd/`, outside any project configuration. These are newly created, not copies of a user profile. `CLAUDE_CONFIG_DIR` and `XDG_CONFIG_HOME` point only inside scratch. Child environment is constructed from scratch, with PATH, those two paths, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_AUTOUPDATER=1`. No HOME variable override, inherited auth/session variables, login, credential injection, model invocation, MCP invocation, audits or release tags. `claude --version`, CLI help and `claude plugin marketplace ...`, `plugin install/list/update/uninstall` only; never an interactive Claude session or `-p`, eval/test, login or model command.

On the failed missing-tag test, the host attempted its own SSH fallback after HTTPS reported the absent ref; SSH failed host-key verification before authentication. No host-key acceptance or login was attempted. `GIT_SSH_COMMAND=false` was then added for subsequent commands. No user-profile edits or secrets supplied/read by the test harness. Model quota was not exercised. Listed MCP declarations are manifest data, not server connections or discovery.

## Exact refs and supported host

- Host installed and tested here: `claude --version` → `2.1.331 (Claude Code)`. This is an observed supported CLI lifecycle version, not a newly proven minimum. Previous evidence covers 2.1.330; minimum remains unverified.
- Canonical repository: `https://github.com/hatchertechnology/htp-claude.git`.
- `HEAD` and `refs/heads/main`: **4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43** (PR5 merge), package **1.2.0**.
- Canonical `refs/heads/wave0/claude-export-readiness`: **e090c94d7fb11a187b329cb116343c19a29bca7e**, package **1.1.0**. This is an existing movable development branch, not a released or immutable rollback tag. Its SHA was observed both in `git ls-remote --heads` and the host-installed plugin registry.
- Historical parent merge `6ba95cfd0683cc1a256ac43ca8d2b848fb0d32ca` also has manifest 1.1.0; not used for successful installation.
- `git ls-remote https://github.com/hatchertechnology/htp-claude.git HEAD refs/heads/main 'refs/tags/*'` returned HEAD/main above and **no tags**. No refs were created or changed upstream.

## Canonical results

All commands below inherit the isolated environment described above. Default user scope means the temporary profile, not the user's real profile.

```sh
claude plugin marketplace add hatchertechnology/htp-claude
claude plugin install htp@htp
claude plugin list --json
claude plugin marketplace update htp
claude plugin update htp@htp
claude plugin list --json
```

All exit 0. Installed enabled `htp@htp` 1.2.0 at `profile/plugins/cache/htp/htp/1.2.0`; installed registry `gitCommitSha` is 4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43. Update says `htp is already at the latest version (1.2.0).` This is explicitly **not** upgrade evidence.

`claude plugin marketplace add hatchertechnology/htp-claude@v1.1.0` exits 1: `fatal: Remote branch v1.1.0 not found in upstream origin`. The currently installed 1.2.0 remained listed afterwards.

After uninstalling htp and removing its marketplace, adding `hatchertechnology/htp-claude@wave0/claude-export-readiness` and installing htp succeeded. List reported 1.1.0; installed registry recorded e090c94d7fb11a187b329cb116343c19a29bca7e. This is a genuine **two-version reinstall rollback**, using the canonical Git source.

Re-adding main while the historical ref was registered exits 1:

> Cannot add marketplace "htp": its source doesn't match its extraKnownMarketplaces entry in user or managed settings; add it from the source that entry lists, or change the entry.

The reverse change (main registered, then add historical branch) produced the same failure. Thus the docs' instruction to simply re-add the previous ref before uninstalling is insufficient on this host, independently of the missing tag.

Removing marketplace `htp` while its plugin was installed exited 0 and also uninstalled htp. The host printed:

> The removal also deletes their saved options, secrets and data where it can.

Adding main again succeeded, but `plugin update htp@htp` then exited 1 because it was no longer installed. `plugin install htp@htp` succeeded and listed 1.2.0. This is a reinstall, **not an in-place update**.

## Verified ref-switch procedure and limits

The following CLI-only sequence worked against canonical branches, from installed 1.2.0 to installed 1.1.0:

```sh
claude plugin uninstall htp@htp
claude plugin marketplace remove htp
claude plugin marketplace add hatchertechnology/htp-claude@wave0/claude-export-readiness
claude plugin install htp@htp
claude plugin list --json
```

To return, uninstall htp, remove htp marketplace, add `hatchertechnology/htp-claude`, install and list. For a released rollback, replace the development branch with a **published, verified previous release ref**; none currently exists. Do not call the branch test a tag rollback. Source replacement requires removing the previous declaration; do not edit real profile JSON to bypass source protection. The host warns that marketplace removal deletes associated local data. Server-side data preservation is not tested by these CLI-only runs; no server was contacted. Preserve any desired target-plugin local data using a separately established backup procedure before applying removal to a real profile. This run only used disposable target-plugin state.

## Controlled mirror: genuine in-place upgrade only

A bare mirror was created under scratch from the checkout's existing objects. No manifests, skills, or package versions were rewritten, and no commits or tags were created. Only local branch refs were controlled:

```sh
git init --bare /tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git
git push /tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git \
  e090c94d7fb11a187b329cb116343c19a29bca7e:refs/heads/main \
  e090c94d7fb11a187b329cb116343c19a29bca7e:refs/heads/controlled-old
git --git-dir=/tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git symbolic-ref HEAD refs/heads/main
```

A scratch Python HTTP handler bound **127.0.0.1:55891 only**, invoking `/usr/libexec/git-core/git-http-backend` for smart Git fetches. It provided a controlled Git source, not a local-directory marketplace or dumb HTTP file server.

In independent `mirror-profile/`:

```sh
claude plugin marketplace add http://127.0.0.1:55891/controlled-mirror.git
claude plugin install htp@htp
claude plugin list --json                         # 1.1.0
git push /tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git \
  4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43:refs/heads/main
claude plugin marketplace update htp
claude plugin update htp@htp
claude plugin list --json                         # 1.2.0
```

All exit 0. Host explicitly printed `Plugin "htp" updated from 1.1.0 to 1.2.0 for scope user. Restart to apply changes.` `installedAt` stayed `2026-11-23T22:44:36.684Z`; `lastUpdated` became `2026-11-23T22:44:48.213Z`; final installed registry recorded merge SHA 4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43. **This proves the CLI transition on exact repository versions via controlled smart Git, not that canonical main advanced, nor that a running model session reloaded it.** Canonical rollback was already covered, so no synthetic release tag was needed.

Bounded exploratory failures: `git daemon` is unavailable in this environment and `git://...` is rejected as an invalid marketplace source. A `.git@controlled-old` HTTP URL is treated as a literal download URL and failed 404, not as GitHub-style ref syntax; the subsequent install failed because no htp marketplace existed. Those are failed probes, not rollback evidence. An exploratory GitHub `#v1.1.0` spelling was interrupted before completion; no result is claimed. These failures did not affect the successful smart-HTTP upgrade or canonical branch rollback.

## Preservation and cleanup

Installed an inert, no-MCP `keep@distribution-keep` 9.8.7 from a separate scratch local marketplace before canonical rollback/removal tests. Kept unrelated `alwaysThinkingEnabled:false`, a profile sentinel, and an unrelated plugin-data sentinel. After final htp uninstall and marketplace removal:

- `keep@distribution-keep` remained enabled at 9.8.7; its complete installed-registry entry (including timestamps/path) was unchanged.
- Its cached manifest and both sentinel files had byte-identical SHA-256 values before and after; the unrelated setting remained false.
- Profile sentinel SHA-256: `14267d9ff31fd0cf9e85fc2bf48edf011df9728a71f19817fcead26cd216a9f2`.
- Unrelated data sentinel SHA-256: `635658aa212ca2759ddf72f9ed12c2045391b32e0b545d9ed395dafd9b9913b6`.
- Unrelated cached manifest SHA-256: `f0d83c4d24b249e2548225f9046414829226166b67d599bc98a1b6f5d49e8dd9`.
- Independent mirror profile likewise retained its unrelated fixture package, same install timestamp and version, throughout the upgrade and final htp cleanup.

Both temporary profiles finish with only the unrelated fixture installed and htp marketplace removed. Temporary smart-HTTP server stopped; `ss -ltn 'sport = :55891'` shows no listener. No unrelated terminals/processes were touched. Scratch profiles and fixture data retained as evidence, not recursively deleted. Repository worktree is unchanged. Raw temporary command ledger: `/tmp/htp-claude-distribution-67y2jn3m/commands.jsonl`; runner/server scripts and preservation snapshots are in the same directory. The durable command/result ledger follows so findings do not depend on scratch survival.

## Remaining acceptance limits / coordinator action

Correct the rollback documentation to account for source-declaration removal and local data deletion; publish/verify a release ref under coordinator authorization before claiming tag rollback. User forbids release tags in this task, so none were created. Minimum host version, interactive reload/root substitution, OAuth lifecycle, denied-site behavior, tool discovery, live SEOsmith operations and production release remain outside this non-inference task. No external issue/PR messages or live audits were performed.

## Durable command/result ledger

All rows are actual completed subprocess results (CLI help/version and setup are described above). Rows 1–29 use the canonical profile; rows 30–47, 49–50, 52 and 54–55 use the mirror profile; rows 48, 51 and 53 are concurrent final canonical cleanup. Repeated identical commands are retained. The interrupted `#` probe has no completed row. Known negative probes intentionally continue to gather independent evidence; Python wrapper exit 0 is not used as a blanket pass criterion.

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `git ls-remote https://github.com/hatchertechnology/htp-claude.git HEAD refs/heads/main 'refs/tags/*'` | 0 | success |
| 2 | `claude plugin marketplace add hatchertechnology/htp-claude` | 0 | success |
| 3 | `claude plugin install htp@htp` | 0 | success |
| 4 | `claude plugin list --json` | 0 | htp@htp=1.2.0 |
| 5 | `claude plugin marketplace update htp` | 0 | success |
| 6 | `claude plugin update htp@htp` | 0 | already at latest 1.2.0; no transition |
| 7 | `claude plugin list --json` | 0 | htp@htp=1.2.0 |
| 8 | `claude plugin marketplace add /tmp/htp-claude-distribution-67y2jn3m/unrelated-marketplace` | 0 | success |
| 9 | `claude plugin install keep@distribution-keep` | 0 | success |
| 10 | `claude plugin marketplace add hatchertechnology/htp-claude@v1.1.0` | 1 | Adding marketplace…✘ Failed to add marketplace: Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/hatchertechnology/htp-claude.git): Failed to clone marketplace repository: Cloning into '/tmp/htp-claude-distribution-67y2jn3m/profile/plugins/marketplaces/hatchertechnology-htp-claude..clone'... |
| 11 | `claude plugin list --json` | 0 | htp@htp=1.2.0, keep@distribution-keep=9.8.7 |
| 12 | `claude plugin uninstall htp@htp` | 0 | success |
| 13 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 14 | `claude plugin marketplace remove htp` | 0 | success |
| 15 | `claude plugin marketplace add hatchertechnology/htp-claude@wave0/claude-export-readiness` | 0 | success |
| 16 | `claude plugin install htp@htp` | 0 | success |
| 17 | `claude plugin list --json` | 0 | htp@htp=1.1.0, keep@distribution-keep=9.8.7 |
| 18 | `claude plugin marketplace add hatchertechnology/htp-claude` | 1 | Adding marketplace…✘ Failed to add marketplace: Cannot add marketplace "htp": its source doesn't match its extraKnownMarketplaces entry in user or managed settings; add it from the source that entry lists, or change the entry. |
| 19 | `claude plugin marketplace list` | 0 | success |
| 20 | `claude plugin list --json` | 0 | htp@htp=1.1.0, keep@distribution-keep=9.8.7 |
| 21 | `claude plugin marketplace remove htp` | 0 | removed marketplace AND htp; local data deletion warning |
| 22 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 23 | `claude plugin marketplace add hatchertechnology/htp-claude` | 0 | success |
| 24 | `claude plugin update htp@htp` | 1 | ✘ Failed to update plugin "htp@htp": Plugin "htp" is not installed |
| 25 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 26 | `claude plugin install htp@htp` | 0 | success |
| 27 | `claude plugin list --json` | 0 | htp@htp=1.2.0, keep@distribution-keep=9.8.7 |
| 28 | `claude plugin marketplace add hatchertechnology/htp-claude@wave0/claude-export-readiness` | 1 | Adding marketplace…✘ Failed to add marketplace: Cannot add marketplace "htp": its source doesn't match its extraKnownMarketplaces entry in user or managed settings; add it from the source that entry lists, or change the entry. |
| 29 | `claude plugin list --json` | 0 | htp@htp=1.2.0, keep@distribution-keep=9.8.7 |
| 30 | `claude plugin marketplace add /tmp/htp-claude-distribution-67y2jn3m/unrelated-marketplace` | 0 | success |
| 31 | `claude plugin install keep@distribution-keep` | 0 | success |
| 32 | `claude plugin marketplace add git://127.0.0.1:55891/controlled-mirror.git` | 1 | ✘ Invalid marketplace source format. Try: owner/repo, https://..., or ./path |
| 33 | `claude plugin install htp@htp` | 1 | Installing plugin "htp@htp"...✘ Failed to install plugin "htp@htp": Plugin "htp" not found in marketplace "htp". Your local copy may be out of date — try `claude plugin marketplace update htp`. |
| 34 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 35 | `git -C /mnt/storage/worktrees/w1-claude-distribution push /tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git 4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43:refs/heads/main` | 0 | success |
| 36 | `claude plugin marketplace add /tmp/htp-claude-distribution-67y2jn3m/unrelated-marketplace` | 0 | success |
| 37 | `claude plugin install keep@distribution-keep` | 0 | success |
| 38 | `claude plugin marketplace add http://127.0.0.1:55891/controlled-mirror.git` | 0 | success |
| 39 | `claude plugin install htp@htp` | 0 | success |
| 40 | `claude plugin list --json` | 0 | htp@htp=1.1.0, keep@distribution-keep=9.8.7 |
| 41 | `git -C /mnt/storage/worktrees/w1-claude-distribution push /tmp/htp-claude-distribution-67y2jn3m/controlled-mirror.git 4922bb175a8d2f2fa1c777b3dfb9cfcd7a907f43:refs/heads/main` | 0 | success |
| 42 | `claude plugin marketplace update htp` | 0 | success |
| 43 | `claude plugin update htp@htp` | 0 | actual 1.1.0 → 1.2.0; restart required |
| 44 | `claude plugin list --json` | 0 | htp@htp=1.2.0, keep@distribution-keep=9.8.7 |
| 45 | `claude plugin uninstall htp@htp` | 0 | success |
| 46 | `claude plugin marketplace remove htp` | 0 | success |
| 47 | `claude plugin marketplace add http://127.0.0.1:55891/controlled-mirror.git@controlled-old` | 1 | Adding marketplace…✘ Failed to add marketplace: HTTP 404 error while downloading marketplace from http://127.0.0.1:55891/controlled-mirror.git@controlled-old. The marketplace file may not exist at this URL. |
| 48 | `claude plugin uninstall htp@htp` | 0 | success |
| 49 | `claude plugin install htp@htp` | 1 | Installing plugin "htp@htp"...✘ Failed to install plugin "htp@htp": Plugin "htp" not found in marketplace "htp". Your local copy may be out of date — try `claude plugin marketplace update htp`. |
| 50 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 51 | `claude plugin marketplace remove htp` | 0 | success |
| 52 | `claude plugin uninstall htp@htp` | 1 | ✘ Failed to uninstall plugin "htp@htp": Plugin "htp@htp" not found in installed plugins |
| 53 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
| 54 | `claude plugin marketplace remove htp` | 1 | ✘ Failed to remove marketplace: Marketplace 'htp' not found |
| 55 | `claude plugin list --json` | 0 | keep@distribution-keep=9.8.7 |
