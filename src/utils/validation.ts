import { z } from "zod";
import { HookEventType, HookHandlerType, HooksConfig, ClaudeSettings } from "@/types/hooks";
import { BurntToastSound, NotificationConfig } from "@/types/notifications";

export const hookHandlerTypeSchema = z.enum(["command", "prompt", "agent"] as const);

export const hookConfigSchema = z.object({
  type: hookHandlerTypeSchema,
  command: z.string().optional(),
  prompt: z.string().optional(),
  matcher: z.string().optional(),
  async: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  statusMessage: z.string().optional(),
  once: z.boolean().optional(),
});

export const hookGroupSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookConfigSchema),
});

export const hookEventTypeSchema = z.enum([
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
] as const);

export const hooksConfigSchema = z.record(
  hookEventTypeSchema,
  z.array(hookGroupSchema).optional()
);

export const claudeSettingsSchema = z.object({
  permissions: z
    .object({
      allow: z.array(z.string()),
    })
    .optional(),
  model: z.string().optional(),
  hooks: hooksConfigSchema.optional(),
});

export const burntToastSoundSchema = z.enum([
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
] as const);

export const notificationConfigSchema = z.object({
  hookName: z.string(),
  emoji: z.string(),
  message: z.string(),
  sound: burntToastSoundSchema,
  enabled: z.boolean(),
});

export function validateSettings(data: unknown): ClaudeSettings {
  return claudeSettingsSchema.parse(data);
}

export function validateNotificationConfig(data: unknown): NotificationConfig {
  return notificationConfigSchema.parse(data);
}

export function validateRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
