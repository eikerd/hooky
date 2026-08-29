import os from "os";
import path from "path";

/**
 * HOOKY_HOME redirects every path below at a sandbox directory.
 *
 * Tests set it so a suite can never write to the developer's real
 * ~/.claude/settings.json -- the previous e2e suite toggled hooks against the
 * live config, which is exactly how a test run could clobber real settings.
 */
const homeDir = process.env.HOOKY_HOME || os.homedir();

export const CONFIG_PATHS = {
  /** Claude Code's live settings. Hooky only ever touches the `hooks` key. */
  settings: path.join(homeDir, ".claude", "settings.json"),
  settingsBackup: path.join(homeDir, ".claude", "settings.json.bak"),
  /** Hooky's own config -- the source of truth for sounds. */
  soundConfig: path.join(homeDir, ".claude", "hooky.json"),
  /** Per-project footer metadata, keyed by absolute project directory. */
  projectConfig: path.join(homeDir, ".claude", "hooky-projects.json"),
  /** The generated runner. Static: it reads soundConfig at runtime. */
  runner: path.join(homeDir, ".claude", "hooky-notify.sh"),
  /**
   * Append-only trace of every hook that reached the runner, for the live
   * monitor. Written with a bare `>>` redirect (no subprocess, O_APPEND so
   * concurrent sessions can't interleave) and read by the SSE endpoint.
   */
  eventLog: path.join(homeDir, ".claude", "hooky-events.log"),
  /**
   * Snapshot of hooky.json taken when learn mode is entered. Its existence IS
   * the "learn mode is on" flag -- a separate file rather than a key inside
   * hooky.json, so the runner's view of config stays exactly what it always
   * was and a crash mid-toggle can never leave a half-flagged config.
   */
  learnBackup: path.join(homeDir, ".claude", "hooky-learn-backup.json"),
};

/** Field separator in the event log -- US (0x1f), matching the runner. */
export const EVENT_LOG_SEP = "\u001f";

/** Rotate the log once it passes this, so an idle month can't grow it forever. */
export const EVENT_LOG_MAX_BYTES = 512 * 1024;

/** Directories scanned for playable sounds, in priority order. */
export const SOUND_DIRS = [
  "/System/Library/Sounds",
  "/Library/Sounds",
  path.join(homeDir, "Library", "Sounds"),
  path.join(homeDir, ".claude", "sounds"),
];

export const SOUND_EXTENSIONS = [".aiff", ".aif", ".wav", ".m4a", ".mp3", ".caf"];
