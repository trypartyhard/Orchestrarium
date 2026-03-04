# Domain Pitfalls: Tauri 2 + React File Manager with Real-Time Watchers

**Domain:** Tauri 2 desktop app — file-system-based manager with toggle/move operations and live FS watching
**Project:** Claude Agent Manager (CAM)
**Researched:** 2026-03-04
**Overall confidence:** HIGH (IPC/permissions/path pitfalls verified with official docs and confirmed bugs; race condition and YAML pitfalls confirmed with multiple sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architectural failures.

---

### Pitfall C-1: Capability Scope Misconfiguration Silently Blocks All File Operations

**What goes wrong:** You add `fs:allow-read-dir`, `fs:allow-rename`, `fs:allow-exists` to capabilities, run the app, and every file system operation throws a "forbidden path" error at runtime — even though the permission name appears correct.

**Why it happens:** Tauri 2's ACL system requires **two separate things**: (1) the operation permission (`fs:allow-rename`), AND (2) a scope entry that explicitly allows the path. Enabling a permission without a matching scope entry still denies access. The error message is generic ("forbidden path") with no indication that a scope is missing.

Confirmed bug: Adding permissions to `tauri.conf.json` directly (under `plugins`) instead of to a `capabilities/*.json` file causes silent failure — the permissions are simply ignored.

**Consequences:** App appears to start fine but every file operation fails. Debugging is very difficult because the error doesn't point to the real cause.

**Prevention:**
1. All file permissions go in `src-tauri/capabilities/default.json` — NOT in `tauri.conf.json`.
2. Every permission needs both the operation identifier AND an explicit scope:
```json
{
  "permissions": [
    "fs:allow-read-dir",
    "fs:allow-rename",
    "fs:allow-create-dir",
    "fs:allow-exists",
    { "identifier": "fs:scope", "allow": [{ "path": "$HOME/.claude/**" }] }
  ]
}
```
3. For recursive access use `$HOME/.claude/**` not `$HOME/.claude/*` — the double-star glob is required for subdirectories.

**Detection:** If file operations fail with "forbidden path" despite having permission names in capabilities, check: (a) are permissions in the right file? (b) is there a matching scope entry?

**Phase:** Phase 1 (project setup) — configure permissions before writing any file operation code.

---

### Pitfall C-2: Watching `.disabled/` Subdirectory Requires Explicit Permission + `requireLiteralLeadingDot: false`

**What goes wrong:** The FS watcher watches `~/.claude/agents/` but never fires events when files move into/out of the `.disabled/` hidden subfolder. The watcher appears to work for normal files but misses all toggle operations.

**Why it happens:** Tauri 2's FS plugin has a `requireLiteralLeadingDot` security option that, by default, prevents access to dotfiles and dotfolders. The `.disabled/` subfolder is a dotfolder, so it is excluded from watch scope and file operations by default. Additionally, the watch scope must explicitly cover the `.disabled/` path — watching `$HOME/.claude/agents/` does NOT automatically include `$HOME/.claude/agents/.disabled/`.

**Consequences:** Toggle operations (move file to `.disabled/`) work via Rust command but the watcher never detects them, causing the UI to show stale state.

**Prevention:**
1. Add to `tauri.conf.json`:
```json
{
  "plugins": {
    "fs": {
      "requireLiteralLeadingDot": false
    }
  }
}
```
2. Explicitly include `.disabled` paths in your scope:
```json
{ "identifier": "fs:scope", "allow": [
  { "path": "$HOME/.claude/**" },
  { "path": "$HOME/.claude/agents/.disabled/**" }
]}
```
3. Watch the parent directory recursively (`recursive: true`) rather than trying to watch subdirectories individually.

**Detection:** Toggle works but UI does not update; watcher fires for regular files but not after move-to-`.disabled` operations.

**Phase:** Phase 1 (project setup), confirmed before writing watcher logic.

---

### Pitfall C-3: serde_yaml Is Deprecated — Will Cause Compile/Maintenance Failures

**What goes wrong:** You add `serde_yaml` as a Rust dependency for YAML frontmatter parsing. It compiles and works initially, but the crate is archived and unmaintained (deprecated March 2024). Future Rust toolchain updates or transitive dependency changes can break it, and there is a documented panic bug.

**Why it happens:** `serde_yaml` was the de facto standard for YAML in Rust for years, making it the first result in many tutorials and Stack Overflow answers. The author archived the repository, citing correctness issues they couldn't fix.

**Consequences:** Dependency rot, potential panics on malformed YAML, zero security updates, breakage on future Rust editions.

**Prevention:**
- Use `serde_yml` (active fork) for general YAML serialization.
- For frontmatter extraction specifically, prefer `gray_matter` crate — it handles the `---` delimiter parsing, avoids the YAML body ambiguity, and supports YAML/TOML/JSON frontmatter gracefully.
- Example dependency:
```toml
[dependencies]
gray_matter = "0.2"  # or check current version on crates.io
serde = { version = "1", features = ["derive"] }
```

**Detection:** `serde_yaml` in `Cargo.toml` — replace before any code is written against it.

**Phase:** Phase 1 (project setup), before writing the parser module.

---

### Pitfall C-4: Watcher Feedback Loop — App's Own Toggle Operations Trigger Watcher Events

**What goes wrong:** When the user clicks a toggle, the Rust backend moves a file. This file-system change is detected by the watcher, which emits an event to the frontend. The frontend re-fetches the agent list, re-renders, and if the toggle animation is bound to the incoming state, it flickers or double-fires.

In dev mode: the Tauri dev watcher can enter an infinite rebuild loop if the watched directory overlaps with a path the app writes to during development.

**Why it happens:** File watchers on Windows use `ReadDirectoryChangesW` which fires for ALL changes in the watched tree — including changes made by the app itself. There is no "self-originated event" flag.

**Consequences:** Flickering UI, doubled state updates, potential infinite re-render loops, or (in dev mode) continuous rebuild cycles.

**Prevention:**
1. In the Rust watcher handler, implement an **operation lock**: set a flag/timestamp before every toggle operation, and in the event handler, ignore events that arrive within ~500ms of a self-initiated operation.
2. Alternatively, skip watcher-triggered re-fetch when the event path matches a path the app just modified (track a `HashSet<PathBuf>` of in-flight operations).
3. In the React frontend, use **optimistic UI** — update state immediately on toggle click without waiting for the watcher event. Only use watcher events for external changes.
4. For dev mode: add a `.taurignore` file in `src-tauri/` to exclude agent directories from the Tauri dev watcher.

**Detection:** Clicking toggle causes the card to flicker twice; logs show two consecutive state-update events for the same file.

**Phase:** Phase 2 (core toggle feature) — design the watcher architecture to include operation tracking from the start.

---

### Pitfall C-5: Group Toggle Partial Failure — No Rollback, Files Left in Inconsistent State

**What goes wrong:** A group has 15 agents. The user disables the group. The Rust backend starts moving files one by one. File #8 fails (e.g., file is open in another process, permissions issue on that specific file). Files 1–7 are disabled, 8–15 remain enabled. The UI shows the group as "mixed" state with no recovery path.

**Why it happens:** File move operations are not atomic in the OS sense. There is no transaction API for batch file operations. Each `rename()` call is independent.

**Consequences:** Partial group state that is confusing to users. Group toggle button is now in an indeterminate state. The only fix is to retry the failed file individually.

**Prevention:**
1. Implement the group toggle as a **collect-then-execute** pattern:
   - Phase A: Validate all files can be moved (check accessibility with `fs::metadata()`) before moving any.
   - Phase B: Execute moves only if all validations pass.
2. On partial failure, implement rollback: track successfully moved files and reverse them if any subsequent move fails.
3. Return a rich error response from the Rust command: `{ succeeded: [paths], failed: [{ path, reason }] }` so the frontend can show meaningful error state.
4. In the UI, show per-agent error indicators rather than a generic toast.

**Detection:** Group disable button results in some agents enabled, some disabled; no error is shown to the user.

**Phase:** Phase 2 (group toggle) — include rollback logic in initial implementation.

---

## Moderate Pitfalls

Mistakes that cause significant debugging time or user experience failures.

---

### Pitfall M-1: camelCase vs. snake_case Mismatch in Tauri IPC Arguments

**What goes wrong:** You define a Rust command `fn toggle_agent(agent_id: String, enabled: bool)`. You call it from TypeScript as `invoke('toggle_agent', { agent_id: 'foo', enabled: true })`. The call silently fails or throws a cryptic error.

**Why it happens:** Tauri 2's IPC bridge automatically converts Rust `snake_case` parameter names to `camelCase` when serializing for JavaScript. The TypeScript side must use `camelCase` by default: `{ agentId: 'foo', enabled: true }`. If you use `snake_case` on the JS side, the parameter is missing and deserialization fails.

**Consequences:** Silent command failures. The promise may reject with a non-obvious error, or (in some versions) hang without resolving. Extremely hard to debug without knowing this rule.

**Prevention:**
1. Always use `camelCase` on the TypeScript/JavaScript side for invoke parameters.
2. OR add `#[tauri::command(rename_all = "snake_case")]` to the Rust command to make it accept snake_case from JS — be consistent throughout.
3. Use `tauri-specta` or `tauri-bindgen` for type-safe, auto-generated TypeScript bindings — eliminates this category of bug entirely.

**Detection:** `invoke()` returns a rejected promise with "Command X not found" or the command runs but receives `None` for expected parameters.

**Phase:** Phase 1 (project setup) — establish the naming convention before writing any commands.

---

### Pitfall M-2: Windows Path Separator Inconsistency

**What goes wrong:** Paths passed between Rust and the frontend use backslashes on Windows (`C:\Users\User\.claude\agents`). JavaScript code that concatenates paths using `/` or does string comparisons fails silently because `C:/Users/User` !== `C:\Users\User`.

A specific confirmed bug: Tauri's dialog `defaultPath` parameter silently ignores the path if forward slashes are passed on Windows.

**Why it happens:** Windows uses backslash as separator but accepts forward slashes in most contexts (but not all). Tauri's `path` module normalizes paths on the Rust side, but string manipulation on the JS side bypasses normalization.

**Consequences:** File not found errors, incorrect path comparisons when filtering agents, broken dialog defaults.

**Prevention:**
1. Never construct paths by string concatenation in JavaScript — always use Tauri's `path` module APIs (`join()`, `homeDir()`, etc.).
2. Store and compare paths only in normalized form — normalize on the Rust side before returning to the frontend.
3. In Rust, use `std::path::PathBuf` everywhere and convert to string only at the IPC boundary.
4. For display in the UI, convert to forward-slash display format explicitly.

**Detection:** Agent cards appear but clicking toggle fails with "file not found"; path values in the frontend contain mixed separators.

**Phase:** Phase 1 (project setup) — establish path handling rules before any file ops.

---

### Pitfall M-3: Watcher Events Emitted Before Frontend Is Ready to Listen

**What goes wrong:** The Rust backend starts the file watcher in `setup()` hook. Before the React app finishes mounting and registering its `listen()` handlers, the watcher fires events (e.g., on startup when scanning). These early events are lost, causing the initial load to show stale or empty state.

**Why it happens:** Tauri's backend setup runs before the WebView is fully initialized. Events emitted from `setup()` or during the first ~100ms after setup never reach the frontend because JS event listeners are not yet registered.

**Consequences:** App opens with empty list requiring manual refresh, or initial state is incorrect.

**Prevention:**
1. Implement a **frontend-ready handshake**: the React app emits a `frontend-ready` event once mounted. The Rust backend only starts emitting watcher events after receiving this signal.
2. For the initial load, use an explicit `invoke('get_agents')` call on mount rather than relying on an emitted event.
3. Separate the initial data fetch (command-based, synchronous response) from the ongoing watcher updates (event-based).

**Detection:** App opens with blank list; refreshing or waiting a second shows the correct content.

**Phase:** Phase 2 (watcher integration) — design the initialization handshake first.

---

### Pitfall M-4: Windows `ReadDirectoryChangesW` Buffer Overflow Drops Events

**What goes wrong:** When the user performs a group toggle on a large group (50+ agents), the watcher fires rapidly as each file moves. The Windows kernel's internal buffer for `ReadDirectoryChangesW` fills up faster than it can be drained. Some events are silently discarded. The watcher emits fewer events than expected, causing the UI to show partially updated state.

**Why it happens:** `ReadDirectoryChangesW` (the underlying Windows API used by the `notify` crate) maintains a fixed-size buffer. During bulk file operations, the buffer overflows and `lpBytesReturned` returns 0 — meaning the entire buffer contents are discarded with no indication of which events were lost.

**Consequences:** After a group toggle of 50 agents, 5–10 agents may still appear in their old state in the UI.

**Prevention:**
1. After any group toggle operation completes, **always do a full re-scan** (invoke `get_agents()`) rather than relying on watcher events for correctness. Use watcher only for external changes.
2. Implement debouncing with a re-scan trigger: if X events arrive within Y ms, skip individual processing and do one full rescan.
3. For the toggle command itself, return the complete new state in the command response — don't wait for a watcher event to update UI.

**Detection:** Group toggle shows correct result immediately after (if using optimistic UI) but shows stale items after a few seconds if re-fetching from watcher events.

**Phase:** Phase 2 (watcher integration) — architecture decision to use commands for state (not watcher events).

---

### Pitfall M-5: YAML Frontmatter Edge Cases Cause Silent Drops or Panics

**What goes wrong:** An agent file with any of these characteristics causes the parser to fail silently or panic:

- **Colons in description**: `description: "Do X: then Y"` — the unquoted colon after the field value confuses some YAML parsers.
- **Multiline description**: Uses `|` or `>` block scalar syntax — parser may not be set up to handle it.
- **Missing frontmatter delimiter**: File starts with content but no `---` — parser returns empty/None and app shows the file with no name/description.
- **Tools field as array vs. string**: `tools: Read, Write` (string) vs. `tools: [Read, Write]` (array) — if the Rust struct expects one form and gets the other, deserialization fails.
- **No name field**: Agent file without a `name:` field in frontmatter — if the struct field is not `Option<String>`, the whole parse fails.

**Consequences:** Agent cards disappear from UI with no error (silent drop), or the app panics on startup if a bad file is in the agents directory.

**Prevention:**
1. Make ALL frontmatter fields `Option<T>` in the Rust struct — use fallbacks, never `unwrap()`.
2. Implement a "graceful degradation" parser: if frontmatter is missing or invalid, use filename as name and empty string as description, mark with `parse_error: true`.
3. Handle both string and array forms for `tools` using a custom serde deserializer or an enum wrapper.
4. Test against real-world agent files from the GSD kit before writing the parser spec.

**Detection:** An agent file exists on disk but does not appear in the list; check logs for parse errors.

**Phase:** Phase 1 (parser) — write the parser with these cases covered from the start.

---

### Pitfall M-6: `std::sync::Mutex` Deadlock in Async Tauri Commands

**What goes wrong:** You wrap shared app state (e.g., the list of watched paths) in `std::sync::Mutex<T>` and manage state with `tauri::State`. Inside an async command, you lock the mutex, do something async (await), then drop the lock. This panics or deadlocks because `std::sync::MutexGuard` cannot be held across `.await` points in async Rust.

**Why it happens:** `std::sync::Mutex` is synchronous. Its guard is not `Send`, so the compiler prevents holding it across `.await`. If you use unsafe workarounds or tokio's executor tries to move the future to another thread, the guard is left locked and the entire command hangs.

**Consequences:** Commands intermittently hang, causing the frontend to spin indefinitely. Particularly affects Windows where Tauri uses `tokio` as the async runtime.

**Prevention:**
1. Use `tokio::sync::Mutex` (not `std::sync::Mutex`) for any state accessed in async commands.
2. OR minimize the lock scope: lock, copy data out, unlock, then do async work with the copy.
3. Pattern: `let data = state.lock().await.clone(); // async work with data`.

**Detection:** Async commands work in some cases but occasionally hang with no error; frontend promise never resolves or rejects.

**Phase:** Phase 1 (project setup) — establish state management pattern before writing commands.

---

## Minor Pitfalls

Mistakes that cause friction but are easy to fix once identified.

---

### Pitfall m-1: SmartScreen Warning on Unsigned Windows Builds

**What goes wrong:** Users download the installer and Windows Defender SmartScreen blocks it with "This app is unrecognized and could harm your computer." Many users won't click through. This is specifically a distribution problem, not a code problem.

**Prevention:**
- For internal/developer use: document that SmartScreen can be bypassed via "More info" → "Run anyway".
- For public release: obtain an OV code signing certificate and sign the installer. Reputation builds over time with OV certificates. EV certificates provide immediate reputation but cost more.
- Consider NSIS installer over MSI for some scenarios (different SmartScreen behavior).

**Phase:** Phase 3 (packaging/distribution) — not an MVP blocker but required before public release.

---

### Pitfall m-2: Tauri 2 Event System Is Not Type-Safe — Use Commands for Data Transfer

**What goes wrong:** Developer uses `emit()` / `listen()` for sending agent data from Rust to React. The event payload is serialized as untyped JSON. TypeScript types at the listener site are not enforced. Any change to the payload structure silently breaks the consumer.

**Prevention:**
- Use `invoke()` (commands) for any data that has a defined structure — commands have typed return values that TypeScript can check.
- Use events ONLY for notifications (e.g., "something changed, please re-fetch") — not for carrying structured payloads.
- Pattern: watcher fires event `agents-changed`, React calls `invoke('get_agents')` in response. Watcher does not carry agent data in the event.

**Phase:** Phase 2 (watcher design).

---

### Pitfall m-3: `AppHandle` Path Resolution API Changed Between Tauri 1 and Tauri 2

**What goes wrong:** Tutorials and older code samples show `app.path_resolver().resolve_resource()` or `tauri::api::path::home_dir()`. In Tauri 2, this API was removed. `home_dir()` now requires an `AppHandle` instance.

**Why it happens:** In Tauri 2, path resolution requires an `App`, `AppHandle`, or `Window` instance — the standalone functions from v1 are gone. The `dirs` crate can be used as an alternative for paths that don't need Tauri-specific context.

**Prevention:**
```rust
// Tauri 2 correct pattern
fn my_command(app: tauri::AppHandle) -> String {
    let home = app.path().home_dir().unwrap();
    home.to_string_lossy().to_string()
}

// OR use dirs crate for home dir
let home = dirs::home_dir().expect("no home dir");
```

**Phase:** Phase 1 (project setup).

---

### Pitfall m-4: IPC Promise Hangs on Complex Return Types (Known Tauri 2 Bug)

**What goes wrong:** Commands returning simple types (`bool`, `String`, `u32`) work fine. Commands returning complex structs (`Vec<Agent>`) cause the JS promise to hang indefinitely and never resolve or reject. The Rust side logs successful execution.

**Why it happens:** Confirmed bug (Tauri GitHub issue #10327): the IPC fallback mechanism (used when CSP blocks the custom protocol) mishandles complex serialized responses. The fallback uses channels for large payloads, which deadlocks in certain network/CSP configurations.

**Prevention:**
- Test complex return types early in development.
- If hanging is observed, check if CSP settings are forcing the postMessage fallback.
- As a workaround, flatten complex response types into JSON-compatible primitives and reconstruct on the JS side.
- Keep an eye on Tauri changelogs — this was patched in later versions.

**Phase:** Phase 1 (first Tauri command implementation) — test with a complex return type immediately.

---

### Pitfall m-5: `.disabled/` Directory Must Be Created Before First Toggle

**What goes wrong:** First time a user disables an agent, the Rust code calls `fs::rename(src, dst)` where `dst` is inside `.disabled/`. If `.disabled/` doesn't exist, the rename fails with "No such file or directory" — not a permission error, just a missing directory.

**Prevention:**
```rust
// In toggler.rs, before every move:
let disabled_dir = parent_dir.join(".disabled");
fs::create_dir_all(&disabled_dir)?;
fs::rename(&src_path, &dst_path)?;
```
- Always call `create_dir_all` before rename — it's idempotent and costs nothing if dir exists.

**Phase:** Phase 2 (toggle implementation) — trivial fix but easy to miss in initial implementation.

---

## Phase-Specific Warning Matrix

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Project setup — Cargo.toml | Using deprecated `serde_yaml` | Use `serde_yml` + `gray_matter` |
| Project setup — capabilities | Missing scope in permissions | Template: operation permission + `fs:scope` allow entry |
| Project setup — capabilities | Dotfolder access blocked | Add `requireLiteralLeadingDot: false` to `tauri.conf.json` |
| Project setup — state | `std::sync::Mutex` in async commands | Use `tokio::sync::Mutex` from day one |
| Parser (Phase 1) | Rigid frontmatter struct fields | All fields `Option<T>`, graceful fallback |
| Parser (Phase 1) | `tools` field type variance | Custom deserializer for `tools: String | Array` |
| First commands | camelCase/snake_case mismatch | Document convention, use `rename_all` or `tauri-specta` |
| First commands | Complex return type IPC hang | Test `Vec<Agent>` return immediately, not just simple types |
| Watcher setup | Events before frontend ready | Frontend-ready handshake pattern |
| Watcher setup | Watching `.disabled/` not covered | Recursive watch of parent + explicit scope |
| Toggle logic | `.disabled/` dir missing | `create_dir_all` before every rename |
| Toggle logic | Watcher re-fires own operations | Op-tracking lock + optimistic UI |
| Group toggle | Partial failure, no rollback | Validate-all-then-execute + rollback tracking |
| Group toggle | Buffer overflow on 50+ agents | Full rescan after group op, not event counting |
| Path handling | Windows `\` vs `/` in JS | Use Tauri path module APIs exclusively |
| Distribution | SmartScreen blocks unsigned binary | Document workaround; plan code signing for v1 release |

---

## Sources

- Tauri 2 official docs — File System plugin: https://v2.tauri.app/plugin/file-system/
- Tauri 2 official docs — Calling Rust from frontend: https://v2.tauri.app/develop/calling-rust/
- Tauri 2 official docs — Capabilities: https://v2.tauri.app/security/capabilities/
- Tauri 2 official docs — Permissions: https://v2.tauri.app/security/permissions/
- Tauri 2 official docs — Windows code signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri 2 official docs — Windows installer: https://v2.tauri.app/distribute/windows-installer/
- GitHub: IPC promise hang on complex types (confirmed bug): https://github.com/tauri-apps/tauri/issues/10327
- GitHub: plugin-fs home permissions bug: https://github.com/tauri-apps/tauri/issues/10330
- GitHub: Unscoped fs permissions require allow entry: https://github.com/tauri-apps/tauri-docs/issues/3536
- GitHub: fs plugin forbidden path error when watching: https://github.com/tauri-apps/plugins-workspace/issues/1894
- GitHub: Events not reaching frontend (timing issue): https://github.com/tauri-apps/tauri/issues/4630
- GitHub: tauri dev infinite rebuild loop: https://github.com/tauri-apps/tauri/issues/11150
- GitHub: dialog defaultPath ignores forward slashes on Windows: https://github.com/tauri-apps/tauri/issues/8074
- Microsoft Learn: ReadDirectoryChangesW buffer overflow behavior: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw
- Rust Forum: serde_yaml deprecation and alternatives: https://users.rust-lang.org/t/serde-yaml-deprecation-alternatives/108868
- GitHub: serde_yml panic bug report: https://users.rust-lang.org/t/serde-yml-bug-which-causes-a-panic/120489
- Tauri 2 blog: Migration guide from Tauri 1: https://v2.tauri.app/start/migrate/from-tauri-1/
- Tauri 2 State Management docs: https://v2.tauri.app/develop/state-management/
