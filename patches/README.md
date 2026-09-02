# patches

pi-mcp-adapter has no render hook, so its compact tool rows are patched in place to the Claude Code look (`● server - tool (MCP)(args)` + `  └ result`).

Apply (after `pi install` / `pi update`):

    git -c core.autocrlf=false apply --directory=npm/node_modules/pi-mcp-adapter patches/pi-mcp-adapter.patch

Verify: `node patches/pi-mcp-adapter.selftest.ts`
