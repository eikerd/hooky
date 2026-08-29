# 🪝 Hooky

A macOS GUI for Claude Code's hook output: which **sound** plays on each event,
and which **footer** prints in your terminal when a turn ends.

Pick an event, pick a sound, hear it instantly, save. Register a project, give
it a title and some links, and see that footer under every reply. Hooky writes
the config and wires it into `~/.claude/settings.json` for you.

## Requirements

- macOS
- Node 18+ or Bun
- `jq` — the hook script parses Claude Code's JSON payload with it
- `terminal-notifier` (optional) — only needed for notification banners:
  `brew install terminal-notifier`

Sound playback uses `afplay`, which ships with macOS.

## Running

```bash
bun install
bun run dev      # http://localhost:3000
```

Open the app, then click **Install** in the status banner at the top. That
writes the runner script and points your enabled hook events at it.

## How it works

Hooky splits *configuration* from *execution*, which is the main thing that
makes it safe to edit:

```
~/.claude/hooky.json           ← your sounds. The source of truth.
~/.claude/hooky-projects.json  ← your project footers.
~/.claude/hooky-notify.sh      ← generated once, then never changes.
~/.claude/settings.json        ← hook events point at the script above.
```

The runner script is **static**. It reads both JSON files at fire time, so
changing a sound or a footer rewrites only JSON — the shell script is never
regenerated and never re-parsed. You can hand-edit either file and the change
takes effect on the next hook, no restart needed.

The two configs drive two different output channels, which is worth
internalizing because it explains most of the behavior:

| | Channel | Timing | Events |
| --- | --- | --- | --- |
| Sound + banner | `afplay`, `terminal-notifier` | backgrounded, fire-and-forget | any of the 22 |
| Footer | stdout, as `{systemMessage, suppressOutput}` | synchronous — it *is* the hook's result | `Stop` only |

Every failure path in the runner exits `0`: a missing config, absent `jq`, or
malformed input produces silence rather than a hook error, because hooks run on
Claude Code's critical path.

### What gets written to settings.json

Only the `hooks` key, and only entries pointing at `hooky-notify.sh`. Hooks you
configured yourself are preserved, as is every other setting (`env`,
`statusLine`, `enabledPlugins`, `permissions`, …). The previous contents are
copied to `~/.claude/settings.json.bak` before each save (a single rolling
backup, overwritten each time), and the write itself is atomic — a temp file
plus a rename, so an interrupted save can't truncate your settings.

Only **needed** events are wired. A disabled event is removed from
`settings.json` entirely rather than left to exit early — otherwise a muted
`PreToolUse` would still spawn bash+jq on every single tool call.

`Stop` is the one event with two independent reasons to be wired: its sound,
and any active project footer. Muting the Stop sound therefore does *not*
unwire it while a footer exists, because that would make the footer vanish with
no visible cause.

## The UI

Each row is one hook event:

| Control | What it does |
| --- | --- |
| Checkbox | Enables the event. Disabled events aren't wired at all. |
| Sound dropdown | Picks the audio file — **selecting one plays it immediately**. |
| ▶ | Replays the current sound. |
| Slider | Playback volume, 0–200%. Previews on release. |
| 🔔 / 🔕 | Toggles the notification banner independently of the sound. |
| ⌄ | Emoji, banner message, detail lines, and a real end-to-end test. |

Rows are grouped by category, each showing how many of its events are active.

Each event carries a frequency badge (`fires constantly` → `rare`). `PreToolUse`
and `PostToolUse` fire on *every* tool call, which is what makes hook audio
unbearable — they ship disabled for that reason.

Of 22 events, 13 are enabled by default: the ones that report something you
can't see on screen (a teammate blocked on you, a background task finishing, a
failure). Bookkeeping events like `TaskCreated` and `WorktreeCreate` ship muted.

**Test this event for real** pipes a sample payload through the installed
script, so a passing test means the hook genuinely works, not just that the
config looks right.

### Custom sounds

Drop any `.aiff`, `.wav`, `.m4a`, `.mp3`, or `.caf` into `~/.claude/sounds/`
(or `~/Library/Sounds/`) and hit **Rescan sounds**.

## Project footers

The **Project Footers** page controls the box Claude Code prints when a turn
ends:

```
───────────────────────────────────────────────
🩺  Health Auto Export

  /Users/you/repos/homedash/health-auto-export-server

  Dev server             http://localhost:5273
  Activity rings         http://chungus.local/activity/

  web/ dev server: npm run dev
───────────────────────────────────────────────
```

Footers are registered **by path** in `hooky-projects.json`. A session in a
subdirectory inherits its project's footer, and when registered paths nest, the
innermost one wins. Sessions in unregistered directories fall back to the
`default` entry, or print nothing if there isn't one.

### Tokens

Status lines, notes, titles, labels and URLs all resolve these when the footer
is drawn:

| Token | Resolves to |
| --- | --- |
| `{project}` | The footer's title, or the directory name |
| `{dir}` | Name of the working directory |
| `{cwd}` | Full working directory of the session |
| `{root}` | The registered project path |
| `{rel}` | Working directory relative to the project root |
| `{model}` | Model that handled the turn |
| `{date}`, `{time}` | `YYYY-MM-DD`, `HH:MM` |

There is **deliberately no git token.** Resolving `{git.branch}` would mean
spawning git on every single turn to report something your prompt already
shows. Every token above resolves from the hook payload or from plain string
work, so drawing a footer costs no subprocesses at all.

### Conditional links

A link can carry a condition and disappear when it doesn't hold — the point
being that a dev-server URL is noise when nothing is listening on that port.

| Condition | True when |
| --- | --- |
| *(empty)* | Always |
| `port:5273` | Something is listening on `127.0.0.1:5273` |
| `file:web/README.md` | The path exists inside the project |
| `env:NAME` | The environment variable is non-empty |

Prefix any of them with `!` to invert. An **unrecognized condition shows the
link** rather than hiding it, so a typo can't silently swallow a row.

Conditions are a fixed vocabulary, not shell. `hooky-projects.json` is read on
Claude Code's critical path on every turn, and a config file that can execute
arbitrary commands is a different and much worse thing to own.

### Preview

**Preview footer** renders by piping a synthetic `Stop` payload through the
*actually installed* runner, so what you see is what Claude Code will print —
including which conditional links survived their probes. It saves your draft
first, because the runner reads config from disk.

### Importing an existing setup

If you were using a hand-rolled `project-footer.sh` with `.claude/footer.json`
files, **Import existing footer.json files** scans for them (four levels deep,
skipping `node_modules` and friends) and converts them. A global
`~/.claude/footer.json` becomes the registry's `default`.

The sound half of a hand-rolled `claude-notify-macos.sh` needs no import:
Hooky's defaults were written from that script's own case statement and
reproduce it, so installing with defaults *is* the migration. Both legacy
scripts are detected during install and offered for removal — leaving
`project-footer.sh` wired would print two boxes per turn.

## Event coverage

Claude Code emits 31 hook events. Hooky covers the 22 worth hearing, grouped
into Conversation, Permissions & Input, Agents & Tasks, Tools, Session, Context
and Worktrees.

Deliberately omitted, because they fire constantly or carry no signal you'd
want announced: `MessageDisplay`, `FileChanged`, `CwdChanged`,
`InstructionsLoaded`, `ConfigChange`, `DirectoryAdded`, `PostToolBatch`,
`UserPromptExpansion`, `ElicitationResult`.

## Message placeholders

Each event exposes only the placeholders its payload actually carries — the
editor shows the valid ones per event, so `{teammate}` isn't offered on `Stop`
where it would render empty.

| Placeholder | Available on |
| --- | --- |
| `{model}`, `{hook}` | every event |
| `{tool}`, `{file}` | the tool and permission events |
| `{agent}` | `SubagentStart`, `SubagentStop` |
| `{error}` | `StopFailure` |
| `{reason}` | `SessionEnd`, `PermissionDenied` |
| `{trigger}` | `PreCompact`, `PostCompact`, `Setup` |
| `{source}` | `SessionStart` |
| `{teammate}`, `{team}` | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
| `{task}` | `TaskCreated`, `TaskCompleted` |
| `{server}`, `{message}` | `Elicitation` |
| `{notifyType}` | `Notification` |
| `{name}`, `{path}` | `WorktreeCreate`, `WorktreeRemove` |

`{file}` renders the basename, not the full path.

The event list and these field names were read from the installed Claude Code
CLI's own hook-event enum and dispatch switch, so they track what it really
sends rather than what the docs imply.

## Testing

```bash
bun run test:e2e
```

Tests run against a sandbox home via `HOOKY_HOME`, pointed at a temp directory
by `playwright.config.ts`. They never touch your real `~/.claude`. The suite is
serial (`workers: 1`) because every test mutates that shared directory.

`HOOKY_HOME` also works outside tests if you want to try Hooky against a
scratch config:

```bash
HOOKY_HOME=/tmp/hooky-sandbox bun run dev
```

## Project layout

```
src/
├── types/soundEvents.ts          # event catalog + defaults (single source of truth)
├── types/projectFooter.ts        # footer schema, token + condition vocabulary
├── server/services/
│   ├── runnerService.ts          # the generated hook script (sounds + footer)
│   ├── soundConfigService.ts     # reads/writes hooky.json
│   ├── projectConfigService.ts   # reads/writes hooky-projects.json, path matching
│   ├── legacyImportService.ts    # finds + converts old .claude/footer.json
│   ├── hookWiringService.ts      # wires settings.json, preserves foreign hooks
│   ├── systemSoundsService.ts    # scans + previews sounds
│   └── configService.ts          # atomic settings.json read/write + backup
├── server/api/routers/           # tRPC surface: sounds, projects, config
├── components/sounds/            # the sound board
├── components/projects/          # the footer editor
└── pages/                        # / (sounds), /projects (footers), /hooks (wiring)
```

## Uninstalling

Click **Uninstall** in the app: it removes Hooky's entries from
`settings.json` and deletes the runner script. Your `hooky.json` and
`hooky-projects.json` are left in place, so reinstalling restores your sounds
and footers.

## License

MIT
