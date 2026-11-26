# Owner-attended acceptance for the Claude package (R5 and owner items)

These checks need the owner's sign-in, a second identity, production, or a live crawl. They are **prepared, not run**,
by the package author. Nothing here is evidence until the owner records it. Use identifiable, bounded test data and
never paste tokens, cookies or customer data into a report.

## 0. Before R5 (read-only)

1. Re-read the owner's installed state: `plugins/installed_plugins.json` `htp@htp` should be version 1.1.0 at
   `0c0fba9414109ed3991d5bfdbaf71195e0eee621`. If it differs, stop and re-derive the rollback target.
2. Create the baseline tags on the exact SHAs (`v1.1.0` at `0c0fba94…`, `v1.2.2` at `6f4dd3232bb4…`) and verify each against the
   manifest version at that commit. The release tag `v1.3.0` goes on the merged release commit only after the reviewed head
   passes `node scripts/check-claude-contract.mjs` and the tests listed in the compatibility page.

## 1. Isolated install of the published tag (no owner profile touched)

```
node scripts/prepare-owner-acceptance-claude.mjs --root <new dir> --ref v1.3.0
```

It installs `htp@htp` from GitHub at the tag into a fresh profile, checks the registry SHA, version 1.3.0 and the
`engines` floor, and writes `results.template.json`. It makes no HTP call.

## 2. Interactive checks in that profile

| # | Check | How | Pass when |
| --- | --- | --- | --- |
| 1 | Sign-in | `/mcp`, select `plugin:htp:htp`, complete the browser OAuth | The server shows connected; `list_websites` returns the owner's sites |
| 2 | Owner saved read | `website_saved_data` for one owned website | Saved sources/snapshots return with dates; no collection job is created |
| 3 | Nonowner denied | With a second identity (or a website ID the signed-in owner does not own), `get_website` / `website_saved_data` | A `forbidden`/403-class result, never an empty success |
| 4 | Reconnect | `/mcp` clear authentication, then sign in again | The next read works; the interim state reported needing sign-in, not an empty result |
| 5 | Logout | `claude mcp logout <name from /mcp>` | The next call reports needing sign-in |
| 6 | Discovery | Ask the session to list the discovered HTP tools | Record presence or absence of: `website_audit_export_start_v1`, `_chunk_v1`, `_close_v1`; `request_website_report`, `get_website_report_request`, `cancel_website_report_request`; `website_audit_events`, `website_operational_episodes`; `website_audit_lifecycle`, `website_url_lifecycle`, `website_remediation_list`. A missing tool is `unsupported`; a held read (`unavailable`, 503) is held, not empty |
| 7 | Export | On an audit that returns `EXPORT_REQUIRED`, follow the export workflow if the tools are discovered | Byte length and SHA-256 receipts match; otherwise recorded as unsupported |
| 8 | Report request | A keyed `request_website_report` for one owned test website, then `get_website_report_request`, then `cancel_website_report_request` | Statuses preserved; no unbounded collection |
| 9 | Live bounded SEOsmith run | Use the `seosmith-operations` skill with a trusted `SEOSMITH_BIN`, one owned URL, pages ≤ 25, duration ≤ 120 s, delay ≥ 1000 ms | `status` reaches a terminal state; `report` bytes and `export` receipt agree; a cancel run confirms `worker_active: false` |

## 3. R5 on the owner's real profile

Upgrade `htp@htp` from 1.1.0 to 1.3.0 with the documented commands (`marketplace update htp`, `plugin update htp@htp`; a
source switch to the tag if the marketplace is pinned to a ref), check the registry SHA and version, then restart or
`/reload-plugins`. Rollback is the rehearsed source switch to `v1.1.0` (see the compatibility page), with the plugin left
disabled until the registry revision is verified. Sessions using the profile are closed while switching.
