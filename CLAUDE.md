# Working on Hooky

Hooky configures Claude Code's hook output: **sounds/banners** per event, and
the **project footer** printed when a turn ends. `README.md` documents what it
does for users; this file covers what will bite you while changing it.

Read `README.md` first for the feature model — it is accurate and current.

**Working on Windows, WSL or Cowork support? Read `docs/PORTING.md` first.** It
carries the platform inventory, the WSL audio/banner plan, and the finding that
Cowork fires no hooks at all and needs a different event source entirely. Every
invariant below still applies there.

## The one thing to understand first

Everything Hooky writes runs **on Claude Code's critical path**, in the user's
real `~/.claude`. A bug here doesn't fail a test suite, it breaks the user's
editor on every turn, invisibly. Two rules follow, and neither is negotiable:

1. **The runner exits 0 on every failure path.** Missing config, absent `jq`,
   malformed JSON, unreadable directory — all mean "do nothing", never "fail
   the hook". If you add a code path that can exit non-zero, you have added a
   way to break every turn the user takes.
2. **Config and execution stay split.** `hooky-notify.sh` is *static*. It is
   generated once and reads JSON at fire time. Never generate shell per user
   edit, never parse values back out of generated shell. The JSON is
   authoritative in both directions.

## Layout

| File | Owns |
| --- | --- |
| `src/types/soundEvents.ts` | Event catalog, per-event payload fields, sound defaults |
| `src/types/projectFooter.ts` | Footer schema, token + condition vocabulary |
| `src/server/services/runnerService.ts` | The generated bash runner |
| `src/server/services/soundConfigService.ts` | `~/.claude/hooky.json` |
| `src/server/services/projectConfigService.ts` | `~/.claude/hooky-projects.json`, path matching |
| `src/server/services/hookWiringService.ts` | `settings.json` hook entries |
| `src/server/services/configService.ts` | Atomic settings read/write + backup |
| `src/server/services/legacyImportService.ts` | Converting pre-Hooky `.claude/footer.json` |
| `src/server/services/eventLogService.ts` | Tailing the trace log, fanning out to SSE clients |
| `src/server/services/learnModeService.ts` | Wire-everything-silently mode + exact restore |

`soundEvents.ts` is the **single source of truth** for the event list.
`validation.ts` derives its zod enum from `HOOK_EVENTS_ORDERED` rather than
re-listing events, because that list previously existed in four places and had
already drifted between them. Keep it derived.

## Editing the runner script

`RUNNER_SCRIPT` is a bash program inside a JS template literal, targeting the
bash macOS ships. Three separate hazards stack here.

### Template literal escaping

| Bash you want | Write |
| --- | --- |
| `${VAR}` | `\${VAR}` |
| `\` (line continuation, `\n` in jq) | `\\` |
| `` ` `` | `` \` `` |
| `\{token\}` in a substitution pattern | `\\{token\\}` |

`$HOME` and `$'\n'` need no escaping — only `${` starts an interpolation. A
missed escape usually still *parses*, and fails at runtime.

### bash 3.2, not 5.x

`/bin/bash` on macOS is 3.2.57, and `sounds.testEvent` spawns `/bin/bash`
explicitly. So:

- No associative arrays (`declare -A`), no `mapfile`/`readarray`.
- `${arr[@]}` on an **empty** array is an error under `set -u`. Guard every
  array expansion with a counter (`META_N`, `LINK_N`, `NOTE_N` do this).
- Don't quote the right side of `=~`; 3.2 treats a quoted regex as a literal.

### jq evaluates arguments against the filter's input

This one already caused a silent total failure of the footer feature:

```jq
# WRONG: .key resolves against $cwd, a string -> query aborts, footer vanishes
map(select(.key == $cwd or ($cwd | startswith(.key + "/"))))

# RIGHT: bind the entry first
map(select(. as $p | ($p.key == $cwd) or ($cwd | startswith($p.key + "/"))))
```

It is nasty because the "stay silent" tests still pass — a broken query and a
correctly-empty result are indistinguishable from outside. When a footer stops
rendering for no clear reason, run the jq by hand before suspecting bash.

### jq `//` falls through on `false`

`.enabled // true` yields `true` for an explicitly disabled entry, so an opt-out
would never take effect. Compare booleans explicitly:
`if .enabled == false then ... else ... end`. This pattern appears in the runner
and in the legacy importer; preserve it.

## Verifying runner changes

The runner is not exercised by unit tests directly. To iterate on it, write the
generated script out and run it against a sandbox:

```ts
// gen.ts — put it in the project root so @/ path aliases resolve, then delete
import { RUNNER_SCRIPT } from "@/server/services/runnerService";
import fs from "fs";
fs.writeFileSync("/tmp/runner.sh", RUNNER_SCRIPT);
```

```bash
bun run gen.ts
/bin/bash -n /tmp/runner.sh          # syntax-check under the real 3.2
printf '{"hook_event_name":"Stop","cwd":"/some/project","model":"m"}' \
  | HOOKY_PROJECTS=/tmp/projects.json HOOKY_CONFIG=/tmp/nope.json /bin/bash /tmp/runner.sh
```

`HOOKY_CONFIG` / `HOOKY_PROJECTS` override both config paths — pointing
`HOOKY_CONFIG` at a nonexistent file is how the preview endpoint runs the
runner silently. Always confirm `echo $?` is 0, including for garbage input.

## The live monitor

The runner appends one US-separated line per hook to `~/.claude/hooky-events.log`
(`$HOOKY_EVENTS` overrides it). `eventLogService` tails that file and pushes
records to the browser over SSE at `/api/events/stream`; rows light up in the
sound board.

Three rules keep this off the critical path, and they are the whole design:

1. **The producer is a bash redirect, never a network call.** `printf >> file`
   forks nothing. A `curl` to localhost would add a subprocess *and* a socket to
   every hook, plus a new way to hang a turn when nothing is listening.
2. **The runner does not timestamp.** bash 3.2 has no `EPOCHREALTIME`, so a
   timestamp means forking `date` — more expensive than everything else in the
   block. `eventLogService` stamps arrival instead.
3. **The server truncates, the runner only appends.** Rotation logic in the
   runner would mean `stat`/`tail` subprocesses per hook.

Two traps already caught:

- **Anything that spawns the runner for a non-hook reason must set
  `HOOKY_EVENTS=/dev/null`.** `projects.preview` does; without it the monitor
  lights up for a `Stop` that never happened. A monitor that lies is worse than
  none.
- **`networkidle` no longer works as a Playwright wait condition anywhere in
  this app.** The SSE connection never goes idle. Use `domcontentloaded` plus a
  `waitForSelector`.

An event absent from `settings.json` never invokes the runner, so it can never
appear in the monitor. `LiveMonitor` shows an "N events unwired" badge for
exactly this reason — without it, a muted `PreToolUse` reads as "this never
fires". **Learn mode** (`learnModeService`) is the answer: it wires all 22 with
`soundPath: ""` and `banner: false`, so the trace is the only output. It costs
~13ms per hook — bash startup plus two jq passes, not the audio — so ~26ms per
tool call, which is why it's a temporary mode rather than a default.

Learn mode snapshots `hooky.json` to `hooky-learn-backup.json` *before* touching
anything, and the file's existence is the on-flag. Restoration copies the
snapshot back wholesale rather than reconstructing it, so every sound, volume,
emoji and message returns to precisely what it was; the e2e test asserts the
config is byte-identical across a round trip. Don't replace this with a flag
inside `hooky.json` — a crash mid-toggle would then leave a half-flagged config
that the runner still reads.

## Output channels

Two channels with different rules. Confusing them is how you break things.

| | Banner | Footer |
| --- | --- | --- |
| Sink | `terminal-notifier`, backgrounded | **stdout**, as `{systemMessage, suppressOutput}` |
| Timing | fire-and-forget | synchronous — it *is* the hook's result |
| Events | any of the 22 | `Stop` only |

Anything written to stdout on a non-`Stop` event is a protocol violation. The
`[[ "$HOOK" == "Stop" ]] || exit 0` guard before the footer section is load-
bearing; keep all stdout after it.

## Invariants that tests protect

Before "simplifying" any of these, read the test that covers it:

- **Disabled events are unwired, not early-exiting.** A muted `PreToolUse` left
  wired still spawns bash+jq on every tool call. `hookWiringService.sync` removes
  it from `settings.json` entirely.
- **`Stop` has two independent reasons to be wired**: its sound, *and* any active
  project footer. Muting the Stop sound must not unwire it while a footer exists
  — see `wireDecision`. Collapsing this back to a single condition makes footers
  silently disappear.
- **`settings.json` is the user's live config and holds far more than we model.**
  Every schema in `validation.ts` is `looseObject`, never `object` — `z.object()`
  *strips* unknown keys, so validating before a write would silently delete
  `env`, `statusLine`, `permissions.defaultMode`, `enabledPlugins`… Writes are
  atomic (temp + rename) with a rolling `.bak`.
- **Foreign hooks are preserved.** Wiring filters out only our own runner
  entries before re-adding them. Never rewrite the whole `hooks` key.

## Deliberate non-features

Don't "add" these; they were removed or rejected on purpose.

- **No git tokens in footers.** `{git.branch}` would spawn git on every turn to
  report what the prompt already shows. Dropping it is what makes footer
  rendering subprocess-free. The user asked for this explicitly.
- **No shell in `hooky-projects.json`.** Link conditions are a fixed vocabulary
  (`port:`, `file:`, `env:`) the runner evaluates itself. A config file read on
  the critical path must not be executable code.
- **Unknown link conditions fail *open*.** A typo shows the link rather than
  hiding it — silent disappearance is the worse failure.
- **No parser for `claude-notify-macos.sh`.** `DEFAULT_SOUND_CONFIG` was written
  from that script's case statement and reproduces it, so installing with
  defaults *is* the sound migration.

## UI conventions

- Edit against a **local draft**, seeded once from the server; save explicitly.
  A mutation per keystroke would rewrite the user's config while they type.
- To refresh after saving, take the value from the refetch result — do **not**
  `setDraft(null)` and rely on the seeding effect. React re-renders on the null
  first, the effect reads the stale react-query cache, and every row sticks
  dirty. `SoundBoard.reseedFromServer` documents this.
- Rows carry `data-event` / `data-project` attributes for stable test
  selectors. Prefer them over text matching, which hits strict-mode violations
  when a path appears in both a row and a scan result.

## Testing

```bash
bun run test:e2e        # Playwright, serial (workers: 1)
```

Tests run against a sandbox home via `HOOKY_HOME`, set by
`playwright.config.ts`. They never touch the real `~/.claude`, and
`reuseExistingServer: false` ensures a hand-started dev server can't be used
by accident — it wouldn't have `HOOKY_HOME` set and the suite would write to
the live config. The suite is serial because every test mutates that one shared
directory.

`HOOKY_HOME` also works outside tests:

```bash
HOOKY_HOME=/tmp/hooky-sandbox bun run dev
```

## Adding a hook event

1. Add it to `HookEventType`, `EVENT_META` (with `fields` — only placeholders
   the payload really carries), `HOOK_EVENTS_ORDERED`, and
   `DEFAULT_SOUND_CONFIG` in `soundEvents.ts`.
2. If it carries a payload field the runner doesn't extract yet, add it to the
   **first** jq pass field list and the matching `IFS= read` in the runner —
   the two must stay positionally aligned.
3. Default it to enabled only if the sound answers something you can't see on
   screen. Anything firing per-tool-call ships muted.

Validation, wiring and the UI all derive from the catalog; no other file needs
touching.
