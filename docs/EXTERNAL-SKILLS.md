# Skills installed from outside HOK

Agent skills in `HOK/.claude/skills/` that came from other projects, why we use them, and how each was checked before install. Skills written for HOK itself (`hok-practices`) are not listed.

**House rule:** an outside skill is installed as its skill files only. No plugins, no hooks that run on every prompt, no MCP servers, and no setting that sends our code to an outside AI service. Each one is read and scanned before install.

| Skill | Source | Installed | Why we use it | When it runs |
|---|---|---|---|---|
| **graphify** | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) at commit `92741d1`; CLI `graphifyy` 0.9.95 via `uv` | 2026-10-24 | Builds a map of the code (3,686 symbols, 12,037 links in `graphify-out/`). The agent answers "what calls X / what breaks if Y changes" from the map instead of reading many files, which saves tokens. | When the agent needs to understand how the code connects. Rebuild the map with `graphify update .` after big changes. |
| **caveman** | [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman) at commit `9b68f7e` (`skills/caveman/SKILL.md` only) | 2026-10-30 | Makes the agent's chat replies short: answer first, no filler, every technical fact kept. Cuts token use. | Always on, until you say "stop caveman" or "normal mode". Files, code, commits and docs are still written in full sentences. |
| **security-audit** | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) at commit `c1c8a8c` | 2026-10-30 | A structured, defensive method for finding real security holes in our code, with evidence and the smallest fix for each. | **Only when you ask for it** (type `/security-audit`). It is set with `disable-model-invocation: true`, so the agent never starts it on its own. |
| **ponytail** (and `ponytail-audit`, `-review`, `-debt`, `-gain`, `-help`) | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), MIT | Before 2026-10-24 (commit not recorded) | Keeps code changes small: reuse what exists, no extra features, a test for new logic. | On for the whole session, until you say "stop ponytail". |
| **frontend-design** | Anthropic (see its `LICENSE.txt`) | Before 2026-10-24 (commit not recorded) | Guidance for a deliberate, non-template UI design. Used during the Apple-style redesign. | When the agent builds or reshapes UI. |

## Security check done before install

| Skill | What was checked | Result |
|---|---|---|
| graphify | Read the installer and the skill. The full installer adds hooks on the agent's tools and a CLAUDE.md block, and can call outside AI services with API keys. | **Skill file only.** No hooks, no CLAUDE.md block. The map is built locally from code structure only (`--code-only`); no code leaves the machine. |
| caveman | Repo has 1,796 files, including a plugin whose hooks run its Node scripts at every session start, every sub-agent start and every prompt you send, plus an MCP server and release binaries. Read the whole `SKILL.md`. | **Skill file only**, which is plain writing instructions: no code, no network, nothing that runs. None of the hooks, MCP server or binaries are installed. |
| security-audit | Read the skill and scanned all 20 files. The two scripts (`validate-*.cjs`) only read files: no network, no file writes, no other programs started. The docs contain no download or install commands. The skill is read-only by default and forbids probing live servers, installing packages or using real credentials. | **Installed as is**, plus `disable-model-invocation: true`. Test files not copied. Its full-audit mode writes a report to `~/security-audit-skill/...`, which is outside the HOK folder, so the agent must ask you before a full audit. |

## Updating or removing

- **Update:** download the new version into a scratch folder, read what changed, copy only the skill files over, and update the commit in the table above.
- **Remove:** delete the skill's folder under `.claude/skills/`. For graphify, also run `uv tool uninstall graphifyy` and delete `graphify-out/`.
