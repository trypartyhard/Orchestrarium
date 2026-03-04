# Project Research Summary

**Project:** Claude Agent Manager (CAM)
**Domain:** Desktop developer tool — file-system-based toggle manager for Claude Code agent configurations
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

Claude Agent Manager is a Tauri 2 desktop app that gives developers a GUI toggle panel for enabling and disabling Claude Code agents, skills, and commands. The core mechanic is file movement between active directories and `.disabled/` subdirectories — a pattern Claude Code already defines. The recommended stack (Tauri 2 + React 19 + TypeScript + Zustand + Tailwind v4) is battle-tested and appropriate for the scope. The architecture is well-understood: a strict two-process model where Rust handles all file I/O and a React WebView handles display, communicating exclusively through Tauri's typed IPC layer. No alternative architecture is worth considering — this is the only correct model for a Tauri 2 app of this kind.

The product occupies a clear, unoccupied niche. No existing tool (opcode, claude-code-tool-manager, sub-agents) provides a dedicated toggle UI for individual agents and named suites as a first-class feature. CAM's differentiators — auto-grouping by filename prefix, group-level toggle in the header, frontmatter-aware card display — are low-complexity and high-value. The feature scope for v0.1 is narrow and correct: scan, parse, display, toggle. All scope creep candidates (editor, installer, marketplace, MCP management) have clear rationale for deferral.

The most dangerous risks are in project setup, not in feature implementation. Tauri 2's ACL permission system requires explicit path scopes in addition to operation permissions — missing the scope silently blocks all file operations with a generic error. Dotfolder access to `.disabled/` requires explicit configuration. YAML frontmatter parsing must use graceful degradation (all `Option<T>` fields) from day one. File watcher feedback loops and Windows `ReadDirectoryChangesW` buffer overflow on bulk operations require architectural decisions that cannot be easily retrofitted. These pitfalls must be addressed in Phase 1 before any feature work begins.

---

## Key Findings

### Recommended Stack

The stack is fully determined by the spec (Tauri 2 + React) and validated by research. Tauri 2.10.x is the current stable release (February 2025) with production-ready Windows NSIS/MSI installer support built-in. React 19 + Vite 7 are the standard Tauri template combination. Tailwind v4 (released January 2025) uses a CSS-first config — the old `tailwind.config.js` and postcss integration are replaced by `@tailwindcss/vite` and CSS `@theme` blocks, which is a breaking change from v3 tutorials.

**Core technologies:**
- **Tauri 2.10.x**: Desktop shell, Rust/JS bridge — 5-10 MB binary vs Electron's 200+ MB; native Windows installer support built-in
- **React 19 + Vite 7**: Frontend UI and build — the standard Tauri template stack; HMR integration built-in
- **TypeScript 5.x**: Type safety — mandatory; Tauri's `invoke()` is foot-gun-prone without types
- **Zustand 5.x**: Frontend state — centralized store ideal for interconnected list state (agents + groups + filters); lighter than Redux
- **Tailwind v4**: UI styling — CSS-first config, `@custom-variant dark` replaces `darkMode: 'class'`, `@theme` block replaces config file
- **tauri-plugin-fs 2.4.x**: FS operations from JS — official plugin; includes `watch`/`watchImmediate`
- **notify 8.2.x**: Rust-side FS watcher — industry standard (used by Tauri internally, cargo-watch, deno); gives more control than JS-side plugin
- **gray_matter 0.3.x**: Rust YAML frontmatter parser — uses yaml-rust2 (not the deprecated serde_yaml); handles malformed frontmatter gracefully
- **tauri-specta**: TypeScript bindings generation from Rust signatures — eliminates manual type duplication and entire category of IPC bugs
- **lucide-react**: Icons — 1x bundle delta ratio vs Phosphor's 16-18x overhead; covers all required icons

**Critical avoidance:** `serde_yaml` is deprecated and archived (March 2024). Do not use it. Use `gray_matter` for frontmatter parsing.

### Expected Features

CAM's table stakes come from browser extension managers and VS Code's extension panel — the closest UI analogues — not from Claude Code session managers (opcode, Claudia) which address different workflows.

**Must have (table stakes) — v0.1:**
- Per-item toggle ON/OFF with instant feedback (<200ms) — the core action; file move to/from `.disabled/`
- Per-group toggle ON/OFF — one click disables/enables an entire suite (e.g. all 51 Agency agents)
- Three-section sidebar (Agents / Skills / Commands) — orientation by type
- Auto-discovery on launch — scan `~/.claude/agents/`, `skills/`, `commands/` at startup
- File watcher for live updates — UI reflects external filesystem changes via Rust `notify` + debounce 300ms
- Search by name and description — instant filter, Ctrl+F focus
- Filter pills: All / Enabled / Disabled — with dynamic counts
- Status bar — path, enabled count (green dot), disabled count (grey dot), app version
- Item name + description on card — from frontmatter, 80-char truncation
- Visual state for disabled items — opacity 0.5, grey toggle
- Collapsible groups — arrow toggle, group header shows name, count, group toggle
- Error feedback — toast for file-lock/permission errors, inline "invalid config" badge for bad frontmatter
- Empty state messaging — "Claude Code agents directory not found" with path shown
- Dark theme — `#12121c` background, `#00d4aa` accent, always-dark for v0.1

**Should have (differentiators) — v0.1:**
- Auto-grouping by filename prefix — `gsd-*.md` → "GSD", zero-config; persist manual groups in `.agent-groups.json`
- Color dot per agent — from frontmatter `color` field; grey fallback
- Frontmatter-aware invalid config badge — amber badge, file exists but parse failed
- Keyboard shortcut: Ctrl+F → search focus, Escape → clear and blur

**Defer (v2+):**
- Global / Project scope toggle — useful but adds scan-path complexity; build after core is solid
- Model badge on cards — low effort, nice to have, not blocking v0.1
- Settings path override — default paths cover 95% of users; manual override is v0.1.1
- GitHub import / URL installer — security surface; deferred to v0.2
- Agent content editor (inline) — scope creep; let users use their own editors
- Marketplace / agent discovery — premature until core toggle UX is proven
- Light theme — zero benefit for developer audience; stub "coming soon" or omit

**Explicit non-features (never):**
- Usage analytics — opcode and claude-code-tool-manager already do this better
- MCP server management — different tool (recommend opcode)
- Session management — different tool (recommend Claudia)
- Confirmation dialogs on toggle — adds friction to a trivially reversible action

### Architecture Approach

Tauri 2 enforces a strict two-process model: a Rust Core process with full OS access and a WebView process rendering React. All communication goes through Tauri's IPC layer — neither side can reach past the boundary unilaterally. The correct pattern is: Rust is the canonical data store; React is a cache populated by commands and invalidated by events. Optimistic UI in the React layer flips toggle state immediately, then confirms or reverts based on the Rust command response.

**Major components:**

**Rust backend (src-tauri/src/):**
1. `parser.rs` — parses YAML frontmatter; all fields `Option<T>`; graceful degradation on bad frontmatter
2. `scanner.rs` — walks agent/skill/command directories and `.disabled/` subdirs; calls parser; returns typed Vec
3. `toggler.rs` — moves files between active dir and `.disabled/`; calls `create_dir_all` before every rename
4. `groups.rs` — detects prefix groups from filenames; reads/writes `.agent-groups.json`
5. `watcher.rs` — wraps `notify` crate; debounces 300ms; emits `fs-changed` event to frontend via `AppHandle`
6. `commands.rs` — Tauri command handlers; public IPC API surface; delegates to domain modules
7. `config.rs` — app configuration (scan paths); uses app data dir

**React frontend (src/):**
1. `lib/tauri-api.ts` — typed wrappers around `invoke()`; single place for all Tauri calls; components never call `invoke()` directly
2. `lib/store.ts` — Zustand store: agents[], skills[], commands[], activeSection, searchQuery, filter; optimistic toggle actions
3. `hooks/useAgents.ts` (+ useSkills, useCommands) — loads on mount; subscribes to `fs-changed` via `listen()`; triggers full refresh
4. `components/Agents/AgentCard.tsx` → `AgentGroup.tsx` → `AgentList.tsx` — leaf-to-root rendering
5. `components/Layout/Sidebar.tsx`, `Header.tsx`, `StatusBar.tsx` — layout shell

**Key architectural decisions:**
- File watcher lives in Rust, not JS — allows AppState invalidation without an extra IPC round-trip
- Events carry only notifications (not data); commands carry data — events are type-unsafe, commands are typed
- Derived state (search filter results) computed in components, not stored — avoids stale derived state bugs
- `tauri-specta` generates TypeScript bindings from Rust signatures — eliminates entire category of IPC type bugs
- Groups start collapsed — prevents slow initial paint with 50+ agents

### Critical Pitfalls

**From PITFALLS.md — top 5 that cause rewrites or data loss:**

1. **Capability scope misconfiguration silently blocks all file ops (C-1)** — Tauri 2 requires BOTH the operation permission AND an explicit `fs:scope` path entry in `src-tauri/capabilities/default.json`. Missing scope gives a generic "forbidden path" error with no indication of root cause. Prevention: configure capabilities in Phase 1 before writing any file operation code; use the `$HOME/.claude/**` double-star glob for recursive access.

2. **`.disabled/` dotfolder access blocked by default (C-2)** — `requireLiteralLeadingDot` defaults to `true` in tauri-plugin-fs, preventing access to dotfolders. The watcher will silently miss all toggle operations. Prevention: add `"requireLiteralLeadingDot": false` to `tauri.conf.json` and explicitly include `.disabled` paths in scope at project setup.

3. **Watcher feedback loop from app's own toggle operations (C-4)** — The app moves a file, the OS watcher fires an event, the frontend re-fetches, creating flicker or double-state updates. Prevention: use optimistic UI (flip state immediately on click) and an operation-tracking lock in the watcher handler (ignore events within 500ms of a self-initiated op).

4. **Group toggle partial failure leaves inconsistent state (C-5)** — File moves are not atomic; if file #8 of 15 fails, files 1-7 are in wrong state with no recovery. Prevention: validate-all-then-execute pattern; rollback successfully moved files if any move fails; return `{ succeeded, failed }` struct from the command.

5. **YAML frontmatter edge cases cause silent drops (M-5)** — Rigid Rust structs panic or silently drop agent cards for files with colons in descriptions, multiline values, missing frontmatter, or `tools` field as string vs array. Prevention: all frontmatter struct fields `Option<T>`; custom deserializer for `tools`; graceful fallback to filename as display name.

**Additional critical setup items:**
- Use `tokio::sync::Mutex` (not `std::sync::Mutex`) for any state accessed in async commands — `std::sync::MutexGuard` cannot be held across `.await` points (C-6)
- Use `camelCase` in TypeScript `invoke()` parameters — Tauri converts Rust `snake_case` to `camelCase` automatically; mismatch causes silent failures (M-1)
- Use Tauri `path` module APIs for all path construction — never string-concatenate paths; Windows `\` vs `/` causes silent file-not-found errors (M-2)
- Implement frontend-ready handshake — backend watcher fires before React mounts; initial load must use `invoke("get_agents")` on mount, not wait for an event (M-3)

---

## Implications for Roadmap

The feature dependency graph from FEATURES.md and the build order from ARCHITECTURE.md converge on the same phase structure. The pitfalls create a hard constraint: Phase 1 must be entirely setup and foundational Rust before any UI work begins.

### Phase 1: Foundation — Rust Core + Project Setup

**Rationale:** Every subsequent phase depends on correct Tauri permission configuration, safe async state management patterns, and a robust frontmatter parser. The 5 critical pitfalls (C-1 through C-5) are all Phase 1 setup decisions. Getting these wrong means rework in every subsequent phase. Build and validate the Rust foundation in isolation before touching React.

**Delivers:** A working Tauri 2 project with correct capabilities configuration, typed Rust structs, frontmatter parser with graceful degradation, directory scanner, file toggler, and Tauri command layer.

**Addresses features:** Auto-discovery on launch (scan), item data (parse), toggle mechanism (toggler)

**Avoids pitfalls:**
- C-1: Capabilities configured with operation + scope in `default.json`
- C-2: `requireLiteralLeadingDot: false` set at project creation
- C-3: `gray_matter` chosen over `serde_yaml`
- M-5: All frontmatter fields `Option<T>`, `tools` custom deserializer
- M-6: `tokio::sync::Mutex` for AppState from the start
- M-1: `tauri-specta` generates bindings, eliminating camelCase/snake_case class of bug
- m-3: `app.path().home_dir()` not the removed Tauri 1 API

**Research flag:** No additional research needed — official Tauri docs cover this thoroughly.

**Build order within phase:**
1. Scaffold project (`npm create tauri-app@latest`)
2. Configure capabilities (`default.json` + `tauri.conf.json`)
3. `parser.rs` — pure function, testable in isolation
4. `scanner.rs` — depends on parser
5. `toggler.rs` — pure file I/O, testable with temp dirs
6. `groups.rs` — prefix detection, pure function
7. `commands.rs` — wires Layer 1 into Tauri IPC
8. Generate TypeScript bindings with `tauri-specta`
9. Verify `Vec<Agent>` return type resolves in JS (catches pitfall m-4 early)

---

### Phase 2: React UI Core — Cards, Sidebar, Toggle

**Rationale:** With a working Rust backend, build the complete React rendering layer. This phase produces the functional MVP: a user can open the app, see their agents, and toggle them on or off. The UI primitives (Toggle, ColorDot, Badge, SearchBar) must be built before feature components.

**Delivers:** Full React app with Zustand store, sidebar navigation, agent/skill/command card lists with toggle, search, filter pills, status bar. Optimistic UI for toggle with revert-on-error.

**Addresses features:** All table stakes features except file watcher (deferred to Phase 3)

**Implements architecture:** tauri-api.ts, Zustand store, all UI component layers

**Avoids pitfalls:**
- C-4: Optimistic UI pattern (flip immediately, confirm/revert from Rust response) — prevents watcher feedback loop from mattering for self-initiated ops
- M-2: All path handling via Tauri `path` module; no string concatenation in JS
- m-5: `.disabled/` directory created with `create_dir_all` before every toggle

**Research flag:** No additional research needed — React + Zustand patterns are standard; architecture file covers component build order explicitly.

**Build order within phase:**
1. `lib/types.ts`, `lib/colors.ts`, `lib/store.ts`, `lib/tauri-api.ts`
2. UI primitives: Toggle, Badge, ColorDot, SearchBar, FilterPills
3. Layout: Sidebar, Header, StatusBar
4. Feature hooks: `useAgents.ts` (with `invoke("get_agents")` on mount)
5. Feature components: AgentCard → AgentGroup → AgentList
6. Repeat for Skills and Commands sections
7. App.tsx integration
8. Error states: invalid config badge, empty state, file-lock toast

---

### Phase 3: File Watcher + Live Updates

**Rationale:** Separate phase because the watcher introduces architectural complexity (feedback loop, Windows buffer overflow, frontend-ready timing) that should not entangle Phase 2 UI work. By Phase 3, optimistic UI is already in place, making the watcher purely additive for external changes.

**Delivers:** Rust-side `watcher.rs` using `notify` crate; frontend-ready handshake; live UI updates when files change externally; debouncing at 300ms.

**Addresses features:** File watcher for live updates

**Avoids pitfalls:**
- C-2: Watcher scope covers `.disabled/**` explicitly; recursive watch on parent
- C-4: Operation-tracking lock in watcher handler; events from self-initiated ops suppressed
- M-3: Frontend-ready handshake — React emits `frontend-ready`; watcher only starts emitting after receiving it
- M-4: After any group toggle, Rust command returns complete new state; watcher is only for external changes; if rapid events arrive, full rescan triggered rather than event counting

**Research flag:** The Windows `ReadDirectoryChangesW` buffer overflow behavior (M-4) is a Windows-specific concern. If testing reveals issues with bulk operations, the mitigation (always full-rescan after group toggle) is already designed in. No additional research needed.

---

### Phase 4: Groups, Settings, Polish

**Rationale:** Group management, settings path configuration, and keyboard shortcuts are complete features that layer on top of the working core. They are cohesive (all configuration/organization concerns) and have no external dependencies.

**Delivers:** Auto-group detection by filename prefix; `.agent-groups.json` persistence; group toggle with rollback on partial failure; Settings section with path display; Ctrl+F keyboard shortcut; color dot from frontmatter.

**Addresses features:** Auto-grouping by filename prefix, group-level toggle as first-class UI element, color dot per agent, keyboard shortcut search focus

**Avoids pitfalls:**
- C-5: Group toggle uses validate-all-then-execute + rollback tracking; returns `{ succeeded, failed }` struct

**Research flag:** No additional research needed — group prefix detection is straightforward regex; `.agent-groups.json` schema is simple.

---

### Phase 5: Packaging + Distribution

**Rationale:** Windows NSIS/MSI packaging is built into Tauri 2 and requires only configuration, not code. The SmartScreen warning (pitfall m-1) is a distribution concern, not a code concern. Separate phase keeps packaging concerns out of feature development.

**Delivers:** Signed (or documented-unsigned) Windows installer; NSIS/MSI build configuration; app icon; version metadata.

**Addresses features:** Distribution, SmartScreen handling

**Avoids pitfalls:**
- m-1: Document SmartScreen bypass for developer audience; plan code signing for public release

**Research flag:** May need targeted research on OV code signing certificate acquisition for Windows, specifically the Tauri signing workflow and certificate costs. Standard Tauri distribution docs cover the build configuration.

---

### Phase Ordering Rationale

- **Rust before React:** The Rust foundation (parser, scanner, toggler, commands) has no UI dependencies and can be built and tested in isolation with `cargo test`. Starting with Rust ensures the IPC API is stable before React components are built against it.
- **Permissions first:** All 5 critical pitfalls have Phase 1 as their prevention phase. Configuring permissions and patterns incorrectly at project setup cascades into every subsequent phase.
- **Watcher deferred from core:** The watcher introduces concurrency and feedback-loop complexity. Keeping it out of Phase 2 means the UI is testable without a running watcher. Phase 3 adds it cleanly.
- **Groups deferred from core:** Groups are organizational; the core action (toggle individual item) must work before bulk operations are built on top of it.
- **Distribution last:** Packaging adds no functionality and can be done any time after the app is feature-complete.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Distribution):** OV code signing certificate acquisition for Windows; Tauri signing workflow specifics; NSIS vs MSI tradeoffs for SmartScreen reputation. Recommend `/gsd:research-phase` for this phase.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Official Tauri 2 docs are comprehensive; all patterns verified against official sources
- **Phase 2:** React + Zustand patterns are well-documented; architecture file covers this in detail
- **Phase 3:** Watcher patterns documented; pitfalls identified and mitigations specified
- **Phase 4:** Group detection is regex + JSON; no novel technology

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tauri 2.10.2 is current stable (confirmed GitHub releases); React 19 + Vite 7 confirmed by production templates; Tailwind v4 confirmed via official release blog Jan 2025; `gray_matter` version from docs.rs |
| Features | MEDIUM-HIGH | Table stakes derived from direct observation of VS Code extensions panel and Chrome extension manager — mature, comparable tools. Competitor gap analysis based on live GitHub repos; opcode is closed-source binary so full feature set could not be verified |
| Architecture | HIGH | All core patterns sourced from official Tauri 2 docs; `tauri-specta` from official specta.dev docs; Zustand patterns from production community templates |
| Pitfalls | HIGH | Critical pitfalls confirmed via official Tauri GitHub issues with issue numbers; Windows ReadDirectoryChangesW behavior from Microsoft Learn documentation; serde_yaml deprecation confirmed via Rust Forum |

**Overall confidence:** HIGH

### Gaps to Address

- **`gray_matter` Rust crate version:** Listed as 0.3.2 in STACK.md but PITFALLS.md notes version 0.2 in its example. Verify the current version on crates.io before adding to `Cargo.toml`. The functionality is the same either way.
- **opcode full feature set:** opcode is a closed-source binary; the competitive gap analysis could not verify its full feature set. The toggle-manager niche appears unoccupied, but this is based on observed GitHub repos, not exhaustive testing.
- **tauri-plugin-fs 2.4.x permission identifiers:** The exact permission identifier format should be verified against the plugin's `permissions/` directory at build time — the format documented in STACK.md follows official patterns but ACL identifier names can change between patch versions.
- **`tauri-specta` version compatibility:** Verify `tauri-specta` version compatibility with Tauri 2.10.x before adding to `Cargo.toml`. The specta.dev docs reference Tauri 2 generally; pinning to a compatible version range needs confirmation at project creation time.

---

## Sources

### Primary (HIGH confidence)
- Tauri 2 official docs (process model, calling Rust, calling frontend, state management, capabilities, permissions, file system plugin, Windows distribution): https://v2.tauri.app/
- tauri-specta v2 official docs: https://specta.dev/docs/tauri-specta/v2
- Tauri 2.10.2 stable release: https://github.com/tauri-apps/tauri/releases
- Tauri 2.0 stable announcement (October 2024): https://v2.tauri.app/blog/tauri-20/
- Tailwind CSS v4 release (January 22, 2025): https://tailwindcss.com/blog/tailwindcss-v4
- notify crate releases (v8.2.0): https://github.com/notify-rs/notify/releases
- gray_matter crate docs (v0.3.2): https://docs.rs/gray_matter/latest/gray_matter/
- serde_yaml deprecation (Rust Forum, confirmed): https://users.rust-lang.org/t/serde-yaml-deprecation-alternatives/108868
- Microsoft Learn: ReadDirectoryChangesW buffer behavior: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw

### Secondary (MEDIUM confidence)
- Production Tauri v2 template (React 19, Vite 7, Zustand 5): https://github.com/tauri-apps/tauri/releases
- Tailwind v4 dark mode with `@custom-variant`: https://tailwindcss.com/docs/dark-mode
- Tauri + Async Rust process pattern: https://rfdonnelly.github.io/posts/tauri-async-rust-process/
- Lucide bundle efficiency vs Phosphor icons: https://medium.com/codetodeploy/the-hidden-bundle-cost-of-react-icons-why-lucide-wins-in-2026-1ddb74c1a86c
- Zustand vs Jotai for desktop apps: https://makersden.io/blog/react-state-management-in-2025
- VS Code Extension Marketplace documentation: https://code.visualstudio.com/docs/editor/extension-marketplace
- opcode GitHub repository: https://github.com/winfunc/opcode
- claude-code-tool-manager GitHub: https://github.com/tylergraydev/claude-code-tool-manager
- webdevtodayjason/sub-agents GitHub: https://github.com/webdevtodayjason/sub-agents

### Tertiary — Confirmed Bug Reports (HIGH signal, tied to specific Tauri versions)
- IPC promise hang on complex types (Tauri issue #10327): https://github.com/tauri-apps/tauri/issues/10327
- plugin-fs home permissions bug (Tauri issue #10330): https://github.com/tauri-apps/tauri/issues/10330
- fs plugin forbidden path error when watching (plugins-workspace issue #1894): https://github.com/tauri-apps/plugins-workspace/issues/1894
- Events not reaching frontend timing issue (Tauri issue #4630): https://github.com/tauri-apps/tauri/issues/4630
- dialog defaultPath ignores forward slashes on Windows (Tauri issue #8074): https://github.com/tauri-apps/tauri/issues/8074

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
