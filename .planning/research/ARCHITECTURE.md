# Architecture Patterns: Tauri 2 + React Desktop App

**Domain:** File-system-based agent manager desktop app
**Researched:** 2026-03-04
**Overall confidence:** HIGH — Tauri 2 official docs + community patterns verified

---

## Recommended Architecture

### Overview

Tauri 2 enforces a strict two-process model: a Rust **Core process** with full OS access and a **WebView process** rendering the React UI. All communication is mediated through Tauri's IPC layer. Neither process can reach past the boundary unilaterally — the Core must emit events, the WebView must invoke commands.

```
┌─────────────────────────────────────────────────────────┐
│  WebView Process (React + TypeScript)                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │  UI      │  │  Hooks   │  │  tauri-api.ts          │ │
│  │  Layer   │◄─│  Layer   │◄─│  (invoke wrappers)     │ │
│  │          │  │          │  └───────────┬────────────┘ │
│  └──────────┘  └──────────┘              │               │
│                                          │               │
│  Zustand Store ◄──── listen() ◄──────────┼───────────── │
│                                          │               │
└──────────────────────────────────────────┼───────────────┘
                                           │ IPC (message passing)
┌──────────────────────────────────────────┼───────────────┐
│  Core Process (Rust)                     │               │
│                                          │               │
│  ┌──────────┐  ┌──────────┐  ┌───────────▼────────────┐ │
│  │ commands │  │ scanner  │  │  tauri::State<Mutex<T>>│ │
│  │ .rs      │◄─│ .rs      │◄─│  (shared app state)    │ │
│  │          │  │          │  └────────────────────────┘ │
│  └──────────┘  └──────────┘                             │
│       │                                                  │
│  ┌────▼─────┐  ┌──────────┐                             │
│  │ toggler  │  │ watcher  │──► app.emit("fs-changed")   │
│  │ .rs      │  │ .rs      │                             │
│  │          │  │(notify)  │                             │
│  └──────────┘  └──────────┘                             │
└─────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Rust Backend Components

| Component | File | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| **commands** | `commands.rs` | Tauri command handlers — the public API surface. Receives invocations from frontend, delegates to domain modules, returns results | scanner, toggler, groups, config via tauri::State |
| **scanner** | `scanner.rs` | Walks `~/.claude/agents/`, `skills/`, `commands/` dirs. Reads `.disabled/` subdirs for disabled items. Returns Vec<Agent/Skill/Command> | parser (calls it), groups (calls it) |
| **parser** | `parser.rs` | Parses YAML frontmatter from .md files. Extracts name, description, color, model, tools fields. Handles invalid frontmatter gracefully | Called by scanner |
| **toggler** | `toggler.rs` | Moves files between active dir and `.disabled/` subdir. Creates `.disabled/` if absent. Handles per-item and group-level moves atomically | filesystem via std::fs |
| **watcher** | `watcher.rs` | Wraps `notify` crate. Watches all scanned directories recursively. Debounces events (300ms). Emits `fs-changed` events to frontend via AppHandle | AppHandle (cloned for thread), filesystem events |
| **groups** | `groups.rs` | Detects group prefix from filename (e.g. `gsd-*.md` → "GSD"). Reads/writes `.agent-groups.json`. Assembles AgentGroup structs | scanner output, filesystem |
| **config** | `config.rs` | Reads/writes app configuration (scan paths, theme). Uses `tauri-plugin-store` or a JSON file in app data dir | tauri::State |
| **AppState** | `main.rs` | Central state struct: `Mutex<Vec<Agent>>`, `Mutex<Vec<Skill>>`, `Mutex<Vec<Command>>`. Registered via `app.manage()` | All commands access via tauri::State |

### React Frontend Components

| Component | File | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| **tauri-api.ts** | `lib/tauri-api.ts` | Typed wrappers around `invoke()`. Single place for all Tauri calls. Returns typed promises | Tauri IPC layer |
| **Zustand store** | `lib/store.ts` | Global client state: agents[], skills[], commands[], activeSection, searchQuery, filter, loading. Source of truth for UI | tauri-api.ts (to load), listen() (for updates) |
| **useAgents hook** | `hooks/useAgents.ts` | Loads agents on mount, subscribes to `fs-changed` event via `listen()`, refreshes store. Exposes toggle handlers that call tauri-api.ts | Zustand store, tauri-api.ts |
| **useSkills hook** | `hooks/useSkills.ts` | Same pattern as useAgents but for skills | Zustand store, tauri-api.ts |
| **useCommands hook** | `hooks/useCommands.ts` | Same pattern as useAgents but for commands | Zustand store, tauri-api.ts |
| **App.tsx** | `App.tsx` | Root. Initializes hooks on mount. Renders Layout with active section | All hooks, Layout |
| **Sidebar** | `components/Layout/Sidebar.tsx` | Navigation icons for Agents/Skills/Commands/Settings. Updates Zustand activeSection | Zustand store |
| **Header** | `components/Layout/Header.tsx` | Section title, search bar, All/Enabled/Disabled filter pills | Zustand store |
| **StatusBar** | `components/Layout/StatusBar.tsx` | Shows current path + active/disabled counts | Zustand store (derived counts) |
| **AgentList** | `components/Agents/AgentList.tsx` | Renders groups from store. Applies search/filter. Virtualize if >200 items | Zustand store |
| **AgentGroup** | `components/Agents/AgentGroup.tsx` | Collapsible group header with group toggle. Expand/collapse state is local (useState) | AgentCard, toggle handler from useAgents |
| **AgentCard** | `components/Agents/AgentCard.tsx` | Single agent row: ColorDot, name, description, Toggle. Calls toggle handler on click | Toggle, useAgents toggle handler |
| **Toggle** | `components/ui/Toggle.tsx` | Controlled toggle component. Optimistic UI: flips immediately, reverts on error | Parent props |

---

## Data Flow

### Initial Load (Command flow)

```
App.tsx mount
  → useAgents.loadAgents()
  → invoke("get_agents")                   [JS → Rust IPC]
  → commands.rs: get_agents()
  → scanner.scan_agents_dir()
  → parser.parse_frontmatter(file)
  → groups.assign_groups(agents)
  → returns Vec<Agent>                      [Rust → JS]
  → zustand store.setAgents(agents)
  → React re-renders AgentList
```

### Toggle (Command + Optimistic UI)

```
User clicks Toggle on AgentCard
  → AgentCard calls onToggle(agent.id, !agent.enabled)
  → Zustand store.optimisticToggle(id)      [immediate UI flip]
  → invoke("toggle_agent", {id, enabled})   [JS → Rust IPC]
  → commands.rs: toggle_agent()
  → toggler.move_file(path, enabled)        [std::fs rename]
  → returns Updated Agent                   [Rust → JS]
  → Zustand store.confirmToggle(updatedAgent)
  [on error]: Zustand store.revertToggle(id)  + toast notification
```

### File System Watcher (Event flow)

```
External change (e.g. user drags file in Finder/Explorer)
  → notify crate detects filesystem event
  → watcher.rs debounces (300ms window)
  → app.emit("fs-changed", {path: "..."})   [Rust → JS event]
  → useAgents useEffect listener fires
  → invoke("get_agents")                    [full refresh]
  → Zustand store.setAgents(fresh)
  → React re-renders
```

### Group Toggle (Batch command)

```
User clicks group toggle
  → invoke("toggle_group", {groupId, enabled})
  → commands.rs iterates group agents
  → toggler.move_file() for each agent (serial, no partial-success)
  → returns Vec<Agent> (all updated)
  → Zustand store.setAgents (merge updated)
```

---

## Rust State Management Pattern

Tauri injects `tauri::State<T>` into command handlers via dependency injection. `Arc` is not needed because Tauri's State type handles reference counting internally. Use `Mutex<T>` for interior mutability.

```rust
// main.rs — define and register
struct AppState {
    agents: Mutex<Vec<Agent>>,
}

tauri::Builder::default()
    .manage(AppState {
        agents: Mutex::new(Vec::new()),
    })
    .setup(|app| {
        // Seed initial state
        let agents = scanner::scan_all()?;
        *app.state::<AppState>().agents.lock().unwrap() = agents;

        // Start file watcher with cloned AppHandle
        let handle = app.handle().clone();
        watcher::start(handle)?;
        Ok(())
    })
```

```rust
// commands.rs — access state
#[tauri::command]
async fn get_agents(state: State<'_, AppState>) -> Result<Vec<Agent>, String> {
    Ok(state.agents.lock().unwrap().clone())
}
```

**Critical:** Do NOT use `async` commands with borrowed State unless returning `Result<T, E>`. Tauri requires owned types for pure async commands.

---

## File Watcher Architecture

The watcher runs in a background thread spawned at app setup. The `notify` crate is the underlying engine. `AppHandle` is cheap to clone — pass a clone into the watcher thread.

```rust
// watcher.rs
use notify::{Watcher, RecursiveMode, Result as NotifyResult};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start(app: AppHandle, paths: Vec<PathBuf>) -> NotifyResult<()> {
    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx)?;

    for path in &paths {
        watcher.watch(path, RecursiveMode::Recursive)?;
    }

    // Spawn thread — watcher must stay alive (move it)
    std::thread::spawn(move || {
        let _watcher = watcher;  // keep alive
        let mut last_emit = std::time::Instant::now();
        let debounce = Duration::from_millis(300);

        for event in rx {
            match event {
                Ok(_) => {
                    // Debounce: only emit if 300ms since last emit
                    if last_emit.elapsed() >= debounce {
                        app.emit("fs-changed", ()).ok();
                        last_emit = std::time::Instant::now();
                    }
                }
                Err(_) => {} // log errors, don't crash
            }
        }
    });

    Ok(())
}
```

**Alternative:** `tauri-plugin-fs-watch` (official plugin, backed by `notify`) provides this from JavaScript via `watch()` / `watchImmediate()`. The JS-side plugin is simpler to set up but gives less control over debouncing and cross-thread state access. For this app, **implement the watcher in Rust** so it can directly refresh the cached AppState — this avoids a redundant full re-scan on every frontend re-render.

---

## React State Management Pattern

Use **Zustand** as the single global store. Do not use React Context for cross-component state in a Tauri app — Context re-renders entire subtrees on any state change. Zustand selectors let components subscribe to exactly what they need.

```typescript
// lib/store.ts
import { create } from 'zustand'

interface AppStore {
  agents: Agent[]
  skills: Skill[]
  commands: Command[]
  activeSection: Section
  searchQuery: string
  filter: Filter
  setAgents: (agents: Agent[]) => void
  optimisticToggle: (id: string) => void
  confirmToggle: (agent: Agent) => void
  revertToggle: (id: string) => void
  setSection: (s: Section) => void
  setSearch: (q: string) => void
  setFilter: (f: Filter) => void
}
```

**Derived data (search + filter) is computed in the component**, not stored. AgentList computes `filteredGroups` from `store.agents + store.searchQuery + store.filter` inline. This avoids stale derived state bugs.

---

## Type Safety: tauri-specta

Use **tauri-specta** to generate TypeScript bindings from Rust command signatures. This eliminates manual type duplication between Rust structs and TypeScript interfaces.

```rust
// Annotate commands
#[tauri::command]
#[specta::specta]
fn get_agents(state: State<'_, AppState>) -> Result<Vec<Agent>, String> { ... }

// Export bindings in main.rs (debug only)
let builder = tauri_specta::ts::builder()
    .commands(tauri_specta::collect_commands![get_agents, toggle_agent, ...]);

#[cfg(debug_assertions)]
let builder = builder.path("../src/bindings.ts");
builder.build().unwrap();
```

```typescript
// Frontend uses generated bindings
import * as commands from './bindings'
const agents = await commands.getAgents()  // fully typed, no stringly-typed invoke()
```

**Confidence:** HIGH — verified via official specta.dev docs and multiple production templates.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling Instead of Events
**What:** Frontend polls `invoke("get_agents")` on a timer to detect file changes.
**Why bad:** Unnecessary CPU usage, stale state between polls, doesn't respond instantly to changes.
**Instead:** File watcher in Rust emits `fs-changed` event → frontend listens and refreshes once.

### Anti-Pattern 2: State Duplication Between Rust and JS
**What:** Maintaining full agent list in both Rust `AppState` and Zustand store as independent sources of truth.
**Why bad:** They drift apart after file moves. Rust state becomes stale after manual FS edits; JS state becomes stale after Rust-side changes.
**Instead:** Rust is the canonical store. JS store is a cache populated by commands and invalidated by events. On `fs-changed`, JS always re-fetches from Rust.

### Anti-Pattern 3: Creating New aiohttp Sessions Per Request (Rust equivalent: new FS scan per toggle)
**What:** Re-scanning all directories on every individual toggle operation.
**Why bad:** Slow for users with 50+ agents, causes visible flicker.
**Instead:** Toggle command updates only the toggled item in AppState; no full rescan needed. Full rescan only on `fs-changed` events.

### Anti-Pattern 4: Blocking Main Thread in Rust Commands
**What:** Performing synchronous file I/O in a `#[tauri::command]` without `async`.
**Why bad:** Blocks the Tauri runtime thread, causes UI freezes.
**Instead:** Use `async fn` for all commands that do file I/O. Tauri spawns async commands on a thread pool.

### Anti-Pattern 5: Calling invoke() Directly in Components
**What:** `await invoke("get_agents")` scattered across components.
**Why bad:** String-typed command names, no single place to update if API changes, no error handling consistency.
**Instead:** All Tauri calls go through `lib/tauri-api.ts` (or generated `bindings.ts`). Components never call `invoke()` directly.

### Anti-Pattern 6: Expanding All Groups by Default
**What:** Rendering all agent cards for all groups expanded on load.
**Why bad:** 51+ Agency Agents all rendered = slow initial paint on lower-end machines.
**Instead:** Groups start collapsed. Expand state is local `useState` per AgentGroup. Only expanded groups render their cards.

---

## Scalability Considerations

| Concern | At 20 agents | At 100 agents | At 500 agents |
|---------|--------------|---------------|---------------|
| Initial scan | Instant | Instant | < 200ms (all local FS) |
| Render | No issue | No issue | Consider react-window virtualisation for list |
| Watcher overhead | Negligible | Negligible | Negligible (OS-level inotify/FSEvents) |
| Group toggle | Instant | < 100ms for 50 files | < 500ms — add progress indicator |
| State lock contention | None | None | Possible if watcher + many toggles concurrent — use tokio::Mutex for async commands |

---

## Component Build Order (Dependency Graph)

Build in this order to avoid blocked work:

**Layer 1 — Rust foundation (no dependencies)**
1. `parser.rs` — parses frontmatter. Pure function, no Tauri dep. Testable in isolation.
2. `scanner.rs` — walks dirs, calls parser. No Tauri dep. Testable with temp dirs.
3. `toggler.rs` — moves files. Pure file I/O. Testable with temp dirs.
4. `groups.rs` — prefix detection logic. Pure function on file names.

**Layer 2 — Tauri integration (depends on Layer 1)**
5. `config.rs` — app paths and settings. Depends on Tauri's app data dir.
6. `commands.rs` — wires Layer 1 into Tauri commands. Requires Layer 1 complete.
7. `watcher.rs` — requires AppHandle from Tauri setup. Requires scanner and commands working.

**Layer 3 — Frontend foundation (can start in parallel with Layer 1)**
8. `lib/types.ts` — TypeScript interfaces. No dependencies.
9. `lib/colors.ts` — color mapping. No dependencies.
10. `lib/tauri-api.ts` — invoke wrappers. Depends on types.ts. Can use mock data initially.
11. `lib/store.ts` — Zustand store. Depends on types.ts.

**Layer 4 — UI primitives (depends on Layer 3)**
12. `components/ui/Toggle.tsx` — controlled toggle, no data deps.
13. `components/ui/Badge.tsx`, `ColorDot.tsx`, `SearchBar.tsx`, `FilterPills.tsx` — pure UI.
14. `components/Layout/Sidebar.tsx`, `StatusBar.tsx`, `Header.tsx` — layout, reads from store.

**Layer 5 — Feature components (depends on Layers 2 + 4)**
15. `hooks/useAgents.ts` — depends on tauri-api.ts and store.ts.
16. `components/Agents/AgentCard.tsx` → `AgentGroup.tsx` → `AgentList.tsx` (leaf-to-root order).
17. Skills and Commands sections — same pattern, parallel to Agents.

**Layer 6 — Integration**
18. `App.tsx` — wires hooks to layout, initializes watchers.
19. Settings section — reads config command, low priority.

---

## Key Architectural Decisions

| Decision | Recommended | Rationale |
|----------|-------------|-----------|
| Rust state | `Mutex<Vec<Agent>>` in `tauri::State` | No Arc needed, Tauri handles ref counting internally |
| File watcher location | Rust (not JS plugin) | Allows AppState invalidation without extra round-trip |
| Watcher crate | `notify` directly | More control than `tauri-plugin-fs-watch`; debounce logic owned by app |
| JS state | Zustand | Simpler than Redux for this scale; selector-based subscriptions avoid over-render |
| Type safety | `tauri-specta` | Eliminates manual type duplication; compile-time errors not runtime |
| Optimistic UI | Flip immediately, revert on error | Toggle feels instant; Rust file move is fast but network latency principle applies |
| Group expansion | Local useState (not store) | Per-group UI state does not need global persistence |
| Derived state | Computed in component | Avoids stale derived state from async store updates |

---

## Sources

- [Tauri 2 Process Model](https://v2.tauri.app/concept/process-model/) — official docs, HIGH confidence
- [Tauri 2 Architecture](https://v2.tauri.app/concept/architecture/) — official docs, HIGH confidence
- [Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) — official docs, HIGH confidence
- [Calling Frontend from Rust (events)](https://v2.tauri.app/develop/calling-frontend/) — official docs, HIGH confidence
- [State Management in Tauri 2](https://v2.tauri.app/develop/state-management/) — official docs, HIGH confidence
- [tauri-specta v2 docs](https://specta.dev/docs/tauri-specta/v2) — official specta.dev, HIGH confidence
- [tauri-plugin-fs-watch README](https://github.com/tauri-apps/tauri-plugin-fs-watch/blob/dev/README.md) — official plugin, HIGH confidence
- [Tauri + Async Rust Process pattern](https://rfdonnelly.github.io/posts/tauri-async-rust-process/) — community article, MEDIUM confidence
- [Zustand state sync across Tauri windows](https://www.gethopp.app/blog/tauri-window-state-sync) — community article, MEDIUM confidence
- [MoonGuard: State in Tauri](https://blog.moonguard.dev/manage-state-with-tauri) — community article, MEDIUM confidence
