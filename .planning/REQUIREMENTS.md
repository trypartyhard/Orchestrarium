# Requirements: Claude Agent Manager (CAM)

**Defined:** 2026-03-04
**Core Value:** Разработчик может мгновенно включить или выключить любого агента/skill/command Claude Code одним кликом

## v1 Requirements

### Scanning

- [ ] **SCAN-01**: App auto-discovers all `.md` files in `~/.claude/agents/`, `skills/`, `commands/` at startup
- [ ] **SCAN-02**: App parses YAML frontmatter (name, description, color, model) with graceful degradation on malformed files
- [ ] **SCAN-03**: App detects enabled/disabled state by checking presence in `.disabled/` subdirectory
- [ ] **SCAN-04**: App auto-groups agents by filename prefix (e.g. `gsd-*.md` → "GSD")

### Display

- [ ] **DISP-01**: User sees agent cards with name, description, and enabled/disabled visual state
- [ ] **DISP-02**: User sees color dot on card from frontmatter `color` field (grey fallback)
- [ ] **DISP-03**: Disabled cards have reduced opacity (0.5) with grey toggle
- [ ] **DISP-04**: User sees collapsible groups with name, count, and group toggle in header
- [ ] **DISP-05**: User sees "invalid config" badge on cards with malformed frontmatter
- [ ] **DISP-06**: User sees empty state message when directory not found or no agents installed
- [ ] **DISP-07**: App uses dark theme (`#12121c` background, `#00d4aa` accent)
- [ ] **DISP-08**: User sees status bar with scan path, enabled/disabled counts, app version

### Toggle

- [ ] **TOGL-01**: User can toggle individual agent ON/OFF — file moves to/from `.disabled/` with <200ms UI feedback
- [ ] **TOGL-02**: User can toggle entire group ON/OFF — all files in group move atomically with rollback on partial failure
- [ ] **TOGL-03**: Toggle uses optimistic UI — state flips immediately, reverts on error

### Navigation

- [ ] **NAV-01**: User can switch between Agents, Skills, Commands sections via sidebar
- [ ] **NAV-02**: User can search by name and description with instant filtering
- [ ] **NAV-03**: User can filter by All / Enabled / Disabled with dynamic counts
- [ ] **NAV-04**: User can focus search with Ctrl+F keyboard shortcut

### Live Updates

- [ ] **LIVE-01**: App watches filesystem for external changes via Rust `notify` crate with 300ms debounce
- [ ] **LIVE-02**: App suppresses watcher events from self-initiated toggle operations (no feedback loop)
- [ ] **LIVE-03**: App uses frontend-ready handshake — initial load via `invoke()`, watcher events after React mount

### Distribution

- [ ] **DIST-01**: App builds as Windows installer (.msi or NSIS .exe)
- [ ] **DIST-02**: App includes icon and version metadata in installer

## v2 Requirements

### Editor

- **EDIT-01**: User can view full agent prompt content in detail view
- **EDIT-02**: User can edit agent files from GUI

### Import

- **IMPT-01**: User can import agents from GitHub URL
- **IMPT-02**: User can drag-and-drop `.md` files to install

### Scope

- **SCOP-01**: User can switch between Global (`~/.claude/`) and Project (`./.claude/`) scope
- **SCOP-02**: User sees model badge on cards (sonnet/opus/haiku)

### Platform

- **PLAT-01**: App builds for macOS (.dmg)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Marketplace / agent discovery | Premature until core toggle UX is proven |
| MCP server management | Different tool (opcode, claude-code-tool-manager) |
| Session management | Different tool (Claudia, opcode) |
| Usage analytics / statistics | Other tools do this better |
| Light theme | Zero benefit for developer audience |
| Confirmation dialogs on toggle | Adds friction to trivially reversible action |
| Auto-update agent content | Crosses into package manager territory |
| Multi-tool sync (Cursor, Gemini CLI) | Out of scope for all versions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 1 | Pending |
| SCAN-02 | Phase 1 | Pending |
| SCAN-03 | Phase 1 | Pending |
| SCAN-04 | Phase 1 | Pending |
| DISP-01 | Phase 2 | Pending |
| DISP-02 | Phase 2 | Pending |
| DISP-03 | Phase 2 | Pending |
| DISP-04 | Phase 2 | Pending |
| DISP-05 | Phase 2 | Pending |
| DISP-06 | Phase 2 | Pending |
| DISP-07 | Phase 2 | Pending |
| DISP-08 | Phase 2 | Pending |
| TOGL-01 | Phase 2 | Pending |
| TOGL-02 | Phase 2 | Pending |
| TOGL-03 | Phase 2 | Pending |
| NAV-01 | Phase 2 | Pending |
| NAV-02 | Phase 2 | Pending |
| NAV-03 | Phase 2 | Pending |
| NAV-04 | Phase 2 | Pending |
| LIVE-01 | Phase 3 | Pending |
| LIVE-02 | Phase 3 | Pending |
| LIVE-03 | Phase 3 | Pending |
| DIST-01 | Phase 4 | Pending |
| DIST-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation — all 24 requirements mapped*
