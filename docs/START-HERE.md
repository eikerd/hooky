# Start here

You are picking this repo up on a Windows machine. This file exists so you do
not have to ask the user what is going on. Read it, then `docs/PORTING.md`,
then `CLAUDE.md`.

Everything below is settled. Do not re-litigate it with the user — the open
questions that genuinely need them are in §8, and that is the whole list.

---

## 1. The mission, in one sentence

**When Claude needs the user's attention, Hooky plays a sound of their choosing,
instantly — on whatever machine and whatever Claude surface they are using.**

Everything else in this repo is in service of that. Sounds per event, banners,
project footers, the live monitor — all of it exists so that "Claude is blocked
waiting on you" becomes something you *hear* instead of something you notice
five minutes late.

Hold onto that when you are making tradeoffs. A design that is elegant but adds
latency to the attention signal is the wrong design.

## 2. Who this is for

Two people, two very different setups:

**Ernesto** (the repo owner) — Ubuntu on WSL 2 on Windows 11, running the
**Claude Code CLI**. Hooks work here. This is a normal port: same architecture
as macOS, different audio and notification binaries.

**His colleague** — Windows 11, **Cowork desktop app only**. Not a coder. Never
opens a terminal. Hooks do not work here at all. This needs a different event
source and a different way to run.

The colleague's case is the harder and more valuable one. The single event that
matters most for them is **`permission_request`** — Cowork stopping to ask
permission is precisely "a human needs to look at this," and today they have no
way to know it happened except by staring at the window.

## 3. What already works

macOS is **done and tested**: `bunx tsc --noEmit` clean, `bun run test:e2e`
22/22 passing at commit `d0ffd3e`.

Built and working there:

- Static bash runner reading JSON at fire time (config and execution split)
- 22 hook events, per-event sound / volume / banner / emoji / message
- Project footers printed at `Stop`
- Live SSE monitor — rows light up as hooks fire
- Learn mode, legacy import, safe `settings.json` handling

`README.md` documents the feature model. `CLAUDE.md` documents what will bite
you. Both are current.

## 4. Get it running on this machine

From a cold clone, in WSL:

```bash
bun install
bun run dev                    # http://localhost:3000
```

Node 18+ or Bun. No `.env`, no services, no database. The app reads and writes
real files under `~/.claude`.

To poke at it without touching the real config:

```bash
HOOKY_HOME=/tmp/hooky-sandbox bun run dev
```

To run the tests:

```bash
bunx playwright install chromium     # first time only
bun run test:e2e                     # serial, 22 tests
```

Tests write only to a sandbox home set by `playwright.config.ts`. They cannot
touch the live `~/.claude`. Expect them to pass unchanged on Linux **except**
anything asserting macOS sound paths — `sound-library.spec.ts` is the likely
casualty. That is a real signal, not a flake: it means the default sound map
needs platform-splitting (`docs/PORTING.md` §2).

## 5. Do these three things first

In this order. Steps 2 and 3 are cheap and either one can invalidate the plan,
so do them before writing code.

**1. Get to green.** Run the tests. Fix or platform-gate what breaks. Do not
start porting on a red suite.

**2. Confirm the Cowork audit log exists.**

```bash
ls "/mnt/c/Users/$USER/AppData/Roaming/Claude/local-agent-mode-sessions/"
# expect: <accountId>/<orgId>/local_<sessionUuid>/audit.jsonl
```

If that path is wrong, find the real one before anything else — the entire
Cowork strategy depends on it. On macOS it was
`~/Library/Application Support/Claude/local-agent-mode-sessions/...`.

**3. Re-verify that Cowork still ignores hooks.** Wire a trivial `Stop` hook in
`~/.claude/settings.json` that touches a file, run a Cowork turn, see whether
the file appears. As of the macOS survey it did not, and the tracking issue
([#63360](https://github.com/anthropics/claude-code/issues/63360)) was closed as
not planned — but the Windows build is newer than what was surveyed. If hooks
*do* fire now, the Cowork half collapses into the easy case and you should stop
and say so.

## 6. What was already decided (don't ask)

- **Audio on WSL goes through WSLg's PulseAudio** (`paplay` against
  `/mnt/wslg/PulseServer`), not `powershell.exe`. Interop forks a whole Windows
  process per hook; that does not belong on the critical path.
- **Sounds get copied into `~/.claude/sounds/` at install time**, sourced from
  `C:\Windows\Media\`. The runner never reads `/mnt/c` at fire time.
- **Banners use `wsl-notify-send.exe`** if present, nothing otherwise. Never an
  error.
- **Cowork is read-only observation.** Tail `audit.jsonl`, never write it — it
  is an HMAC-signed audit trail that is not ours.
- **The Cowork adapter is a second producer into `eventLogService`**, not a new
  subsystem. Same SSE fan-out, same UI.
- **No footers on Cowork.** The footer channel is a hook's stdout and there is
  no hook. Say so in the UI rather than showing a dead control.
- **Keep the runner bash-3.2-compatible.** WSL has bash 5, but macOS is still a
  target and `sounds.testEvent` spawns `/bin/bash`. One runner that works on
  both beats two that differ only in dialect.

## 7. The invariants you must not break

From `CLAUDE.md`, repeated here because they are the ones most likely to be
casually violated during a port:

1. **Every failure path exits 0.** Missing config, no `jq`, no audio device —
   all mean "do nothing", never "fail the hook". Hooks run on Claude Code's
   critical path in the user's real editor.
2. **Config and execution stay split.** Never generate shell per user edit.
3. **Only `Stop` writes to stdout.**
4. **`settings.json` holds far more than we model.** `looseObject` everywhere,
   atomic writes, foreign hooks preserved.
5. **The event trace producer is a file append, never a network call.**

The Cowork adapter inverts exactly one of these and you need to notice: for
`hooky-events.log` the server truncates and the runner appends. For
`audit.jsonl` we do neither — read only, always.

## 8. What actually needs the user

These four. Everything else, decide yourself and tell them what you chose.

- **How does the colleague run Hooky?** On Cowork there is no hook process, so
  Hooky itself must be running to make a sound. "Leave a terminal open" is not
  shippable to a non-coder. Tray app, Windows service, or Startup shortcut —
  this is a product call, and it is the biggest open question in the port.
  Do not build it until step 5.2 and 5.3 have proven the audit tailing works.
- **Which Windows sounds** for which events. `docs/PORTING.md` §3 has a draft
  map to audition together.
- **Volume above 100% on WSL** — `paplay`'s scale differs from `afplay`'s.
  Clamp, pre-amplify, or cap the slider?
- **Does the colleague need the full sound board**, or a preset plus a mute
  switch? A non-coder may be better served by the latter.

## 9. Where to look

| File | For |
| --- | --- |
| `docs/PORTING.md` | Platform inventory, WSL plan, Cowork audit-log record mapping |
| `CLAUDE.md` | Runner escaping hazards, bash 3.2 traps, jq gotchas, test invariants |
| `README.md` | User-facing feature model |
| `src/types/soundEvents.ts` | Event catalog — single source of truth |
| `src/server/services/runnerService.ts` | The generated bash runner |
| `src/server/services/eventLogService.ts` | Tail + SSE fan-out; the Cowork adapter feeds this |

## 10. Housekeeping

`testmodal.py` in the repo root is an unrelated modal.com scratch file. It is
not part of Hooky. Ignore it or delete it.
