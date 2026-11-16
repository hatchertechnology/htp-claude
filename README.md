# htp-claude

HTP plugin for Claude Code, distributed as a plugin marketplace.

## Install

```
/plugin install htp --marketplace hatchertechnology/htp-claude
```

Or add the marketplace first:

```
/plugin marketplace add hatchertechnology/htp-claude
/plugin install htp@htp
```

## Connect

The plugin registers the `htp` MCP server
(`https://htp-api-kerry-hatcher.fly.dev/mcp/secured`). Run `/mcp`, select
`plugin:htp:htp`, and complete the browser OAuth sign-in. No credentials are
stored in the plugin.

## Skills

- `seo-review` — review saved SEO and performance evidence, compare domains, prioritize fixes
- `website-management` — add, rename or delete websites; GA4 and Business Profile bindings; Seosmith audits
- `repository-settings` — attach, pause or remove a website's public GitHub repository

Skills are synced from [`plugins/htp`](https://github.com/hatchertechnology/htp/tree/main/plugins/htp)
in the main HTP repository.

## License

MIT
