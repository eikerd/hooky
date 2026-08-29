# Porting Hooky beyond macOS

Handoff document. Written on macOS at commit `24d4dec`, for whoever picks this
up on Windows.

Read `README.md` (what Hooky does) and `CLAUDE.md` (what will bite you) first —
both are current and accurate. This file covers only what changes when you
leave macOS.

---

## 0. Where things stand

**Done and green on macOS.** `bunx tsc --noEmit` is clean; `bun run test:e2e`
is 22/22 passing against a `HOOKY_HOME` sandbox.

What was built:

- A **static bash runner** (`hooky-notify.sh`) generated once, reading
  `hooky.json` + `hooky-projects.json` at fire time. Editing a sound rewrites
  JSON only — shell is never regenerated and never re-parsed.
- **22 hook events** catalogued in `src/types/soundEvents.ts`, the single source
  of truth. Sounds, volume, banner, emoji, message template, detail lines.
- **Project footers** — the box printed under each `Stop`, matched by path,
  with a fixed condition vocabulary (`port:` / `file:` / `env:`) instead of
  shell, and no git tokens so rendering forks nothing.
- **A live monitor** — the runner appends US-separated lines to
  `hooky-events.log`; `eventLogService` tails it and pushes over SSE; sound
  board rows light up as hooks fire.
- **Learn mode** — wires all 22 events silently so the trace shows everything,
  with byte-identical restore.
- **Safe settings.json handling** — `looseObject` schemas everywhere, atomic
  writes, rolling `.bak`, foreign hooks preserved, disabled events unwired
  rather than left to early-exit.

### Invariants that must survive the port

These are not stylistic. Each has a test or a scar behind it. `CLAUDE.md`
explains why; this is the short list to check your Windows work against.

1. **Every failure path exits 0.** Hooks run on Claude Code's critical path in
   the user's real config. Missing config, absent `jq`, no audio device — all
   mean "do nothing", never "fail the hook".
2. **Config and execution stay split.** Never generate shell per user edit,
   never parse values back out of generated shell. JSON is authoritative in
   both directions. This is what makes a second platform runner *possible* —
   the two runners share one config contract and nothing else.
3. **Only `Stop` writes to stdout.** Anything on stdout for another event is a
   protocol violation.
4. **The event trace producer is a file append, never a network call.**
5. **`settings.json` holds far more than we model.** Never `z.object()`, never
   rewrite the whole `hooks` key.

---

## 1. The three targets

| | Runtime | Claude surface | Hooks fire? | Status |
| --- | --- | --- | --- | --- |
| **A** | macOS | Claude Code CLI | yes | done |
| **B** | Ubuntu on WSL 2 / Windows 11 | Claude Code CLI | yes | to build |
| **C** | Windows 11 native | **Cowork desktop app only** | **no** | to build, different design |

**B and C are not the same project.** B is a straightforward port: same
architecture, different binaries. C has no hook mechanism at all and needs a
different event source and a different delivery path. Do B first — it is
mostly mechanical and it proves the platform abstraction you will need for C.

---

## 2. Exact porting inventory

The macOS coupling is small and concentrated. Five places:

| File | What is macOS-specific |
| --- | --- |
| `src/types/soundEvents.ts` | `SYS = "/System/Library/Sounds"`; 24 default `soundPath` values ending `.aiff` |
| `src/utils/constants.ts` | `SOUND_DIRS` (4 macOS dirs), `SOUND_EXTENSIONS` |
| `src/server/services/systemSoundsService.ts` | `platform() !== "darwin"` guards, `afinfo` (duration), `afplay` (preview) |
| `src/server/services/runnerService.ts` | `afplay -v`, `terminal-notifier`, `nc` port probe, bash 3.2 target |
| `src/components/sounds/SoundSelect.tsx`, `SoundLibrary.tsx` | source labels read "macOS" |

Plus `package.json` `description` and `README.md`, which both still say "macOS".

### The shape the abstraction should take

Do **not** scatter `platform()` checks. Introduce one module —
`src/server/services/platform.ts` — that resolves a `PlatformProfile`:

```ts
interface PlatformProfile {
  id: "darwin" | "wsl" | "win32" | "linux";
  soundDirs: string[];
  soundExtensions: string[];
  defaultSounds: Record<HookEventType, string>;  // per-platform default map
  runner: { script: string; filename: string; interpreter: string[] };
  preview(path: string, volume: number): Promise<void>;
  duration(path: string): Promise<number>;
}
```

`DEFAULT_SOUND_CONFIG` in `soundEvents.ts` currently hardcodes paths. Split it:
keep the *semantic* defaults (which events are enabled, emoji, message, volume,
`includeDetails`) in `soundEvents.ts` where they belong, and move the
`soundPath` values into per-platform maps keyed by the same event names. The
event catalog stays one file; only the file paths become platform data.

Detecting WSL: `os.release()` contains `microsoft` or `WSL` (case-insensitive),
or `/proc/sys/kernel/osrelease` does. `process.platform` is `linux` in WSL, so
platform alone is not enough.

---

## 3. Target B — Ubuntu on WSL 2

Everything about the architecture survives. Only the three externals change.

### bash

WSL Ubuntu ships bash 5.x. **Do not modernize the runner.** The bash 3.2
constraints in `CLAUDE.md` (no `declare -A`, no `mapfile`, guarded array
expansion, unquoted `=~` right side) exist because macOS is still a target and
`sounds.testEvent` spawns `/bin/bash` explicitly. A runner that works on both is
strictly better than two runners that differ only in bash dialect.

If you write a genuinely separate runner for WSL, you have taken on a sync
burden — see §4 for when that's worth it. For WSL it is not: keep one bash
runner and branch inside it on the *commands available*, not on the OS.

### jq

`sudo apt install jq`. The install flow should detect its absence and say so —
right now the runner silently exits 0 without it, which is correct at fire time
but unhelpful during setup. Add a prerequisites check to the status banner.

### Sound — use WSLg's PulseAudio, not PowerShell

WSL 2 with WSLg exposes a PulseAudio socket at `/mnt/wslg/PulseServer`. That
makes `paplay` a plain Linux exec, comparable in cost to `afplay`:

```bash
paplay --volume=32768 /home/you/.claude/sounds/notify.wav
```

Do **not** reach for `powershell.exe -c '(New-Object Media.SoundPlayer …)'` for
audio. It forks an entire Windows process per hook (several hundred ms cold)
and puts the Win32 boundary on the critical path. Reserve interop for banners
(below), where a single fire-and-forget fork per *notification* is acceptable.

Three traps, in order of how likely they are to cost you an afternoon:

1. **`PULSE_SERVER` may not be set in the hook's environment.** Hooks inherit
   Claude Code's env, which is not necessarily a login shell. If it's unset,
   `paplay` fails silently and you get an exit-0 no-op that looks exactly like
   a muted event. Set it defensively in the runner:

   ```bash
   [[ -z "${PULSE_SERVER:-}" && -S /mnt/wslg/PulseServer ]] \
     && export PULSE_SERVER=unix:/mnt/wslg/PulseServer
   ```

2. **Volume mapping is not the same axis.** `afplay -v` takes 0–2 as a gain
   multiplier; `paplay --volume` takes 0–65536 where 65536 is 100%. The UI
   slider is documented as 0–200%. Verify on the box whether libpulse accepts
   values above 65536 — if it does not, either clamp the slider on WSL or
   pre-amplify with `sox`. **This is a product decision, not just a mapping**:
   silently clamping 200% to 100% would be the kind of invisible degradation
   this codebase otherwise avoids. Surface it in the UI.

3. **Reading sounds from `/mnt/c/...` on every hook is slow.** DrvFs crosses
   the VM boundary per read. See below.

Fall back to `aplay` (ALSA) if `paplay` is missing, then to nothing. Never to
an error.

### Sound files — copy them in at install time

Windows ships a usable library at `C:\Windows\Media\` (`chimes.wav`,
`notify.wav`, `ding.wav`, `tada.wav`, `Alarm01–10.wav`, `Ring01–10.wav`,
`Windows Notify.wav`, `Windows Background.wav`, and more). From WSL that is
`/mnt/c/Windows/Media/`.

**Do not point `soundPath` at `/mnt/c/...`.** Instead, have install copy the
selected files into `~/.claude/sounds/` on the ext4 side and write *those*
paths into `hooky.json`. Rationale is the same one that governs the rest of the
runner: the hot path should not do work it can do once. It also means the
config keeps working if the drive mapping changes.

`SOUND_DIRS` for WSL then becomes:

```
~/.claude/sounds          # populated at install, primary
/usr/share/sounds         # freedesktop themes, if present
/mnt/c/Windows/Media      # scan-only source for the library page
```

Mark the `/mnt/c` entry as a *catalog* source that copies on selection, rather
than a path the runner reads directly. That distinction does not exist in the
current `SystemSound` model — you will need a `copyOnUse: boolean` or an
explicit `origin` vs `resolvedPath` split.

`SOUND_EXTENSIONS` needs `.wav` first (it is already in the list) and can drop
`.aiff`/`.caf` from the WSL profile.

**Mapping the defaults.** The macOS defaults were transcribed from the user's
old `claude-notify-macos.sh`, so installing with defaults *is* the migration
(see `CLAUDE.md`, "Deliberate non-features"). There is no equivalent history on
Windows, so you are choosing fresh. Suggested starting map — keep the *shape*
(distinct sound per category, sharper sounds for things needing attention):

| Event | macOS | Windows candidate |
| --- | --- | --- |
| `Stop` | `Hero.aiff` | `Windows Notify System Generic.wav` |
| `StopFailure` | `Sosumi.aiff` | `Windows Critical Stop.wav` |
| `Notification` | `Ping.aiff` | `notify.wav` |
| `PermissionRequest` | `Tink.aiff` | `Windows Balloon.wav` |
| `PermissionDenied` | `Basso.aiff` | `Windows Error.wav` |
| `SessionStart` | `Glass.aiff` | `Windows Logon.wav` |
| `SessionEnd` | `Submarine.aiff` | `Windows Logoff.wav` |
| `SubagentStop` | `Purr.aiff` | `chimes.wav` |
| `TaskCompleted` | `Glass.aiff` | `tada.wav` |

Treat that as a draft to audition, not a spec. Confirm the filenames exist on
the actual Windows 11 build before wiring them — the Media folder has varied
across releases.

### Banners

`terminal-notifier` has no Linux equivalent that reaches the Windows
notification centre. Two options, in order of preference:

1. **`wsl-notify-send.exe`** — a small Go binary
   ([stuartleeks/wsl-notify-send](https://github.com/stuartleeks/wsl-notify-send))
   that raises a real Windows toast from WSL. Cheap, purpose-built, and it is
   what a WSL user is most likely to already have.
2. **`powershell.exe` + BurntToast** — richer, but a full PowerShell start per
   banner. Acceptable only because banners are backgrounded and fire-and-forget;
   still measure it before defaulting to it.

Either way, keep the existing structure: banner is a separate channel from
sound, toggled independently, and its failure is silent.

Note that a Linux-native `notify-send` will *not* work — WSLg's notification
surface does not bridge to the Windows notification centre for arbitrary
libnotify calls. Detect the tool by `command -v`, in preference order, and skip
the banner if none is present.

### Port conditions

`port:5273` currently probes `127.0.0.1` with `nc` from inside the runner. In
WSL 2 that probes the *WSL* network namespace. A dev server the user started in
Windows will not be seen, and vice versa depending on which side it runs on.
Recent WSL builds forward `localhost` from WSL to Windows, but the reverse and
the timing are both inconsistent.

Decide and document one of:

- Probe only the WSL side (current behavior) and say so in the UI.
- Probe both, treating either hit as success (`nc` to `127.0.0.1` and to the
  Windows host IP from `/etc/resolv.conf` or `$(hostname).local`).

Remember the existing rule: **unknown conditions fail open.** A port probe that
cannot run should show the link, not hide it.

### Footer

No change. It is stdout, and stdout is stdout. The `TerminalPreview` component
should probably grow a PowerShell/Windows Terminal skin alongside its existing
shells, but that's cosmetic.

---

## 4. Target B′ — Windows native, Claude Code CLI outside WSL

Only relevant if someone runs the Claude Code CLI in PowerShell rather than in
WSL. Not required for either of the two users this port is for, so treat it as
optional and do it last.

Hooks would run through `cmd.exe`, and the bash runner would not execute. The
choice is:

- **Require Git Bash** and keep one runner. Cheap, but adds a prerequisite and
  Git Bash's `bash` is 4.x/5.x with its own path-translation quirks.
- **Write a PowerShell runner** as a sibling of `RUNNER_SCRIPT`. PowerShell 5.1
  is guaranteed present; `ConvertFrom-Json` removes the `jq` dependency
  entirely; `[System.Media.SoundPlayer]` plays wav natively.

If you write the second runner, the thing to protect is the **config contract**,
not the code. Both runners must read the same `hooky.json`/`hooky-projects.json`
and produce the same `{systemMessage, suppressOutput}` shape. Build a fixture
suite — a set of payload JSON files plus expected stdout — and run *both*
runners against it. Without that, they drift, and the drift is invisible
(remember the jq argument-scoping bug in `CLAUDE.md`: a broken query and a
correctly-empty result look identical from outside).

Note `.enabled == false` must stay an explicit comparison in PowerShell too —
`$e.enabled ?? $true` has the same falsy-fallthrough bug as jq's `//`.

---

## 5. Target C — Cowork, for the non-coder colleague

This is the interesting one, and it does not work the way A and B do.

### Finding 1: Cowork does not fire hooks. At all.

Confirmed, not speculative. Cowork ignores `~/.claude/settings.json` hooks —
`UserPromptSubmit`, `Stop`, everything. There is no `/hooks` command; Cowork
treats a leading slash as a skill invocation.

The cause is structural: Cowork's agent runs the Claude Code SDK inside a Linux
microVM (visible in `~/Library/Logs/Claude/coworkd.log`: `installed SDK binary
v2.1.237 to /usr/local/bin/claude`, host share mounted at
`/mnt/.virtiofs-root/shared`), while hook config and scripts live on the host.

Tracking issue: [anthropics/claude-code#63360](https://github.com/anthropics/claude-code/issues/63360)
— **closed as not planned**. Related: [#48909](https://github.com/anthropics/claude-code/issues/48909)
(custom stdio MCP servers in Cowork — also unsupported), [#27398](https://github.com/anthropics/claude-code/issues/27398),
[#40495](https://github.com/anthropics/claude-code/issues/40495).

So: no hooks, and no local MCP server to hang a notifier off either. Cowork's
custom connectors reach MCP servers over the public internet from Anthropic's
cloud, which is useless for playing a sound on the user's own speakers.

**Re-verify this on the Windows box before building around it.** It is a moving
target and the version there will be newer than the one surveyed here.

### Finding 2: there is a real event stream on disk

The desktop app writes a per-session, append-only, timestamped JSONL audit log.
On macOS:

```
~/Library/Application Support/Claude/local-agent-mode-sessions/
  <accountId>/<orgId>/local_<sessionUuid>/audit.jsonl
```

On Windows the app data root is `%APPDATA%\Claude`, so expect:

```
C:\Users\<you>\AppData\Roaming\Claude\local-agent-mode-sessions\
  <accountId>\<orgId>\local_<sessionUuid>\audit.jsonl
```

— reachable from WSL at `/mnt/c/Users/<you>/AppData/Roaming/Claude/...`.
**Verify this path first thing**; everything below depends on it.

There is a sibling `claude-code-sessions/` tree for Claude Code sessions started
from the desktop app. Same treatment.

The records are essentially the Claude Code stream-json transcript. Verified
record types, from real logs on this machine:

| `type` | `subtype` / `state` | Carries | Maps to Hooky event |
| --- | --- | --- | --- |
| `system` | `init` | `cwd`, `model`, `session_id`, `claude_code_version`, `tools`, `permissionMode` | `SessionStart` |
| `system` | **`permission_request`** | tool being requested | **`PermissionRequest`** |
| `system` | `permission_response` | granted/denied | `PermissionDenied` (when denied) |
| `assistant` | — | `message.content[]` with `{type: "tool_use", name}` | `PreToolUse` (`tool_name` = `.name`) |
| `user` | — | tool_result blocks, or a plain string prompt | `PostToolUse` / `UserPromptSubmit` |
| `result` | `success` | `stop_reason`, `duration_ms`, `num_turns`, `is_error`, `total_cost_usd`, `terminal_reason` | `Stop`, or `StopFailure` when `is_error` |
| `command_lifecycle` | `queued`, `started`, … | `command_uuid` | session activity |
| `rate_limit_event` | — | — | candidate for a new event |

Every record has `_audit_timestamp` (ISO 8601), so unlike the bash runner there
is no reason to avoid timestamps here — the reader gets them free.

`system/permission_request` is the single most valuable record in the file: it
is exactly the "a human needs to look at this" moment the whole product exists
to announce, and it is the one Cowork gives no other way to observe.

### Design: a second producer into the existing consumer

This fits Hooky's architecture better than it has any right to. `eventLogService`
already tails an append-only line-oriented file and fans records out over SSE to
the sound board. A Cowork adapter is a **second producer feeding the same
consumer**:

```
runner (bash, hook)        ──► hooky-events.log ──┐
                                                  ├──► eventLogService ──► SSE ──► UI
coworkAuditService (tail   ──► synthesized  ──────┘                     └──► sound
  audit.jsonl, translate)       HookEvent
```

Sketch:

- `src/server/services/coworkAuditService.ts` — discovers session directories
  (glob the account/org UUIDs rather than hardcoding them), tails the newest
  `audit.jsonl` per active session, translates records to the `HookEvent` shape
  `eventLogService` already emits.
- Feed translated events into `eventLogService`'s existing fan-out rather than
  building a parallel path. If its current API is file-shaped, refactor it to
  take a record stream and give the file tailer its own thin adapter — that
  refactor is worth doing before the Cowork work, not during it.

### The architectural difference you must not gloss over

On macOS and WSL, **the hook process plays the sound**. Hooky's web app can be
closed; the runner is wired into `settings.json` and works regardless.

On Cowork there is no hook process. **Hooky itself has to be running to play
anything.** That turns Hooky from a configurator into a resident daemon, and it
is the biggest open product question in this port:

- The colleague is a non-coder. "Run `bun run dev` and leave a terminal open" is
  not a shippable answer.
- Realistic options: package as a tray app (Tauri or Electron shell around the
  existing Next app), or ship a small Windows service plus the web UI on demand,
  or a Startup-folder shortcut to a headless watcher with the UI optional.
- Whatever you choose, the UI half should stay exactly what it is now. The
  daemon needs the sound board's *config*, not its React.

Do not start building the tray app until the audit-log tailing is proven — it is
the piece most likely to invalidate the plan.

### Rules for touching `audit.jsonl`

1. **Read only. Never write, never truncate, never rotate.** Each record carries
   an `_audit_hmac`; it is a signed audit trail and it is not ours. This
   directly inverts the rule for `hooky-events.log`, where the server truncates
   and the runner only appends — do not carry that habit across.
2. **Undocumented internal format.** Version-gate the parser, degrade to silence
   on anything unrecognized, and treat "the file moved or changed shape" as a
   normal condition. The same exit-0 philosophy applies: a Cowork adapter that
   throws is worse than one that goes quiet.
3. **Two session flavours.** Local-agent-mode sessions have host paths in
   `.claude/projects/`; VM-backed ones show `/sessions/<generated-name>`. The
   `cwd` you surface in the UI should say which, or footers and project matching
   will look broken for VM sessions.
4. **No footers for Cowork.** The footer channel is the hook's stdout, and there
   is no hook. Sounds, banners and the live monitor port; the footer does not.
   The UI should say so rather than showing a dead control.

---

## 6. Suggested order of work

1. `bunx tsc --noEmit` and `bun run test:e2e` on the Windows box, in WSL. Get to
   green before changing anything. Playwright needs browsers installed
   (`bunx playwright install chromium`) and the suite writes only to
   `HOOKY_HOME`, so it is safe to run.
2. **Verify the Cowork paths** in §5 exist on Windows, and re-check whether
   Cowork still ignores hooks. Both are cheap and both can invalidate the plan.
3. Extract `platform.ts` and split `DEFAULT_SOUND_CONFIG` into semantic defaults
   plus per-platform sound maps. Keep macOS behavior byte-identical — the e2e
   suite is the check.
4. WSL sound path: `paplay` + defensive `PULSE_SERVER`, install-time copy of
   chosen wavs into `~/.claude/sounds/`, volume-axis decision surfaced in the UI.
5. WSL banners: detect `wsl-notify-send.exe`, fall back to nothing.
6. Prerequisites check in the status banner (`jq`, an audio player, a notifier)
   — right now missing tools are silent by design at fire time, which is correct,
   but setup should say what is missing.
7. `coworkAuditService`: tail one `audit.jsonl`, translate `system/init`,
   `system/permission_request` and `result` only, prove it lights up the monitor.
8. Widen the translation table, then decide the daemon/tray question.
9. Update `README.md` and `package.json` `description` — both still say macOS.

## 7. Verification recipes

The runner is not unit-tested. From `CLAUDE.md`, adapted:

```ts
// gen.ts in the project root so @/ resolves; delete when done
import { RUNNER_SCRIPT } from "@/server/services/runnerService";
import fs from "fs";
fs.writeFileSync("/tmp/runner.sh", RUNNER_SCRIPT);
```

```bash
bun run gen.ts
bash -n /tmp/runner.sh
printf '{"hook_event_name":"Stop","cwd":"/some/project","model":"m"}' \
  | HOOKY_PROJECTS=/tmp/projects.json HOOKY_CONFIG=/tmp/nope.json bash /tmp/runner.sh
echo $?      # must be 0, including for garbage input
```

Anything that spawns the runner for a non-hook reason must set
`HOOKY_EVENTS=/dev/null` — `projects.preview` does. A monitor that lights up
for a `Stop` that never happened is worse than no monitor.

`networkidle` is not a usable Playwright wait condition anywhere in this app:
the SSE connection never goes idle. Use `domcontentloaded` plus a
`waitForSelector`.

For the Cowork adapter, dry-run the translation offline before wiring it live:

```bash
jq -c 'select(.type=="system" and (.subtype|test("permission")))' audit.jsonl
jq -r '.type + "/" + (.subtype // .state // "-")' audit.jsonl | sort | uniq -c
```

## 8. Open questions for the user

- **Volume above 100% on WSL** — clamp, pre-amplify, or cap the slider?
- **How does the colleague run Hooky?** Tray app, Windows service, or manual
  start. This decides how much shell the project needs around the Next app.
- **Do they need the sound board UI at all**, or a preset they install once?
  A non-coder may be better served by a fixed profile plus a mute switch.
- **Which Windows sounds** — audition the §3 table together before committing.

---

## Appendix: quick reference for the Windows box

```bash
# Am I in WSL?
grep -qi microsoft /proc/sys/kernel/osrelease && echo wsl

# Is WSLg audio available?
[ -S /mnt/wslg/PulseServer ] && echo pulse ok
paplay --volume=32768 /mnt/c/Windows/Media/notify.wav

# What sounds does this Windows have?
ls /mnt/c/Windows/Media/*.wav | wc -l

# Where is the desktop app's data?
ls "/mnt/c/Users/$USER/AppData/Roaming/Claude/"

# Prereqs
command -v jq paplay aplay wsl-notify-send.exe
```
