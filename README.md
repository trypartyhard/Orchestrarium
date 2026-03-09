<div align="center">

# Orchestrarium

**Agent & Skill Orchestration for Claude Code**

A visual desktop app to browse, organize, and toggle Claude Code agents, skills, commands, and CLAUDE.md profiles — without editing files manually.

*Built entirely through conversation with [Claude Code](https://docs.anthropic.com/en/docs/claude-code), without writing a single line of code manually.*

[![Windows](https://img.shields.io/badge/platform-Windows-blue?logo=windows)]()
[![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-green)]()

</div>

---

![Setup](assets/setup.png)

## What is Orchestrarium?

Claude Code stores agents, skills, and commands as `.md` files in `~/.claude/`. Disabling an item means moving it into a `.disabled/` subfolder. Enabling it means moving it back.

Orchestrarium gives you a clean UI to do this with a single click — plus saved setups, CLAUDE.md profile switching, and more.

## Features

- **Setup** — your active configuration at a glance. Toggle items on/off, see summary cards with counts and progress bars.
- **Agents / Skills / Commands** — browse everything installed, search, filter, add to setup individually or by group.
- **Library** — save and name your setups. Switch between them instantly. Export/import as JSON.
- **CLAUDE.md** — manage multiple instruction profiles. Create, edit, activate, deactivate — switch Claude's behavior in one click.
- **Tutorial** — built-in 7-page walkthrough covering every section.
- **File watcher** — detects external changes to your `.claude/` directory and refreshes automatically.

## Screenshots

<details>
<summary><strong>Agents</strong> — browse and add to setup</summary>

![Agents](assets/agents.png)
</details>

<details>
<summary><strong>Skills</strong> — grouped by prefix</summary>

![Skills](assets/skills.png)
</details>

<details>
<summary><strong>Commands</strong> — slash commands overview</summary>

![Commands](assets/commands.png)
</details>

<details>
<summary><strong>Library</strong> — saved setups</summary>

![Library](assets/library.png)
</details>

<details>
<summary><strong>CLAUDE.md</strong> — profile manager</summary>

![CLAUDE.md](assets/claude-md.png)
</details>

<details>
<summary><strong>Tutorial</strong> — built-in guide</summary>

![Tutorial](assets/tutorial.png)
</details>

<details>
<summary><strong>Group warnings</strong> — smart notifications</summary>

When adding a single item from a group:

![Part of a group](assets/part-of-a-group.png)

When disabling an item from an active group:

![Group Warning](assets/group-warning.png)
</details>

<details>
<summary><strong>Settings</strong></summary>

![Settings](assets/settings.png)
</details>

## Installation

1. Download the latest `.exe` installer from [Releases](../../releases)
2. Run the installer
3. Orchestrarium will auto-detect your `~/.claude/` directory

> **Requirements:** Windows 10/11. WebView2 runtime (included in most Windows installations).

## How it works

| Action | What happens on disk |
|--------|---------------------|
| Enable an item | `.disabled/file.md` moves to `file.md` |
| Disable an item | `file.md` moves to `.disabled/file.md` |
| Save Setup | Current on/off state saved to `~/.claude/orchestrarium/setups.json` |
| Activate CLAUDE.md profile | Profile content copied to `~/.claude/CLAUDE.md` |
| Deactivate profile | `~/.claude/CLAUDE.md` cleared |

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Zustand 5
- **Backend:** Tauri 2, Rust
- **Testing:** Vitest (29 tests), Cargo test (26 tests)

## The Story

I want to share how I came to create Orchestrarium. Watching developers chat in tech communities, I kept seeing the same questions: *"What's your setup?"*, *"Which agents do you use?"*, *"What tools do you have enabled?"* — and looking at the answers, I couldn't find a place to see all of this in a clean, visual UI.

I wanted to see my agents, skills, and commands laid out visually — what's enabled, what's disabled. Maybe it's just the aesthetic pleasure of seeing everything organized, but perhaps you, as developers and engineers, will find something more than just aesthetics in this app.

I want you to know: **I don't speak English natively and I don't know how to code.** I built this entirely by talking to Claude Code — setting tasks, structuring conversations, and iterating until I got what I wanted. I think I did a decent job considering my limitations.

Thank you for reading this far — for me, that's already a small victory and motivation to keep going.

## License

MIT

</div>
