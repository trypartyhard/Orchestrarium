# Claude Agent Manager (CAM)

## What This Is

Десктопное приложение для визуального управления агентами, skills и commands в Claude Code. Позволяет включать/выключать отдельные агенты и целые наборы через тумблеры в GUI, без ручного редактирования файлов. Построено на Tauri 2 (Rust + React).

## Core Value

Разработчик может мгновенно включить или выключить любого агента/skill/command Claude Code одним кликом, без работы с файловой системой.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Сканирование директорий `~/.claude/agents/`, `skills/`, `commands/` при запуске и по file watcher
- [ ] Отображение агентов как карточек с данными из YAML frontmatter (name, description, color, model)
- [ ] Тумблер ON/OFF для отдельного агента — перемещение файла в/из `.disabled/`
- [ ] Тумблер ON/OFF для группы — массовое перемещение всех файлов группы
- [ ] Автоматическая группировка агентов по префиксу имени файла
- [ ] Три секции: Agents, Skills, Commands с одинаковой механикой
- [ ] Поиск — фильтрация по имени и описанию
- [ ] Фильтры — All / Enabled / Disabled
- [ ] Статус-бар — путь, счётчики активных/выключенных
- [ ] Тёмная тема в стиле developer tools
- [ ] Сборка под Windows (.msi/.exe)

### Out of Scope

- Detail view с полным промптом — v0.2
- Редактирование агентов из GUI — v0.2
- Import from GitHub — v0.2
- Drag-and-drop группировка — v0.2
- Marketplace агентов — v0.3
- Поддержка OpenCode/Gemini CLI — v0.3
- Бэкап/восстановление — v0.3
- Статистика использования — v0.3
- macOS сборка — после отладки Windows

## Context

- Управление агентами Claude Code сейчас только через файловую систему: перемещение/переименование .md файлов
- Существующие GUI (opcode, CodePilot) управляют сессиями, но не дают тумблеры для агентов
- Механизм выключения: перемещение файла в `.disabled/` подпапку (Claude Code игнорирует скрытые директории)
- Группировка определяется по префиксу файла: `gsd-*.md` → группа "GSD", без префикса → "Custom"
- Файл `.agent-groups.json` хранит пользовательскую группировку

## Constraints

- **Tech stack**: Tauri 2 (Rust backend + React/TypeScript/Tailwind CSS frontend) — лёгкий бинарник 5-10 MB
- **Platform**: Windows first (macOS позже)
- **Лицензия**: MIT
- **Дизайн**: Тёмная тема, утилитарный стиль, минимум анимаций (toggle 150ms)
- **Шрифты**: Inter (UI) + JetBrains Mono (моноширинный)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 вместо Electron | 5-10 MB vs 200+ MB, меньше RAM, нативный Rust для файловых операций | — Pending |
| `.disabled/` подпапка для выключения | Claude Code игнорирует скрытые директории, не нужны хаки | — Pending |
| Автогруппировка по префиксу | Простое решение без конфигурации, покрывает GSD и другие наборы | — Pending |
| Windows first | Текущая рабочая среда, macOS добавим позже | — Pending |

---
*Last updated: 2026-03-03 after initialization*
