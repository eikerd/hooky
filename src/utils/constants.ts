import { HookEventType } from "@/types/hooks";
import { BurntToastSound } from "@/types/notifications";
import os from "os";
import path from "path";

const homeDir = os.homedir();

export const CONFIG_PATHS = {
  settings: path.join(homeDir, ".claude", "settings.json"),
  settingsBackup: path.join(homeDir, ".claude", "settings.json.bak"),
  psScript: path.join(homeDir, ".config", "claude", "hooks", "claude-notify.ps1"),
  bashWrapper: path.join(homeDir, ".config", "claude", "hooks", "claude-notify-wsl.sh"),
};

export const HOOK_EVENTS_ORDERED: HookEventType[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "PreCompact",
  "SessionEnd",
];

export const SOUND_GROUPS: Record<string, BurntToastSound[]> = {
  System: ["Default", "IM", "Mail", "Reminder", "SMS"],
  Alerts: ["Alarm"],
  Calls: ["Call", "Call2", "Call3", "Call4", "Call5", "Call6", "Call7", "Call8", "Call9", "Call10"],
};
