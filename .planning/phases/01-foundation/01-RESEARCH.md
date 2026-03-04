# Phase 1: Foundation — Research

**Researched:** 2026-03-04
**Phase goal:** Rust backend fully functional — scanner, parser, toggler, groups, IPC commands, correct permissions
**Requirements:** SCAN-01, SCAN-02, SCAN-03, SCAN-04

## Verified Versions

| Crate | Version | Status |
|-------|---------|--------|
| gray_matter | 0.3.2 | Confirmed on crates.io (2025-07-10) |
| tauri-specta | 2.0.0-rc.21 | Confirmed on crates.io (2025-01-13), Tauri 2 compatible |
| notify | 8.2.0 | Confirmed (not needed Phase 1, but scanner module structure matters) |
| tauri | 2.10.x | Confirmed stable |
| serde | 1.x | Standard |

## Scaffolding

```bash
npm create tauri-app@latest claude-agent-manager -- --template react-ts
```

This creates: React 19 + Vite 7 + TypeScript + Tauri 2 project structure.

## Critical Setup (from PITFALLS.md)

### 1. Capabilities (C-1): `src-tauri/capabilities/default.json`
```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "fs:allow-rename",
    "fs:allow-create-dir",
    "fs:allow-exists",
    "fs:allow-remove-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$HOME/.claude/**" }] }
  ]
}
```

### 2. Dotfolder Access (C-2): `tauri.conf.json`
```json
{
  "plugins": {
    "fs": {
      "requireLiteralLeadingDot": false
    }
  }
}
```

### 3. State Pattern (M-6): Use `tokio::sync::Mutex`
```rust
use tokio::sync::Mutex;
struct AppState {
    agents: Mutex<Vec<AgentInfo>>,
    skills: Mutex<Vec<AgentInfo>>,
    commands: Mutex<Vec<AgentInfo>>,
}
```

### 4. Path Handling (M-2): Always use `dirs::home_dir()` or `app.path().home_dir()`

## Parser Design

gray_matter API:
```rust
use gray_matter::Matter;
use gray_matter::engine::YAML;
use serde::Deserialize;

#[derive(Deserialize, Default)]
struct Frontmatter {
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
    model: Option<String>,
    tools: Option<serde_json::Value>, // handles both string and array
}

let matter = Matter::<YAML>::new();
let result = matter.parse(content);
let frontmatter: Frontmatter = result.data
    .and_then(|d| d.deserialize().ok())
    .unwrap_or_default();
```

All fields `Option<T>` — graceful degradation on malformed frontmatter (M-5).

## Scanner Design

Scan pattern for each section (agents/skills/commands):
1. Read `~/.claude/{section}/` → list `.md` files → enabled
2. Read `~/.claude/{section}/.disabled/` → list `.md` files → disabled
3. Parse frontmatter for each file
4. Assign groups by filename prefix

## Toggler Design

```rust
fn toggle(path: &Path, enable: bool) -> Result<PathBuf, String> {
    let parent = path.parent().unwrap();
    if enable {
        // Move from .disabled/ to parent's parent
        let target = parent.parent().unwrap().join(path.file_name().unwrap());
        std::fs::rename(path, &target)?;
        Ok(target)
    } else {
        // Move to .disabled/
        let disabled_dir = parent.join(".disabled");
        std::fs::create_dir_all(&disabled_dir)?; // m-5: always create first
        let target = disabled_dir.join(path.file_name().unwrap());
        std::fs::rename(path, &target)?;
        Ok(target)
    }
}
```

## Groups Design

Prefix extraction: `gsd-planner.md` → prefix "gsd", group name "GSD".
Files without shared prefix → group "Custom".

```rust
fn extract_prefix(filename: &str) -> Option<String> {
    let stem = filename.trim_end_matches(".md");
    stem.split('-').next().filter(|p| {
        // Only if there are other files with same prefix
        p.len() > 1
    }).map(|s| s.to_uppercase())
}
```

## tauri-specta Setup

```rust
// Cargo.toml
tauri-specta = { version = "=2.0.0-rc.21", features = ["derive", "typescript"] }
specta = { version = "=2.0.0-rc.22", features = ["derive"] }
specta-typescript = "0.0.9"

// main.rs
let builder = tauri_specta::Builder::<tauri::Wry>::new()
    .commands(tauri_specta::collect_commands![
        get_agents, get_skills, get_commands,
        toggle_item, toggle_group
    ]);

#[cfg(debug_assertions)]
builder.export(specta_typescript::Typegen::default(), "../src/bindings.ts")?;
```

## Validation Architecture

### Unit Tests
- `parser.rs`: test valid frontmatter, malformed YAML, missing frontmatter, tools as string vs array
- `scanner.rs`: test with temp dirs containing .md files and .disabled/ subdir
- `toggler.rs`: test enable/disable moves, .disabled/ creation, error on locked file
- `groups.rs`: test prefix extraction, grouping logic

### Integration Tests
- Full scan → parse → group pipeline with realistic agent files
- Toggle → re-scan → verify state consistency

---
*Research completed: 2026-03-04*
