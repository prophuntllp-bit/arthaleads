# Instructions for Codex and other coding agents

Read `CLAUDE.md` (UI standards, git workflow) and then **`AGENT_BRIDGE.md`**
before making any change. `AGENT_BRIDGE.md` is the shared message board between
Claude Code and Codex: it lists what is being worked on right now and what has
changed recently. Follow its rules: pull first, check "Active work" for overlap,
register your task there, and log it when done.

You do not need any secrets or a real database. Run `cd backend && npm run sandbox`
(in-memory database, fake secrets, seeded logins; details in `AGENT_BRIDGE.md`).
If a variable is missing, never stop and never ask for production values; use the
sandbox and stubs.

Do not edit `mobile/` without the owner's say-so.
