---
name: seosmith-operations
description: Use when the user wants to explicitly start, check, cancel, retrieve or export a bounded SEOsmith technical SEO audit, run a standalone local audit without an HTP account, or asks which SEOsmith modes (local, private worker, HTP orchestration) are available.
---

# Operate SEOsmith explicitly

This skill is host-specific and is not part of the shared pinned skill set. It drives
the SEOsmith **local operations adapter** (adapter_version 1) through the plugin helper
`${CLAUDE_PLUGIN_ROOT}/bin/seosmith-ops.mjs`. Never build SEOsmith shell commands yourself,
never run `seosmith crawl` or `serve` as a substitute, and never invent a public worker
endpoint. Reading saved HTP audits (`website_audit_history`, `website_audit_detail`) is a
separate read-only workflow and never starts a crawl.

## 1. Discover the mode before promising anything

Run `node "${CLAUDE_PLUGIN_ROOT}/bin/seosmith-ops.mjs" modes`. It reports three modes:

- **Local execution** — needs an operator-installed SEOsmith binary at an absolute path in
  `SEOSMITH_BIN`. No HTP account, no network access to HTP. Available only if `local.available`
  is true. If false, tell the user the `reason` (missing binary, unsupported adapter version,
  timeout) and stop; do not guess a path or search the working directory.
- **Configured private worker** — operator-only HTTP access on a protected network. The helper
  only reports whether `SEOSMITH_WORKER_URL` is set. This package does not drive it, and you must
  not ask for or handle its bearer token.
- **HTP-authorized orchestration** — needs a signed-in HTP session with deployed
  `request_website_report`, `get_website_report_request` and `cancel_website_report_request`
  tools. Discover them in the session; if absent, say the mode is unavailable. A website ID you
  are given is never authorization; HTP decides ownership. Use the `website-management` skill.

Capability flags are authoritative. `advanced.evidence_v2`, `authorized_staging` and
`ci_baseline` are false in adapter version 1: do not offer evidence v2, staging profiles or
baseline-aware CI, and do not pass flags the adapter does not advertise.

## 2. Start one explicit, bounded audit (local mode)

Confirm with the user: the exact seed URL (no credentials, query, fragment or custom port; scope is
the exact host), pages, resources, duration (10–7200 s), delay (1000–60000 ms) and whether to check
external links. Every bound is required; there are no defaults. Then:

1. `seosmith-ops.mjs prepare --root <absolute private dir> --url … --pages N --resources N --duration S --delay-ms MS`
   creates a 0700 audit directory, a 0600 request and a fresh request ID and database.
2. `seosmith-ops.mjs start --database <database> --request <request>` is synchronous. Run it with the
   Bash tool's background option, because a crawl can last up to its duration bound.
3. Poll `status --database … --id …` from a separate invocation at a bounded interval.

A new intended audit needs a fresh `prepare`. Retry only the exact same request file after an
uncertain start (for example a helper timeout); it returns existing status and never re-crawls.
Never retry with a new ID automatically.

## 3. Interpret status honestly

- `execution_state: unknown` means a queued/running record has no live worker (for example a killed
  process). Report it as interrupted or unknown, not as complete or running.
- `partial`, `failed`, `cancelled`, a missing report or zero findings are **not** a clean audit.
- `delivery_state: disabled` is independent of crawl completion. Local audits are not sent to HTP.
- Error `kind: timeout` has an uncertain outcome. Query `status` before saying anything else.

## 4. Cancel, retrieve and export

- `cancel` only when asked. an accepted cancellation is not termination: report the run as stopped only
  when `cancellation_terminal` is true; otherwise poll `status`.
- `report` returns the exact retained report. Keep `schema_version`, `outcome`, `stop_reason`,
  `coverage_complete` and partial coverage visible. Unavailable or oversized reports (16 MiB limit)
  are failures, not empty audits.
- `export --output <new absolute file>` writes to a path that must not exist and returns a byte
  count and SHA-256. An export without that receipt is not verified.

## 5. Failure handling

Helper output is JSON with `ok`. On `ok: false`, relay `error.kind` and `message` plainly:
`missing_binary`, `unsupported_adapter`, `unsupported_command` (do not substitute another command),
`invalid_request` (fix the bounds), `operation_failed` with `reason` (for example `run_not_found`,
`report_unavailable`, `database_scope_conflict_use_fresh_database`), `timeout`, `bad_output`.
If the machine is offline the local mode still works; HTP mode will report needing sign-in or being
disconnected, which must not be presented as an empty result.

Never place credentials in URLs, request files, arguments or chat. Retained reports can contain customer
evidence; filesystem permissions are the local authorization boundary.
