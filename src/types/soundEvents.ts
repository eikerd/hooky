/**
 * The single source of truth for how Hooky maps Claude Code hook events to
 * macOS sounds and notification banners.
 *
 * The event list and each event's payload fields were taken from the installed
 * Claude Code CLI's own hook-event enum and dispatch switch, not from guesswork.
 * Claude Code emits 31 events; the ones covered here are those worth hearing.
 * Deliberately omitted because they fire constantly or carry no user-meaningful
 * signal: MessageDisplay, FileChanged, CwdChanged, InstructionsLoaded,
 * ConfigChange, DirectoryAdded, PostToolBatch, UserPromptExpansion,
 * ElicitationResult.
 *
 * Config is persisted as JSON at ~/.claude/hooky.json and read at runtime by
 * the generated runner script. Nothing here is ever parsed back out of
 * generated code -- the JSON is authoritative in both directions.
 */

export type HookEventType =
  // Conversation
  | "Stop"
  | "StopFailure"
  | "Notification"
  | "UserPromptSubmit"
  // Tools
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  // Permissions & input
  | "PermissionRequest"
  | "PermissionDenied"
  | "Elicitation"
  // Agents & tasks
  | "SubagentStart"
  | "SubagentStop"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  // Session
  | "SessionStart"
  | "SessionEnd"
  | "Setup"
  // Context
  | "PreCompact"
  | "PostCompact"
  // Worktrees
  | "WorktreeCreate"
  | "WorktreeRemove";

export interface EventSoundConfig {
  /** Master switch for this event: when false the runner exits before doing anything. */
  enabled: boolean;
  /** Absolute path to an audio file, or "" for silent (banner-only). */
  soundPath: string;
  /** afplay volume. 1 = normal, 2 = double. */
  volume: number;
  /** Show a macOS notification banner via terminal-notifier. */
  banner: boolean;
  /** Prefixed to the banner message. */
  emoji: string;
  /** Banner body. Supports the placeholders listed in EVENT_META.fields. */
  message: string;
  /** Append contextual detail lines to the banner. */
  includeDetails: boolean;
}

export interface HookySoundConfig {
  version: 1;
  /** Global mute. Overrides every per-event `enabled`. */
  enabled: boolean;
  events: Record<HookEventType, EventSoundConfig>;
}

export type EventCategory =
  | "Conversation"
  | "Tools"
  | "Permissions & Input"
  | "Agents & Tasks"
  | "Session"
  | "Context"
  | "Worktrees";

export const CATEGORY_ORDER: EventCategory[] = [
  "Conversation",
  "Permissions & Input",
  "Agents & Tasks",
  "Tools",
  "Session",
  "Context",
  "Worktrees",
];

export interface EventMeta {
  label: string;
  /** One line, plain language: when does this actually fire? */
  when: string;
  /** Rough firing frequency, so users can predict how noisy a sound will be. */
  frequency: "constant" | "often" | "occasional" | "rare";
  category: EventCategory;
  /**
   * Message placeholders valid for this event, derived from the payload fields
   * Claude Code actually sends. Showing only the relevant ones stops users
   * inserting e.g. {teammate} into Stop, where it would render empty.
   */
  fields: string[];
}

/** Placeholders every event carries. */
const COMMON_FIELDS = ["{model}", "{hook}"];

export const EVENT_META: Record<HookEventType, EventMeta> = {
  // --- Conversation ------------------------------------------------------
  Stop: {
    label: "Response Complete",
    when: "Claude finishes replying and hands control back to you.",
    frequency: "often",
    category: "Conversation",
    fields: COMMON_FIELDS,
  },
  StopFailure: {
    label: "Response Failed",
    when: "The turn ends in an error instead of a normal reply.",
    frequency: "occasional",
    category: "Conversation",
    fields: ["{error}", ...COMMON_FIELDS],
  },
  Notification: {
    label: "Notification",
    when: "Claude wants your attention (idle, waiting on input).",
    frequency: "occasional",
    category: "Conversation",
    fields: ["{notifyType}", ...COMMON_FIELDS],
  },
  UserPromptSubmit: {
    label: "Prompt Submitted",
    when: "You press enter on a prompt.",
    frequency: "often",
    category: "Conversation",
    fields: COMMON_FIELDS,
  },

  // --- Tools -------------------------------------------------------------
  PreToolUse: {
    label: "Before Tool Runs",
    when: "Before every single tool call (Read, Edit, Bash...).",
    frequency: "constant",
    category: "Tools",
    fields: ["{tool}", "{file}", ...COMMON_FIELDS],
  },
  PostToolUse: {
    label: "After Tool Runs",
    when: "After every single tool call completes.",
    frequency: "constant",
    category: "Tools",
    fields: ["{tool}", "{file}", ...COMMON_FIELDS],
  },
  PostToolUseFailure: {
    label: "Tool Failed",
    when: "A tool call errors out.",
    frequency: "occasional",
    category: "Tools",
    fields: ["{tool}", "{file}", ...COMMON_FIELDS],
  },

  // --- Permissions & input ----------------------------------------------
  PermissionRequest: {
    label: "Permission Requested",
    when: "Claude asks before running something it needs approval for.",
    frequency: "occasional",
    category: "Permissions & Input",
    fields: ["{tool}", "{file}", ...COMMON_FIELDS],
  },
  PermissionDenied: {
    label: "Permission Denied",
    when: "A permission request was refused.",
    frequency: "occasional",
    category: "Permissions & Input",
    fields: ["{tool}", "{reason}", "{file}", ...COMMON_FIELDS],
  },
  Elicitation: {
    label: "Input Requested",
    when: "An MCP server asks you for structured input.",
    frequency: "rare",
    category: "Permissions & Input",
    fields: ["{server}", "{message}", ...COMMON_FIELDS],
  },

  // --- Agents & tasks ----------------------------------------------------
  SubagentStart: {
    label: "Subagent Started",
    when: "A background agent is spawned.",
    frequency: "rare",
    category: "Agents & Tasks",
    fields: ["{agent}", ...COMMON_FIELDS],
  },
  SubagentStop: {
    label: "Subagent Finished",
    when: "A background agent completes its task.",
    frequency: "rare",
    category: "Agents & Tasks",
    fields: ["{agent}", ...COMMON_FIELDS],
  },
  TeammateIdle: {
    label: "Teammate Waiting",
    when: "A teammate in an agent team is idle and blocked on you.",
    frequency: "occasional",
    category: "Agents & Tasks",
    fields: ["{teammate}", "{team}", ...COMMON_FIELDS],
  },
  TaskCreated: {
    label: "Task Created",
    when: "A task is added to the queue.",
    frequency: "occasional",
    category: "Agents & Tasks",
    fields: ["{task}", "{teammate}", "{team}", ...COMMON_FIELDS],
  },
  TaskCompleted: {
    label: "Task Completed",
    when: "A queued task finishes.",
    frequency: "occasional",
    category: "Agents & Tasks",
    fields: ["{task}", "{teammate}", "{team}", ...COMMON_FIELDS],
  },

  // --- Session -----------------------------------------------------------
  SessionStart: {
    label: "Session Started",
    when: "A new Claude Code session opens.",
    frequency: "rare",
    category: "Session",
    fields: ["{source}", ...COMMON_FIELDS],
  },
  SessionEnd: {
    label: "Session Ended",
    when: "The session closes.",
    frequency: "rare",
    category: "Session",
    fields: ["{reason}", ...COMMON_FIELDS],
  },
  Setup: {
    label: "Setup",
    when: "Claude Code runs first-time or project setup.",
    frequency: "rare",
    category: "Session",
    fields: ["{trigger}", ...COMMON_FIELDS],
  },

  // --- Context -----------------------------------------------------------
  PreCompact: {
    label: "Before Compaction",
    when: "Context is about to be summarized to free up tokens.",
    frequency: "rare",
    category: "Context",
    fields: ["{trigger}", ...COMMON_FIELDS],
  },
  PostCompact: {
    label: "After Compaction",
    when: "Context has finished being summarized.",
    frequency: "rare",
    category: "Context",
    fields: ["{trigger}", ...COMMON_FIELDS],
  },

  // --- Worktrees ---------------------------------------------------------
  WorktreeCreate: {
    label: "Worktree Created",
    when: "A git worktree is created for isolated agent work.",
    frequency: "rare",
    category: "Worktrees",
    fields: ["{name}", ...COMMON_FIELDS],
  },
  WorktreeRemove: {
    label: "Worktree Removed",
    when: "A git worktree is torn down.",
    frequency: "rare",
    category: "Worktrees",
    fields: ["{path}", ...COMMON_FIELDS],
  },
};

/** Display order in the UI: by category, then by usefulness within it. */
export const HOOK_EVENTS_ORDERED: HookEventType[] = [
  "Stop",
  "StopFailure",
  "Notification",
  "UserPromptSubmit",
  "PermissionRequest",
  "PermissionDenied",
  "Elicitation",
  "TeammateIdle",
  "TaskCompleted",
  "TaskCreated",
  "SubagentStart",
  "SubagentStop",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SessionStart",
  "SessionEnd",
  "Setup",
  "PreCompact",
  "PostCompact",
  "WorktreeCreate",
  "WorktreeRemove",
];

const SYS = "/System/Library/Sounds";

function evt(p: Partial<EventSoundConfig>): EventSoundConfig {
  return {
    enabled: true,
    soundPath: "",
    volume: 1,
    banner: true,
    emoji: "",
    message: "",
    includeDetails: false,
    ...p,
  };
}

/**
 * Defaults reproduce the behavior of the hand-written
 * ~/.claude/claude-notify-macos.sh for the events it covered, with one change:
 * the "constant" events (PreToolUse/PostToolUse) ship muted, since firing on
 * every single tool call is what makes hook audio unbearable.
 *
 * Newer events default to enabled only where the sound answers a question you
 * can't see on screen -- something is blocked, failed, or finished in the
 * background. Bookkeeping events ship muted.
 */
export const DEFAULT_SOUND_CONFIG: HookySoundConfig = {
  version: 1,
  enabled: true,
  events: {
    // Conversation
    Stop: evt({ soundPath: `${SYS}/Hero.aiff`, emoji: "🛑", message: "Response complete" }),
    StopFailure: evt({
      soundPath: `${SYS}/Sosumi.aiff`,
      emoji: "💥",
      message: "Response failed: {error}",
    }),
    Notification: evt({ soundPath: `${SYS}/Ping.aiff`, emoji: "ℹ️", message: "Notification" }),
    UserPromptSubmit: evt({
      enabled: false,
      soundPath: `${SYS}/Tink.aiff`,
      emoji: "💭",
      message: "Processing prompt...",
      banner: false,
    }),

    // Tools
    PreToolUse: evt({
      enabled: false,
      soundPath: `${SYS}/Pop.aiff`,
      emoji: "🔧",
      message: "Running: {tool}",
      banner: false,
    }),
    PostToolUse: evt({
      enabled: false,
      soundPath: `${SYS}/Purr.aiff`,
      emoji: "✅",
      message: "Completed: {tool}",
      banner: false,
    }),
    PostToolUseFailure: evt({
      soundPath: `${SYS}/Basso.aiff`,
      emoji: "❌",
      message: "Failed: {tool}",
      includeDetails: true,
    }),

    // Permissions & input
    PermissionRequest: evt({
      soundPath: `${SYS}/Funk.aiff`,
      emoji: "🔐",
      message: "Permission requested: {tool}",
    }),
    PermissionDenied: evt({
      soundPath: `${SYS}/Morse.aiff`,
      emoji: "🚫",
      message: "Denied: {tool} — {reason}",
    }),
    Elicitation: evt({
      soundPath: `${SYS}/Bottle.aiff`,
      emoji: "✍️",
      message: "{server} needs input",
    }),

    // Agents & tasks
    SubagentStart: evt({
      enabled: false,
      soundPath: `${SYS}/Pop.aiff`,
      emoji: "🤖",
      message: "Agent started: {agent}",
      banner: false,
    }),
    SubagentStop: evt({
      soundPath: `${SYS}/Glass.aiff`,
      emoji: "🤖",
      message: "Agent finished: {agent}",
    }),
    TeammateIdle: evt({
      soundPath: `${SYS}/Blow.aiff`,
      emoji: "⏳",
      message: "{teammate} is waiting on you",
    }),
    TaskCompleted: evt({
      soundPath: `${SYS}/Purr.aiff`,
      emoji: "📋",
      message: "Task done: {task}",
    }),
    TaskCreated: evt({
      enabled: false,
      soundPath: `${SYS}/Pop.aiff`,
      emoji: "📋",
      message: "Task queued: {task}",
      banner: false,
    }),

    // Session
    SessionStart: evt({ soundPath: `${SYS}/Glass.aiff`, emoji: "▶️", message: "Session started" }),
    SessionEnd: evt({
      soundPath: `${SYS}/Submarine.aiff`,
      emoji: "👋",
      message: "Session ended",
    }),
    Setup: evt({
      enabled: false,
      soundPath: `${SYS}/Blow.aiff`,
      emoji: "🧰",
      message: "Setup: {trigger}",
    }),

    // Context
    PreCompact: evt({
      soundPath: `${SYS}/Tink.aiff`,
      emoji: "📦",
      message: "Compacting context...",
    }),
    PostCompact: evt({
      enabled: false,
      soundPath: `${SYS}/Bottle.aiff`,
      emoji: "📦",
      message: "Context compacted",
    }),

    // Worktrees
    WorktreeCreate: evt({
      enabled: false,
      soundPath: `${SYS}/Frog.aiff`,
      emoji: "🌿",
      message: "Worktree created: {name}",
    }),
    WorktreeRemove: evt({
      enabled: false,
      soundPath: `${SYS}/Frog.aiff`,
      emoji: "🌿",
      message: "Worktree removed",
    }),
  },
};
