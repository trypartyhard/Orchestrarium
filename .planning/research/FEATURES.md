# Feature Landscape

**Domain:** Desktop developer tool manager — enable/disable toggles for CLI agent configurations
**Researched:** 2026-03-04
**Comparables analyzed:** VS Code Extension Manager, JetBrains Plugin Manager, Chrome/Firefox Extension Pages, Raycast Store, opcode, claude-code-tool-manager, webdevtodayjason/sub-agents, Cakebrew

---

## Context: What This App Is (and Is Not)

CAM is a **configuration toggle manager**, not an installer, session manager, or marketplace. The core action is: move a file into or out of `.disabled/` so Claude Code sees or ignores it. Everything else is context that supports this core action.

Competitors (opcode, Claudia, claude-code-tool-manager) manage sessions, MCP servers, usage analytics, and terminal configuration. None of them provide the specific capability CAM offers: a dedicated toggle UI per agent/skill/command, grouped by suite, with instant visual state.

This means CAM's table stakes come from comparable toggle-manager UIs (browser extension pages, VS Code extensions panel) rather than from those session-manager competitors.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toggle ON/OFF per item | The entire purpose of the app. Missing this = there is no app. | Low | File move to/from `.disabled/`. Must be instant (<200ms UI feedback). |
| Toggle ON/OFF per group | Browser extension manager (Chrome) groups by type; VS Code has "Disable All" per publisher. Users expect bulk ops on named sets. | Low-Med | Move all files in prefix group. Group toggle is a 1-click action on the group header row. |
| Three-section sidebar (Agents / Skills / Commands) | VS Code extension manager has clear section tabs. JetBrains separates bundled vs installed. Users orient by type. | Low | Already in spec. Sidebar with icons only, no text labels. Active section highlighted. |
| Auto-discovery on launch | All comparable tools (VS Code, Raycast, browser extensions) scan and display installed items at startup with no manual configuration. | Med | Scan `~/.claude/agents/*.md`, `skills/`, `commands/`. If directory absent, show "not found" message. |
| File watcher for live updates | VS Code updates the extensions panel if you install an extension externally. Users expect the UI to reflect filesystem state. | Med | Rust `notify` crate via Tauri. Debounce 300ms. If external change detected, re-scan silently. |
| Search by name + description | Every comparable tool (VS Code, Chrome extensions, Raycast, JetBrains) has a search field as the primary navigation shortcut. | Low | Instant filter (no submit). Ctrl+F or click. Filters across all visible cards. |
| Filter tabs: All / Enabled / Disabled | VS Code uses `@enabled`, `@disabled` filter tokens. Chrome extension page has "All", "Enabled" pill tabs. | Low | Three filter pills. Active pill highlighted. Counts update dynamically. |
| Status bar with counts | VS Code shows "X installed, Y disabled" at bottom of extensions panel. Browser extensions show badge counts on icons. | Low | Show: current path, count enabled (green dot), count disabled (grey dot), app version. |
| Item name + description on card | Every plugin manager (VS Code, JetBrains, Raycast) shows name and short description. Users need context for each item. | Low | Name from frontmatter `name` field. Description: first 80 chars of `description` field. |
| Visual state for disabled items | VS Code dims disabled extensions. Chrome extension toggle greys out the card. Users expect clear on vs off signal. | Low | Disabled card: opacity 0.5. Toggle uses accent color when ON, grey when OFF. |
| Collapsible groups | VS Code extension publisher groupings collapse. JetBrains shows plugins by category. Prevents overwhelming long lists. | Low | Collapse/expand via arrow. Group header shows: name, count, group toggle. |
| Settings section: path configuration | VS Code allows users to configure extension data locations. Users working with non-default Claude paths need this. | Low | Settings sidebar item. Show resolved scan paths. Allow manual override with directory picker. |
| Error feedback for failed operations | VS Code shows inline errors in extensions panel. Users expect to know if a toggle failed (locked file, permission error). | Low-Med | Toast notification for file lock/permission errors. Inline "invalid config" badge for bad frontmatter. |
| "Empty state" messaging | When directory not found or no agents installed, all comparable tools show an explanatory empty state rather than blank panel. | Low | "Claude Code agents directory not found. Is Claude Code installed?" with path shown. |
| Dark theme | All comparable developer tools (VS Code, JetBrains, Raycast) ship with dark theme as default or equal option. Developer audience expects it. | Low | Already specified: `#12121c` background, `#00d4aa` accent. |

---

## Differentiators

Features that set CAM apart from comparable tools. Not universally expected, but valued by this specific audience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-grouping by filename prefix | No comparable toggle manager groups items by suite automatically. opcode and claude-code-tool-manager both require manual organization. CAM's `gsd-*.md` → "GSD" detection is zero-config. | Med | Regex prefix extraction. `gsd-` → "GSD", `agency-` → "Agency". Files without shared prefix → "Custom". Persist manual groups in `.agent-groups.json`. |
| Group-level toggle as first-class UI element | VS Code's "Disable All" is buried in command palette. CAM puts the group toggle directly in the group header — one click to disable an entire suite (e.g. disable all 51 Agency agents). | Low | Group toggle in header row. Indeterminate state when group is partially enabled. |
| Color dot per agent (from frontmatter) | No comparable tool surfaces agent-level metadata (color, model) from config files in the list view. Makes dense lists scannable — GSD agents are all green, custom agents are grey. | Low | Map frontmatter `color` strings to hex. Grey fallback. |
| Model badge on cards | Visible `model: sonnet` / `model: opus` badge lets user quickly see which agents consume which model tier. Relevant for cost awareness. | Low | Small badge, secondary text color. Only shown if `model` field present. |
| Global vs Project scope toggle | VS Code does global vs workspace. CAM's "Global / Project" scope switch lets users see agents in `~/.claude/` vs `./.claude/` of current project directory. This is the exact workflow Claude Code developers have. | Med | Scope switcher in settings or header. Project scope shows cwd-relative paths. File watcher scope changes on switch. |
| Frontmatter-aware invalid config badge | Other tools show broken plugins as absent. CAM shows them with "invalid config" badge so user knows the file exists but has a parse error. | Low | Catch YAML parse errors. Fallback: use filename as display name. Show amber badge "invalid config". |
| Non-destructive disable mechanism | Unlike uninstalling (opcode, marketplace), disabling in CAM is fully reversible — file is moved, not deleted. Users can re-enable without re-installing. This is architecturally correct for the Claude Code `.disabled/` mechanism. | Low | Core to spec. Worth surfacing in onboarding/empty state copy: "Toggle off — your agent is never deleted." |
| Keyboard shortcut search focus | Raycast is entirely keyboard-driven. VS Code's Ctrl+Shift+X opens extensions. For developer audience, Ctrl+F to jump to search field is expected and reduces mouse dependence. | Low | Bind Ctrl+F / Cmd+F to focus search input. Escape clears + blurs. |

---

## Anti-Features

Features to explicitly NOT build in v0.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Agent content editor (inline prompt editing) | VS Code learned that in-place editing of complex configs creates confusion between "edit vs save vs apply". opcode builds a dedicated editor. For CAM v0.1, editing is out of scope — it adds surface area, error modes, and conflicts with users' existing editors. | Let users open agent files in their editor via OS default. Add "Open in editor" button if needed in v0.2. |
| Import from GitHub / URL installer | curl-and-trust installs are a security surface. Also adds async error modes (network down, wrong URL, malformed repo) that complicate v0.1 testing. | Defer to v0.2. Users who want to install new agents use CLI or git clone. |
| Marketplace / agent discovery | Building a marketplace before validating the core toggle UX is premature. The catalog must be curated and maintained. Scope creep risk is high. | Defer to v0.3. The toggle UI must be proven first. |
| Usage analytics / statistics | opcode and claude-code-tool-manager already provide analytics dashboards. Adding analytics to CAM creates feature overlap with better-suited tools. Also requires log parsing which is fragile. | Not a differentiator for CAM. Omit entirely. |
| MCP server management | claude-code-tool-manager owns this space. Adding MCP management to CAM blurs its identity as a toggle manager for agents/skills/commands. | Out of scope for all versions. Recommend opcode or claude-code-tool-manager for MCP. |
| Drag-and-drop group reordering | Drag-and-drop in lists is notoriously fragile in Tauri/WebView. For v0.1 the auto-grouping removes the need. | Defer to v0.2. Manual group membership via `.agent-groups.json` is sufficient. |
| Light theme | Adds CSS complexity with zero benefit for the developer audience. Dark is expected. | Stub the Settings toggle as "coming soon" or omit entirely. |
| Auto-update for agent files | Polling a GitHub URL to auto-update agent content crosses from manager into package manager. Requires versioning, diffs, conflict resolution. | Out of scope. Users manage agent content updates manually or via git. |
| Session management | opcode and Claudia already do session management far better than CAM could. CAM is not a Claude Code runner. | Out of scope for all versions. Link to opcode from Settings > About if helpful. |
| Multi-tool sync (Cursor, Gemini CLI, etc.) | claude-code-tool-manager handles this. Adding cross-tool sync to CAM requires per-tool path mapping and testing on tools we don't control. | Out of scope for all versions. |
| Confirmation dialogs on toggle | Asking "Are you sure you want to disable this agent?" adds friction to the core action with zero safety benefit (it's trivially reversible). VS Code toggles without confirmation. Browser extension toggles without confirmation. | Toggle immediately, show brief toast on success if helpful. Undo via toggle back. |

---

## Feature Dependencies

```
File system scan (startup)
  → Card display (requires scan result)
    → Toggle ON/OFF (requires knowing file path from scan)
      → Group toggle (requires knowing which cards belong to group)
        → Group header (requires group membership from scan)

Search filter (depends on card list existing)
Filter pills (depends on card list existing)
Status bar counts (depends on card list + enabled/disabled state)

File watcher (depends on initial scan, triggers re-scan on change)
  → Card list refresh (triggered by watcher event)

Frontmatter parser (runs during scan)
  → Color dot (requires frontmatter `color`)
  → Model badge (requires frontmatter `model`)
  → Invalid config badge (triggers on frontmatter parse error)

Settings: path config (required before scan if non-default paths)
Global / Project scope toggle (changes which directory set is scanned)
```

**Critical path for MVP:**
Scan → Parse frontmatter → Render cards → Toggle files → Update state

Everything else layers on top of this path.

---

## MVP Recommendation

Prioritize (v0.1):

1. **Scan + parse** — Discover all agents/skills/commands, parse frontmatter, identify enabled/disabled state
2. **Card list with toggle** — Display cards with name, description, color dot, enabled state; toggle moves file
3. **Group header with group toggle** — Auto-group by prefix, group header toggle moves all files in group
4. **Search + filter pills** — Instant text filter, All/Enabled/Disabled
5. **Status bar** — Path + counts
6. **File watcher** — React to external changes
7. **Error states** — Invalid frontmatter badge, directory-not-found empty state, file-lock toast

Defer from MVP:

- **Global / Project scope toggle** — Useful but adds scan-path complexity. Build after core toggle path is solid.
- **Model badge** — Nice to have, low effort, but not blocking MVP.
- **Keyboard shortcut (Ctrl+F)** — Add after core UI is built; 1-hour addition.
- **Settings path override** — Default paths cover 95% of users. Manual override is v0.1.1.

---

## Competitive Gap Analysis

| Capability | CAM (planned) | opcode | claude-code-tool-manager | webdevtodayjason/sub-agents |
|------------|--------------|--------|--------------------------|------------------------------|
| Toggle individual agent ON/OFF | Yes | No (create/delete only) | Partial (per-project) | Yes (CLI) |
| Toggle entire group (suite) | Yes | No | No | No |
| Visual group auto-detection | Yes | No | No | No |
| Frontmatter-aware card display | Yes (color, model, name) | No | No | No |
| File watcher (live updates) | Yes | Unknown | No | No |
| Session management | No (out of scope) | Yes | Yes | No |
| MCP server management | No (out of scope) | Yes | Yes | No |
| Analytics dashboard | No (out of scope) | Yes | Yes | No |
| Agent content editor | No (v0.2) | Yes | No | No |
| GitHub import / install | No (v0.2) | No | No | No |

CAM has a clear, unoccupied niche: the **dedicated toggle UI for agent suites**. No competitor surfaces the enable/disable workflow for individual agents and groups as a first-class feature.

---

## Sources

- VS Code Extension Marketplace documentation: https://code.visualstudio.com/docs/editor/extension-marketplace
- JetBrains Plugin UX guidelines: https://plugins.jetbrains.com/docs/intellij/plugin-user-experience.html
- opcode GitHub repository: https://github.com/winfunc/opcode
- claude-code-tool-manager GitHub: https://github.com/tylergraydev/claude-code-tool-manager
- webdevtodayjason/sub-agents GitHub: https://github.com/webdevtodayjason/sub-agents
- Raycast store (extension management patterns): https://www.raycast.com/store
- Evil Martians — 6 things developer tools must have: https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption
- VS Code workspace vs global scope: https://github.com/microsoft/vscode/issues/15611
- Toast notification best practices (LogRocket): https://blog.logrocket.com/ux-design/toast-notifications/
- JetBrains Platform Blog Q4 2025: https://blog.jetbrains.com/platform/2026/01/busy-plugin-developers-newsletter-q4-2025/

**Confidence levels:**
- Table stakes (MEDIUM-HIGH): Derived from direct observation of VS Code, Chrome extension manager, Raycast — all mature comparable tools. Claims about what users expect are grounded in multiple sources.
- Differentiators (MEDIUM): Based on gap analysis between CAM spec and observed competitor features. Competitors checked live via GitHub. Could not verify opcode's full feature set (closed-source binary).
- Anti-features (MEDIUM): Based on competitor feature overlap and scoping rationale in PROJECT.md. Confirmed by checking what opcode/claude-code-tool-manager already do.
