# Fantasy Roster Workbench

A local fantasy football dashboard with an auditable proposal-to-approval flow, a fictional league and read-only MCP tools. It runs without API keys or npm dependencies.

## Run

With Node.js 22 or newer, run `npm start` and open http://127.0.0.1:4173. Run `npm test` for the domain checks.

1. Compare the current lineup with the optimizer's picks.
2. Select **Run analysis** to queue a lineup change and a fictional trade offer.
3. Approve or reject each proposal. The lineup changes immediately in the demo after approval. A trade approval records a simulated sent offer, without moving players between teams.
4. Review what happened under **Activity**. **Reset demo** restores the original fixtures.

## Architecture

- `apps/web/` contains the browser UI and a loopback HTTP server. API requests load, change and save the local demo data.
- `packages/analysis/` searches eligible lineups, respects locks and prefers later FLEX kickoff when the weighted score ties. Its score is 55% weekly projection, 35% season average and 10% last-game points. Projected totals display raw fixture projections.
- `packages/providers/` stores state in ignored `.runtime/` using a temporary file and rename. Run one dashboard server against a checkout.
- `apps/mcp/` reads the same saved state and provides `get_league_snapshot` and `preview_recommendations` over stdio.
- `fixtures/` contains fictional league data. It does not include private fantasy league information.

The starter uses plain browser JavaScript, a dependency-free Node server, and JSON persistence. Live news, a second projection feed, user authentication for remote hosting, AI calls and authorized provider execution are future work.

## Connect Codex

Add a project-scoped MCP entry at `.codex/config.toml` and set `cwd` to your local checkout.

```toml
[mcp_servers.fantasy_workbench]
command = "node"
args = ["apps/mcp/server.mjs"]
cwd = 'C:\path\to\fantasy-roster-workbench'
```

Open the trusted project in Codex and call `get_league_snapshot` or `preview_recommendations`. Review and approve changes using the local dashboard.
