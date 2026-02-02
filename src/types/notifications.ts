export type BurntToastSound =
  | "Default"
  | "IM"
  | "Mail"
  | "Reminder"
  | "SMS"
  | "Alarm"
  | "Call"
  | "Call2"
  | "Call3"
  | "Call4"
  | "Call5"
  | "Call6"
  | "Call7"
  | "Call8"
  | "Call9"
  | "Call10";

export interface NotificationConfig {
  hookName: string;
  emoji: string;
  message: string;
  sound: BurntToastSound;
  enabled: boolean;
}

export const BURNT_TOAST_SOUNDS: BurntToastSound[] = [
  "Default",
  "IM",
  "Mail",
  "Reminder",
  "SMS",
  "Alarm",
  "Call",
  "Call2",
  "Call3",
  "Call4",
  "Call5",
  "Call6",
  "Call7",
  "Call8",
  "Call9",
  "Call10",
];

export const DEFAULT_NOTIFICATIONS: NotificationConfig[] = [
  {
    hookName: "on_start",
    emoji: "🚀",
    message: "Task Started",
    sound: "Default",
    enabled: true,
  },
  {
    hookName: "on_stream_start",
    emoji: "▶️",
    message: "Streaming Started",
    sound: "Default",
    enabled: true,
  },
  {
    hookName: "on_completion",
    emoji: "✅",
    message: "Completed",
    sound: "Default",
    enabled: true,
  },
  {
    hookName: "on_error",
    emoji: "❌",
    message: "Error Occurred",
    sound: "Alarm",
    enabled: true,
  },
  {
    hookName: "on_cancel",
    emoji: "🛑",
    message: "Cancelled",
    sound: "Default",
    enabled: true,
  },
  {
    hookName: "on_timeout",
    emoji: "⏱️",
    message: "Timeout",
    sound: "Reminder",
    enabled: true,
  },
  {
    hookName: "on_token_limit",
    emoji: "📊",
    message: "Token Limit Reached",
    sound: "Reminder",
    enabled: true,
  },
];
