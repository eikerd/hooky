export type HookEventType =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PermissionRequest"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "PreCompact"
  | "SessionEnd";

export type HookHandlerType = "command" | "prompt" | "agent";

export interface HookConfig {
  type: HookHandlerType;
  command?: string;
  prompt?: string;
  matcher?: string;
  async?: boolean;
  timeout?: number;
  statusMessage?: string;
  once?: boolean;
}

export interface HookGroup {
  matcher?: string;
  hooks: HookConfig[];
}

export type HooksConfig = Partial<Record<HookEventType, HookGroup[]>>;

export interface ClaudeSettings {
  permissions?: { allow: string[] };
  model?: string;
  hooks?: HooksConfig;
}

export const HOOK_EVENTS: Record<HookEventType, string> = {
  SessionStart: "Session Started",
  UserPromptSubmit: "User Prompt Submitted",
  PreToolUse: "Before Tool Execution",
  PermissionRequest: "Permission Requested",
  PostToolUse: "After Tool Execution",
  PostToolUseFailure: "Tool Execution Failed",
  Notification: "Notification",
  SubagentStart: "Subagent Started",
  SubagentStop: "Subagent Stopped",
  Stop: "Session Stopped",
  PreCompact: "Before Compaction",
  SessionEnd: "Session Ended",
};
