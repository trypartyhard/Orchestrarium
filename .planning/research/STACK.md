# Technology Stack

**Project:** Claude Agent Manager (CAM)
**Researched:** 2026-03-04
**Research Mode:** Ecosystem — Stack dimension

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | 2.10.x (latest stable) | Desktop app shell, Rust/JS bridge | Stable since Oct 2024; 5-10 MB binary vs Electron's 200+ MB; native Rust FS ops; official Windows NSIS/MSI installer support built-in |
| React | 19 | Frontend UI | Current major version; production-ready Tauri templates use React 19; concurrent features not strictly needed here but no downside |
| TypeScript | 5.x | Type safety | Tauri's JS API is fully typed; TS is mandatory for Tauri's `invoke()` to be usable without foot-guns |
| Vite | 7.x | Frontend build tool | Tauri 2 officially recommends Vite for SPA frameworks; Tauri dev server integration built around Vite HMR |
| Rust | 1.77+ (stable toolchain) | Backend logic | Required by Tauri 2; MSRV is 1.77.2 per tauri-plugin-fs docs |

**Confidence:** HIGH — Tauri 2.10.2 is the current stable (February 2025, GitHub releases). React 19 and Vite 7 confirmed by production Tauri template analysis.

### Rust Backend Crates

| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| tauri | 2.10.x | App framework | Core Tauri crate, pins to latest stable |
| tauri-plugin-fs | 2.4.x | File system operations from frontend | Official Tauri plugin; includes `watch`/`watchImmediate`; version 2.4.5 is current. Use for directory scanning exposed to JS side |
| notify | 8.2.0 | Rust-side file system watcher | The standard for FS watching in Rust; used by Tauri internally, alacritty, cargo-watch, deno; v8.0+ requires Rust 1.77 (matches Tauri MSRV). Use for the background watcher thread that emits events to frontend via `AppHandle::emit()` |
| gray_matter | 0.3.2 | YAML frontmatter parsing | Pure Rust gray-matter port; uses yaml-rust2 internally (NOT the deprecated serde_yaml); serde-compatible for deserializing into typed structs; handles malformed frontmatter gracefully |
| serde | 1.x | Serialization | Required for Tauri command return types and gray_matter deserialization |
| serde_json | 1.x | JSON for .agent-groups.json | Standard; already a Tauri transitive dependency |
| tokio | (via Tauri's async_runtime) | Async runtime | Tauri owns and initializes the Tokio runtime; do NOT add `#[tokio::main]`; use `tauri::async_runtime::spawn()` for background tasks |

**Confidence:** HIGH for tauri/notify/serde. MEDIUM for gray_matter (version from docs.rs, no serde_yaml deprecation concern confirmed).

**Critical note on serde_yaml:** serde_yaml was deprecated and its repository archived on March 25, 2024. Do NOT use it. gray_matter 0.3.2 uses yaml-rust2 internally, which is the community-maintained successor. This is the correct choice.

### Frontend Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @tauri-apps/api | 2.x | Tauri JS bridge | `invoke()`, `listen()`, `emit()` — mandatory |
| @tauri-apps/plugin-fs | 2.4.x | FS plugin JS bindings | Matches the Rust plugin; provides `watch`/`watchImmediate` from JS (use for supplemental operations) |
| tailwindcss | 4.x | Utility CSS | v4 released January 22, 2025; new CSS-first config (no tailwind.config.js needed); @tailwindcss/vite plugin replaces postcss pipeline; significantly faster builds |
| @tailwindcss/vite | 4.x | Tailwind Vite plugin | Replaces the old postcss integration; mandatory for Tailwind v4 with Vite |
| lucide-react | latest (0.4xx) | Icons | Best bundle efficiency among icon libs (1.0x delta ratio vs Phosphor's 16-18x overhead); 1,500+ consistent stroke icons; used by shadcn/ui; covers all needed icons (toggle, search, robot, book, terminal, settings) |
| zustand | 5.x | Frontend state management | Centralized store ideal for this app's interconnected state (agents list, filters, search query, active section); lighter than Redux; more ergonomic than Context for this use case |
| gray-matter | 4.x | YAML frontmatter parsing (JS side) | Battle-tested; used by VitePress, Astro, Gatsby, etc.; parses YAML by default; browser-compatible (fs field in package.json disables Node fs for browser); used as fallback/preview in frontend only |

**Confidence:** HIGH for Tauri API, Tailwind v4, lucide-react, zustand. MEDIUM for gray-matter (version stable since 2020, widely used but not frequently updated).

### What NOT to Use

| Library | Category | Why Not |
|---------|----------|---------|
| Electron | Desktop framework | 200+ MB binary; excessive RAM usage; defeats the purpose of choosing Tauri |
| serde_yaml | Rust YAML | Deprecated and archived March 2024; do not use |
| Redux / Redux Toolkit | State management | Overkill for this app's complexity; verbose boilerplate; Zustand covers the same needs in 1/5 the code |
| Jotai | State management | Atomic model is optimal for fine-grained per-component state; this app has more interconnected, list-oriented state that suits Zustand's centralized store better |
| Ant Design / Material UI | UI components | Over-engineered for a utility tool; brings light-theme defaults that fight the custom dark palette; heavy bundle; we're building custom components with Tailwind instead |
| shadcn/ui | UI component library | Good choice for new projects using shadcn's default palette, but this project has a precisely defined custom dark color palette (spec-level colors like #12121c, #1e1e32) that would require re-theming every shadcn component; using Tailwind directly with Lucide icons is cleaner |
| @tauri-apps/plugin-fs-watch | Rust watcher plugin | This was the Tauri v1 pattern; in Tauri 2, watch is built into tauri-plugin-fs |
| React Query / TanStack Query | Server state | This app has no network requests to a backend; all data comes from local FS via Tauri commands; React Query solves a different problem |
| @types/js-yaml | JS YAML parser | The spec mentions js-yaml, but gray-matter wraps js-yaml already and ships its own types; avoid double-parsing on the frontend |
| Next.js | Frontend framework | Tauri works with Next.js but it adds unnecessary complexity (SSR/SSG concepts don't apply to a desktop app); Vite SPA is the right fit |

---

## Tailwind v4 Dark Mode Setup

Tailwind v4 changed how dark mode is configured. The old `darkMode: 'class'` config option is removed. Use CSS custom variants instead:

```css
/* src/styles/globals.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg-primary: #12121c;
  --color-bg-sidebar: #16162a;
  --color-bg-card: #1e1e32;
  --color-text-primary: #d0d0e8;
  --color-text-secondary: #555577;
  --color-accent: #00d4aa;
  --color-border: #2a2a40;
}
```

The app can simply force `.dark` on `<html>` at startup (always-dark per spec); no toggle logic needed for v0.1.

```typescript
// main.tsx — force dark mode globally
document.documentElement.classList.add('dark');
```

**Confidence:** MEDIUM — Multiple 2025 sources confirm this pattern for Tailwind v4. The `@custom-variant` approach is the official replacement.

---

## Rust FS Operations Pattern

The correct pattern for file watching that pushes events to the React frontend:

```rust
// In setup() hook — spawn background watcher
.setup(|app| {
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |res| {
            tx.send(res).unwrap();
        }).unwrap();

        // Watch ~/.claude/agents/ recursively
        watcher.watch(agents_path, notify::RecursiveMode::Recursive).unwrap();

        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    // Emit to all frontend listeners
                    handle.emit("fs-changed", &event).unwrap();
                }
                _ => break,
            }
        }
    });
    Ok(())
})
```

**Key insight:** Tauri manages the Tokio runtime. Use `tauri::async_runtime::spawn()`, NOT `tokio::spawn()` directly in the setup hook. Pass a cloned `AppHandle` into the spawned task for emitting events.

**Confidence:** MEDIUM — Pattern derived from official Tauri docs on calling frontend from Rust and community discussions. The `app.handle().clone()` + `emit()` approach is the documented path.

---

## File System Permissions Configuration

For this app, reading `~/.claude/` requires explicit permission grants in Tauri 2's capability system:

```toml
# src-tauri/permissions/home-access.toml
[[permission]]
identifier = "allow-claude-home"
description = "Read/write access to ~/.claude/ for agent management"
commands.allow = [
  "read_dir", "read_file", "read_text_file",
  "write_file", "write_text_file",
  "create_dir", "rename", "remove_file"
]

[[scope.allow]]
path = "$HOME/.claude/**"
```

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-claude-home",
    "fs:default"
  ]
}
```

**Confidence:** MEDIUM — Permission variable `$HOME` is documented. The exact permission identifier format follows official Tauri 2 security docs. Verify against tauri-plugin-fs 2.4.x permission list at build time.

---

## Installation Commands

```bash
# 1. Scaffold project
npm create tauri-app@latest claude-agent-manager
# Select: react-ts template, Vite, TypeScript

cd claude-agent-manager

# 2. Frontend dependencies
npm install
npm install @tauri-apps/plugin-fs
npm install zustand@5
npm install lucide-react
npm install gray-matter
npm install -D @types/gray-matter

# 3. Tailwind v4 (already via Vite plugin)
npm install -D tailwindcss @tailwindcss/vite

# 4. Rust backend (Cargo.toml additions)
# tauri-plugin-fs = "2"
# notify = "8"
# gray_matter = "0.3"
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Desktop framework | Tauri 2 | Electron | 20x larger binary, 5x more RAM, no Rust advantages |
| Frontend framework | React 19 | Vue 3, Svelte | Both viable; React chosen per spec; larger ecosystem for dark-themed dev tool UI libraries |
| CSS approach | Tailwind v4 direct | shadcn/ui | Custom color palette in spec makes shadcn's re-theming overhead not worth it |
| Rust YAML parser | gray_matter 0.3 | serde_yaml | serde_yaml deprecated/archived March 2024 |
| Rust YAML parser | gray_matter 0.3 | serde-saphyr | serde-saphyr has no frontmatter extraction; would need manual `---` splitting |
| FS watcher (Rust) | notify 8.x | tauri-plugin-fs watch | notify gives more control in background thread; plugin-fs watch is JS-facing; use notify for Rust-side watcher, plugin-fs for JS-side supplemental ops |
| State management | Zustand 5 | Jotai | Zustand better for interconnected list state (agents + groups + filters as one store); Jotai excels at fine-grained atomic state |
| Icons | lucide-react | Phosphor Icons | Phosphor has 16-18x bundle overhead per icon vs Lucide's ~1x; for a utility app, bundle size matters |

---

## Sources

- Tauri 2.10.2 stable release: https://github.com/tauri-apps/tauri/releases
- Tauri 2.0 stable announcement (October 2024): https://v2.tauri.app/blog/tauri-20/
- Tauri file system plugin: https://v2.tauri.app/plugin/file-system/
- Tauri state management: https://v2.tauri.app/develop/state-management/
- Tauri calling frontend from Rust: https://v2.tauri.app/develop/calling-frontend/
- Tauri security permissions: https://v2.tauri.app/security/permissions/
- notify crate releases (v8.2.0 latest stable): https://github.com/notify-rs/notify/releases
- gray_matter crate docs (v0.3.2, uses yaml-rust2): https://docs.rs/gray_matter/latest/gray_matter/
- @tauri-apps/plugin-fs npm (v2.4.5): https://docs.rs/crate/tauri-plugin-fs/latest
- serde_yaml deprecation: https://users.rust-lang.org/t/serde-yaml-deprecation-alternatives/108868
- Tailwind CSS v4 release (January 22, 2025): https://tailwindcss.com/blog/tailwindcss-v4
- Tailwind v4 dark mode: https://tailwindcss.com/docs/dark-mode
- Tailwind v4 Vite+React dark mode setup: https://github.com/tailwindlabs/tailwindcss/discussions/16925
- Production Tauri v2 template (React 19, Vite 7, Zustand 5): https://github.com/dannysmith/tauri-template
- Tauri + shadcn/ui community template: https://github.com/agmmnn/tauri-ui
- Lucide bundle efficiency vs Phosphor: https://medium.com/codetodeploy/the-hidden-bundle-cost-of-react-icons-why-lucide-wins-in-2026-1ddb74c1a86c
- Zustand vs Jotai for desktop apps: https://makersden.io/blog/react-state-management-in-2025
