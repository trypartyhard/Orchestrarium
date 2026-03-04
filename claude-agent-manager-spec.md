# Claude Agent Manager — Техническое задание

## Обзор проекта

**Название:** Claude Agent Manager (рабочее название — CAM)

**Суть:** Десктопное приложение для визуального управления агентами, skills и commands в Claude Code. Позволяет включать/выключать отдельные агенты и целые наборы через тумблеры в GUI, без ручного редактирования файлов.

**Проблема:** Сейчас управление агентами и skills в Claude Code происходит только через файловую систему — нужно вручную перемещать, удалять или переименовывать markdown-файлы. Нет визуального интерфейса, нет возможности быстро включить/выключить агента или набор агентов. Существующие GUI-инструменты (opcode, CodePilot) управляют сессиями, но не предоставляют тумблеры on/off для агентов и skills.

**Целевая аудитория:** Разработчики, использующие Claude Code, которые устанавливают наборы агентов (GSD, agency-agents и другие) и хотят управлять ими визуально.

**Платформы:** macOS, Windows

**Лицензия:** MIT

---

## Технический стек

**Framework:** Tauri 2 (Rust backend + веб-фронтенд)

**Frontend:** React + TypeScript + Tailwind CSS

**Backend (Rust):** Файловые операции, наблюдение за изменениями в файловой системе (file watcher)

**Сборка:** Tauri CLI для macOS (.dmg) и Windows (.msi/.exe)

### Почему Tauri, а не Electron

- Размер приложения: 5-10 MB вместо 200+ MB
- Меньше потребление RAM
- Нативная производительность файловых операций через Rust
- Кроссплатформенная сборка из коробки

---

## Архитектура

### Принцип работы

Приложение сканирует стандартные директории Claude Code и отображает найденные файлы как карточки с тумблерами. Включение/выключение агента — это перемещение файла между активной директорией и директорией `.disabled/` внутри неё.

### Директории сканирования

```
# Agents (глобальные)
~/.claude/agents/*.md

# Agents (проектные)
./.claude/agents/*.md

# Skills (глобальные)
~/.claude/skills/*/SKILL.md

# Skills (проектные)
./.claude/skills/*/SKILL.md

# Commands (глобальные)
~/.claude/commands/**/*.md

# Commands (проектные)
./.claude/commands/**/*.md
```

### Механизм включения/выключения

**Включение (ON):**
Файл находится в стандартной директории Claude Code. Claude Code видит его и может использовать.

**Выключение (OFF):**
Файл перемещается в поддиректорию `.disabled/` с сохранением относительного пути.

Пример:
```
# Агент включён
~/.claude/agents/gsd-planner.md

# Агент выключен
~/.claude/agents/.disabled/gsd-planner.md
```

Для skills:
```
# Skill включён
~/.claude/skills/api-conventions/SKILL.md

# Skill выключен — перемещается вся папка
~/.claude/skills/.disabled/api-conventions/SKILL.md
```

Claude Code не сканирует `.disabled/` (скрытые директории игнорируются), поэтому перемещённые файлы становятся невидимыми для него.

### Группировка агентов в наборы

Приложение автоматически определяет наборы по префиксу имени файла:
- `gsd-*.md` → группа "GSD (Get Shit Done)"
- Файлы без общего префикса → группа "Custom"

Дополнительно: файл `.claude/agents/.agent-groups.json` (создаётся приложением) хранит пользовательскую группировку:
```json
{
  "groups": [
    {
      "id": "gsd",
      "name": "GSD (Get Shit Done)",
      "color": "#00d4aa",
      "pattern": "gsd-*",
      "source": "auto"
    },
    {
      "id": "agency",
      "name": "Agency Agents",
      "color": "#f59e0b",
      "agents": ["engineering-frontend-developer", "engineering-backend-architect"],
      "source": "manual"
    }
  ]
}
```

---

## Интерфейс пользователя

### Общее описание

Тёмная тема в стиле developer tools. Минималистичный утилитарный интерфейс без лишних украшений.

### Цветовая палитра

```
Фон окна:            #12121c
Фон сайдбара:         #16162a
Фон заголовка группы: #1a1a2e
Фон карточки:         #1e1e32
Карточка выключена:   #1e1e32 с opacity 0.5
Текст основной:       #d0d0e8
Текст вторичный:      #555577
Текст неактивный:     #444466
Акцент (ON):          #00d4aa
Toggle OFF:           #3a3a4a
Бордер:               #2a2a40
```

### Шрифты

- Заголовки и UI: Inter (или системный sans-serif)
- Моноширинный (пути, теги): JetBrains Mono (или системный monospace)

### Структура окна

```
┌─────────────────────────────────────────────────────┐
│  ● ● ●        Claude Agent Manager                  │  ← Title bar
├────┬────────────────────────────────────────────────┤
│    │  Agents                                         │
│ 🤖 │  Manage your Claude Code agents and subagents   │
│    │                                                 │
│ 📚 │  [🔍 Search agents...]  [All] [Enabled] [Off]  │
│    │                                                 │
│ ⌨️  │  ▼ [GSD] Get Shit Done    9 agents    [====]   │
│    │    ● gsd-planner         planning     [====]   │
│    │    ● gsd-executor        execution    [====]   │
│    │    ● gsd-verifier        verification [====]   │
│    │    ○ gsd-phase-researcher research    [----]   │
│    │    ● gsd-plan-checker    validation   [====]   │
│    │                                                 │
│    │  ▶ [Custom] My Agents      3 agents    [====]   │
│    │                                                 │
│    │  ▶ [Agency] Agency Agents  51 agents   [----]   │
│    │                                   disabled      │
│ ⚙️  │                                                 │
├────┴────────────────────────────────────────────────┤
│  ~/.claude/agents/     ● 9 active   ○ 5 disabled    │  ← Status bar
└─────────────────────────────────────────────────────┘
```

### Сайдбар (64px)

Вертикальная панель слева с иконками секций:
- **Agents** (иконка робота) — активная секция подсвечивается акцентным цветом + индикатор слева
- **Skills** (иконка книги)
- **Commands** (иконка терминала)
- **Settings** (иконка шестерёнки) — внизу сайдбара

Без текстовых подписей, только иконки. Hover-эффект — лёгкая подсветка фона.

### Основная область — секция Agents

**Заголовок секции:**
- Название секции (h1): "Agents"
- Подзаголовок: "Manage your Claude Code agents and subagents"
- Справа вверху: счётчики "Total: 14" и "Active: 9"

**Панель фильтров:**
- Поле поиска с иконкой лупы (фильтрует по имени и описанию)
- Пилюли-фильтры: All / Enabled / Disabled (активная пилюля подсвечена)

**Группы агентов:**
- Сворачиваемые секции
- Заголовок группы: стрелка (▼/▶), цветной бейдж с коротким именем, полное название, количество агентов, групповой тумблер
- Групповой тумблер ON/OFF включает/выключает всех агентов в группе разом
- При сворачивании — видна только строка заголовка

**Карточки агентов (внутри развёрнутой группы):**
- Горизонтальная полоска
- Слева: цветная точка (цвет из frontmatter агента)
- Название агента (из поля `name`)
- Тег категории (planning, execution, research и т.п. — извлекается из description)
- Краткое описание (первая строка из поля `description`, обрезанная до 80 символов)
- Справа: тумблер ON/OFF
- Выключенная карточка: вся строка затемнена (opacity 0.5), тумблер серый

### Основная область — секция Skills

Аналогичная структура. Сканирует папки skills. Каждый skill — карточка с именем (из SKILL.md frontmatter), описанием и тумблером.

Группировка: по источнику (глобальные / проектные / плагинные).

### Основная область — секция Commands

Сканирует папки commands. Группировка по namespace (например, все `gsd/*.md` — группа GSD Commands).

Карточка: имя файла как slash-команда (`/gsd:new-project`), тумблер.

### Основная область — секция Settings

- **Paths:** Отображение и ручная настройка путей сканирования
- **Scope toggle:** Переключатель "Global" / "Project" — показать глобальные или проектные агенты
- **Theme:** Пока только тёмная (заготовка для светлой)
- **About:** Версия приложения, ссылки

### Статус-бар (нижняя строка)

- Путь к текущей директории agents
- Зелёная точка + количество активных
- Серая точка + количество выключенных
- Версия приложения справа

---

## Парсинг файлов агентов

Каждый `.md` файл агента имеет YAML frontmatter:

```yaml
---
name: gsd-planner
description: Creates executable phase plans...
tools: Read, Write, Edit, Bash
model: sonnet
color: green
---

You are a GSD planner...
```

Приложение парсит:
- `name` → отображаемое имя на карточке
- `description` → текст описания (первая строка)
- `color` → цвет точки на карточке. Маппинг: red→#ef4444, blue→#3b82f6, green→#22c55e, yellow→#f59e0b, purple→#8b5cf6, orange→#f97316, pink→#ec4899, cyan→#06b6d4. Если цвет не указан — серый (#666688)
- `model` → опционально отображается как маленький бейдж
- `tools` → не отображается в основном виде (возможно в будущем в detail view)

Тело после frontmatter (системный промпт) — не отображается в карточке, но доступно в detail view при клике.

---

## Функциональные требования

### MVP (v0.1.0)

1. **Сканирование директорий** — при запуске и по file watcher
2. **Отображение агентов** — карточки с данными из frontmatter
3. **Тумблер ON/OFF для отдельного агента** — перемещение файла в/из `.disabled/`
4. **Тумблер ON/OFF для группы** — массовое перемещение всех файлов группы
5. **Автоматическая группировка** — по префиксу имени файла
6. **Три секции** — Agents, Skills, Commands с одинаковой механикой
7. **Поиск** — фильтрация по имени и описанию
8. **Фильтры** — All / Enabled / Disabled
9. **Статус-бар** — путь, счётчики
10. **Кроссплатформенная сборка** — macOS (.dmg) и Windows (.msi)

### v0.2.0 (после MVP)

1. **Detail view** — клик по карточке открывает боковую панель с полным описанием, списком tools, системным промптом
2. **Редактирование** — изменение name, color, description прямо из GUI
3. **Import from GitHub** — поле для ввода URL репозитория, автоматическая загрузка и установка
4. **Пользовательская группировка** — drag-and-drop агентов между группами
5. **Переключатель Global/Project** — показ агентов из текущего проекта

### v0.3.0 (будущее)

1. **Marketplace** — каталог популярных наборов агентов с кнопкой установки
2. **Поддержка OpenCode и Gemini CLI** — сканирование их директорий
3. **Бэкап/Восстановление** — экспорт/импорт конфигурации
4. **Уведомления** — оповещение при автообновлении набора (например GSD)
5. **Статистика использования** — какие агенты чаще всего триггерятся (через парсинг логов Claude Code)

---

## Структура проекта

```
claude-agent-manager/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs             # Точка входа Tauri
│   │   ├── commands.rs         # Tauri commands (API для фронтенда)
│   │   ├── scanner.rs          # Сканирование директорий
│   │   ├── parser.rs           # Парсинг YAML frontmatter из .md файлов
│   │   ├── toggler.rs          # Логика перемещения файлов (enable/disable)
│   │   ├── watcher.rs          # File system watcher
│   │   ├── groups.rs           # Логика группировки агентов
│   │   └── config.rs           # Конфигурация приложения
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                        # React frontend
│   ├── App.tsx                 # Корневой компонент
│   ├── main.tsx                # Точка входа React
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx     # Боковая панель с иконками
│   │   │   ├── StatusBar.tsx   # Нижняя строка статуса
│   │   │   └── Header.tsx      # Заголовок секции + поиск + фильтры
│   │   ├── Agents/
│   │   │   ├── AgentList.tsx   # Список групп и карточек
│   │   │   ├── AgentGroup.tsx  # Сворачиваемая группа с общим тумблером
│   │   │   └── AgentCard.tsx   # Карточка отдельного агента
│   │   ├── Skills/
│   │   │   ├── SkillList.tsx
│   │   │   ├── SkillGroup.tsx
│   │   │   └── SkillCard.tsx
│   │   ├── Commands/
│   │   │   ├── CommandList.tsx
│   │   │   ├── CommandGroup.tsx
│   │   │   └── CommandCard.tsx
│   │   ├── Settings/
│   │   │   └── SettingsView.tsx
│   │   └── ui/
│   │       ├── Toggle.tsx      # Компонент тумблера
│   │       ├── SearchBar.tsx   # Поле поиска
│   │       ├── FilterPills.tsx # Фильтры All/Enabled/Disabled
│   │       ├── Badge.tsx       # Цветной бейдж
│   │       └── ColorDot.tsx    # Цветная точка агента
│   ├── hooks/
│   │   ├── useAgents.ts        # Хук для загрузки и управления агентами
│   │   ├── useSkills.ts
│   │   ├── useCommands.ts
│   │   └── useFileWatcher.ts   # Хук для подписки на изменения FS
│   ├── lib/
│   │   ├── tauri-api.ts        # Обёртки над Tauri invoke()
│   │   ├── types.ts            # TypeScript типы
│   │   └── colors.ts           # Маппинг цветов
│   └── styles/
│       └── globals.css         # Tailwind + кастомные стили
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Типы данных

```typescript
// types.ts

interface Agent {
  id: string;                  // уникальный ID (имя файла без .md)
  name: string;                // из frontmatter name
  description: string;         // из frontmatter description
  color: string;               // hex-цвет, маппинг из frontmatter color
  model?: string;              // из frontmatter model
  tools?: string[];            // из frontmatter tools
  filePath: string;            // полный путь к файлу
  enabled: boolean;            // true если файл в основной директории
  scope: 'global' | 'project'; // глобальный или проектный
  groupId?: string;            // ID группы
}

interface AgentGroup {
  id: string;
  name: string;
  color: string;
  agents: Agent[];
  allEnabled: boolean;         // все агенты группы включены
  expanded: boolean;           // группа развёрнута в UI
}

interface Skill {
  id: string;
  name: string;
  description: string;
  dirPath: string;             // путь к папке skill
  enabled: boolean;
  scope: 'global' | 'project';
}

interface Command {
  id: string;
  name: string;                // slash-команда: /gsd:new-project
  namespace: string;           // gsd, custom и т.д.
  filePath: string;
  enabled: boolean;
  scope: 'global' | 'project';
}

type Section = 'agents' | 'skills' | 'commands' | 'settings';
type Filter = 'all' | 'enabled' | 'disabled';
```

---

## Tauri Commands (Rust → Frontend API)

```rust
// Список всех агентов
#[tauri::command]
fn get_agents() -> Result<Vec<Agent>, String>

// Включить/выключить агента
#[tauri::command]
fn toggle_agent(id: String, enabled: bool) -> Result<Agent, String>

// Включить/выключить всю группу
#[tauri::command]
fn toggle_group(group_id: String, enabled: bool) -> Result<Vec<Agent>, String>

// Список всех skills
#[tauri::command]
fn get_skills() -> Result<Vec<Skill>, String>

// Включить/выключить skill
#[tauri::command]
fn toggle_skill(id: String, enabled: bool) -> Result<Skill, String>

// Список всех commands
#[tauri::command]
fn get_commands() -> Result<Vec<Command>, String>

// Включить/выключить command
#[tauri::command]
fn toggle_command(id: String, enabled: bool) -> Result<Command, String>

// Получить конфигурацию
#[tauri::command]
fn get_config() -> Result<Config, String>

// Обновить конфигурацию
#[tauri::command]
fn update_config(config: Config) -> Result<(), String>
```

---

## Обработка ошибок

- Если файл заблокирован (открыт другим процессом) — показать toast-уведомление с ошибкой
- Если директория не существует — показать сообщение "Claude Code agents directory not found. Is Claude Code installed?"
- Если frontmatter невалидный — показать агента с именем из имени файла и пометкой "invalid config"
- Все файловые операции — через try/catch с логированием

---

## Дизайн-референс

SVG-макет концепции приложен к проекту (файл `design/concept.svg`). Основные принципы:
- Тёмная тема, утилитарный стиль
- Минимум анимаций (только toggle transition 150ms)
- Карточки — горизонтальные полоски, не блоки
- Цветные точки для визуальной идентификации агентов
- Сворачиваемые группы с общим тумблером
- Затемнение выключенных элементов через opacity

---

## Инструкция по запуску проекта

### Предварительные требования
- Node.js 18+
- Rust (rustup)
- Tauri CLI: `cargo install tauri-cli`

### Создание проекта
```bash
# Создать Tauri + React + TypeScript проект
npm create tauri-app@latest claude-agent-manager -- --template react-ts

cd claude-agent-manager

# Установить зависимости
npm install

# Дополнительные пакеты для фронтенда
npm install -D tailwindcss @tailwindcss/vite
npm install lucide-react
npm install js-yaml
npm install @types/js-yaml -D
```

### Разработка
```bash
npm run tauri dev
```

### Сборка
```bash
npm run tauri build
```

---

## Критерии готовности MVP

- [ ] Приложение запускается на macOS и Windows
- [ ] Сканирует ~/.claude/agents/ и показывает список агентов
- [ ] Каждый агент отображается с именем, цветом, описанием
- [ ] Тумблер ON/OFF перемещает файл в/из .disabled/
- [ ] Агенты автоматически группируются по префиксу
- [ ] Групповой тумблер включает/выключает всех агентов в группе
- [ ] Секции Skills и Commands работают аналогично Agents
- [ ] Поиск фильтрует по имени и описанию
- [ ] Фильтры All/Enabled/Disabled работают
- [ ] File watcher обновляет UI при внешних изменениях файлов
- [ ] Статус-бар показывает путь и счётчики
