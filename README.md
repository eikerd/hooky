# Claude Hooks Manager

A modern GUI application for managing Claude Code hooks and customizing notification settings. Built with Next.js, tRPC, and TypeScript.

## Features

- **Hook Management**: Configure all 12 Claude Code hook types
- **Notification Customizer**: Edit emoji, messages, and sounds for notifications
- **File-Based Config**: Read/write settings directly to `~/.claude/settings.json`
- **PowerShell Integration**: Auto-generate notification scripts for Windows
- **Type Safety**: Full TypeScript support with Zod validation
- **Testing**: E2E tests with Playwright

## Prerequisites

- Node.js 18+ or Bun
- Windows with PowerShell (for notifications) or macOS/Linux

## Installation

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Open browser to http://localhost:3000
```

## Building

```bash
bun run build
bun run start
```

## Testing

```bash
# Run Playwright tests
bun run test:e2e

# Open test UI
bun run test:e2e:ui
```

## Project Structure

```
src/
├── types/              # TypeScript type definitions
├── server/
│   ├── api/           # tRPC routers
│   └── services/      # Business logic (config, scripts)
├── components/
│   ├── ui/            # Reusable UI components
│   ├── layout/        # Layout components
│   └── notifications/ # Notification editor
├── pages/             # Next.js pages
├── styles/            # Global CSS
└── utils/             # Utility functions
tests/e2e/            # Playwright tests
```

## Configuration

The app reads from and writes to:
- `~/.claude/settings.json` - Claude settings
- `~/.config/claude/hooks/claude-notify.ps1` - PowerShell notification script
- `~/.config/claude/hooks/claude-notify-wsl.sh` - Bash wrapper

## Usage

### Dashboard
- View all 12 hook types
- Enable/disable hooks
- Click "Edit" to configure each hook

### Notifications
- Customize emoji for each event
- Change notification messages
- Select sounds (BurntToast on Windows)
- Test notifications before saving

## Hook Types

1. **SessionStart** - When Claude session begins
2. **UserPromptSubmit** - User submits a prompt
3. **PreToolUse** - Before Claude uses a tool
4. **PermissionRequest** - Permission requested
5. **PostToolUse** - After tool execution
6. **PostToolUseFailure** - Tool execution failed
7. **Notification** - System notification event
8. **SubagentStart** - Subagent started
9. **SubagentStop** - Subagent stopped
10. **Stop** - Session stopped
11. **PreCompact** - Before context compaction
12. **SessionEnd** - Session ended

## API Routes

### Hooks
- `GET /api/trpc/hooks.list` - List all hooks
- `GET /api/trpc/hooks.get` - Get hook details
- `POST /api/trpc/hooks.update` - Update hook
- `POST /api/trpc/hooks.toggle` - Enable/disable hook
- `POST /api/trpc/hooks.delete` - Delete hook

### Notifications
- `GET /api/trpc/notifications.list` - List notifications
- `POST /api/trpc/notifications.update` - Update notifications
- `POST /api/trpc/notifications.regenerateScript` - Regenerate script
- `POST /api/trpc/notifications.test` - Test notification

### Config
- `GET /api/trpc/config.read` - Read settings
- `POST /api/trpc/config.write` - Write settings
- `POST /api/trpc/config.backup` - Backup settings
- `GET /api/trpc/config.export` - Export config
- `POST /api/trpc/config.import` - Import config

## Development

### Adding a new hook type
1. Update `HOOK_EVENTS` in `src/types/hooks.ts`
2. Update `HOOK_EVENTS_ORDERED` in `src/utils/constants.ts`
3. Tests will automatically run for the new type

### Adding a new UI component
1. Create component in appropriate `src/components/` directory
2. Add tests in `tests/e2e/`
3. Use shadcn/ui styling for consistency

## License

MIT
