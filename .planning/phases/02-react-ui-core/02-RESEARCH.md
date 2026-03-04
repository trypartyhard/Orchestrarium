# Phase 2: React UI Core — Research

**Researched:** 2026-03-04
**Phase goal:** Full React frontend: cards, sidebar, toggle, search, filters, status bar, dark theme
**Requirements:** DISP-01..08, TOGL-01..03, NAV-01..04

## Available API Surface (from Phase 1)

### TypeScript Bindings (`src/bindings.ts`)
```typescript
type AgentInfo = {
  id: string;          // "{section}/{filename}"
  filename: string;    // "gsd-planner.md"
  name: string;        // from frontmatter or filename fallback
  description: string | null;
  color: string | null;
  model: string | null;
  tools: string[] | null;
  enabled: boolean;
  path: string;        // full filesystem path
  section: string;     // "agents" | "skills" | "commands"
  group: string;       // auto-detected prefix group or "Custom"
  invalid_config: boolean;
};

getAgents(): Promise<AgentInfo[]>
getSkills(): Promise<AgentInfo[]>
getCommands(): Promise<AgentInfo[]>
toggleItem(path, enable, section): Promise<AgentInfo>
```

## Stack Already Installed

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| Zustand | 5 | State management |
| lucide-react | 0.468+ | Icon library |
| Tailwind CSS | 4 | Styling (via @tailwindcss/vite plugin) |
| @tauri-apps/api | 2 | IPC invoke |

No additional dependencies needed.

## Design Decisions

### Color Palette (DISP-07)
- Background: `#12121c` (deep dark blue)
- Surface: `#1a1a2e` (card background)
- Surface hover: `#22223a`
- Border: `#2a2a44`
- Text primary: `#d0d0e8`
- Text secondary: `#555577`
- Accent: `#00d4aa` (teal green)
- Accent hover: `#00b894`
- Error: `#ff6b6b`
- Toggle ON: `#00d4aa`
- Toggle OFF: `#555577`
- Disabled card opacity: 0.5

### Layout Structure
```
┌─────────┬──────────────────────────────────────┐
│ SIDEBAR │ HEADER (search bar + filter pills)   │
│         ├──────────────────────────────────────┤
│ Agents  │                                      │
│ Skills  │  AGENT LIST (groups + cards)         │
│ Commands│                                      │
│         │                                      │
│         │                                      │
│         ├──────────────────────────────────────┤
│         │ STATUS BAR                           │
└─────────┴──────────────────────────────────────┘
```
- Sidebar width: ~200px fixed
- Cards: compact horizontal layout within groups

### State Management (Zustand)

Single store with sections:
```typescript
interface AppStore {
  // Data
  agents: AgentInfo[];
  skills: AgentInfo[];
  commands: AgentInfo[];

  // UI state
  activeSection: 'agents' | 'skills' | 'commands';
  searchQuery: string;
  filter: 'all' | 'enabled' | 'disabled';

  // Actions
  loadSection: (section: string) => Promise<void>;
  toggleItem: (path: string, enable: boolean, section: string) => Promise<void>;
  setActiveSection: (section: string) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: string) => void;
}
```

### Optimistic Toggle (TOGL-03)
1. User clicks toggle → immediately flip `enabled` in store
2. Call `toggleItem()` IPC
3. On success → update with returned AgentInfo
4. On error → revert store state, show toast

### Group Toggle (TOGL-02)
1. Determine all items in group
2. Flip all to target state optimistically
3. Call toggleItem for each sequentially
4. On partial failure → revert failed items, show toast

### Search/Filter (NAV-02, NAV-03)
- Computed from store: `items.filter(matchesSearch).filter(matchesFilter)`
- Search matches against `name` and `description`
- Case-insensitive substring match
- Filter counts derived from unfiltered items in current section

### Keyboard Shortcut (NAV-04)
- Ctrl+F: focus search input (prevent browser default)
- Use `useEffect` with keydown listener

## Component Architecture

### Primitives
- `Toggle` — switch component with ON/OFF visual states
- `ColorDot` — renders frontmatter color as circle, grey fallback
- `Badge` — small label (e.g., "invalid config")
- `SearchBar` — input with search icon
- `FilterPills` — "All (N) | Enabled (N) | Disabled (N)"
- `Toast` — error notification, auto-dismiss

### Layout
- `Sidebar` — section navigation (Agents/Skills/Commands) with active indicator
- `Header` — search bar + filter pills
- `StatusBar` — scan path, enabled/disabled counts, version

### Feature
- `AgentCard` — name, description, color dot, toggle, invalid badge
- `AgentGroup` — collapsible group header with count + group toggle
- `AgentList` — groups + ungrouped items

### Wiring
- `App.tsx` — layout shell, loads active section on mount/change
- Each section reuses same components, different data source

## Validation Architecture

### Visual Verification
- Screenshot comparison not practical in CLI
- Verify through: component renders without errors, correct classNames applied, toggle state matches store

### Functional Verification
- Toggle changes store state
- Search filters displayed items
- Section switch loads correct data
- Error toast appears on toggle failure

---
*Research completed: 2026-03-04*
