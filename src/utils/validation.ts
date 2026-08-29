import { z } from "zod";
import { ClaudeSettings } from "@/types/hooks";
import {
  HookySoundConfig,
  HookEventType,
  HOOK_EVENTS_ORDERED,
} from "@/types/soundEvents";

export const hookHandlerTypeSchema = z.enum(["command", "prompt", "agent"] as const);

export const hookConfigSchema = z.looseObject({
  type: hookHandlerTypeSchema,
  command: z.string().optional(),
  prompt: z.string().optional(),
  matcher: z.string().optional(),
  async: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  statusMessage: z.string().optional(),
  once: z.boolean().optional(),
});

export const hookGroupSchema = z.looseObject({
  matcher: z.string().optional(),
  hooks: z.array(hookConfigSchema),
});

/**
 * Derived from the catalog rather than re-listed. The event list previously
 * existed in four places (types/hooks.ts, constants.ts, validation.ts and the
 * bash script) and had already drifted between them -- deriving it means
 * adding an event in one file is enough.
 */
export const hookEventTypeSchema = z.enum(
  HOOK_EVENTS_ORDERED as [HookEventType, ...HookEventType[]]
);

export const hooksConfigSchema = z.record(
  hookEventTypeSchema,
  z.array(hookGroupSchema).optional()
);

/**
 * IMPORTANT: every object here is `looseObject`, never `object`.
 *
 * settings.json is the user's live Claude Code config and holds far more than
 * Hooky models -- env, statusLine, enabledPlugins, tui, teammateMode,
 * alwaysThinkingEnabled, permissions.deny, permissions.defaultMode, plus
 * whatever keys Claude Code adds later. Zod's `z.object()` *strips* unknown
 * keys, so validating before a write silently deletes all of it. Loose objects
 * preserve everything we don't know about.
 */
export const claudeSettingsSchema = z.looseObject({
  permissions: z
    .looseObject({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
      ask: z.array(z.string()).optional(),
    })
    .optional(),
  model: z.string().optional(),
  hooks: hooksConfigSchema.optional(),
});

export const eventSoundConfigSchema = z.object({
  enabled: z.boolean(),
  soundPath: z.string(),
  volume: z.number().min(0).max(2),
  banner: z.boolean(),
  emoji: z.string(),
  message: z.string(),
  includeDetails: z.boolean(),
});

export const hookySoundConfigSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  events: z.record(hookEventTypeSchema, eventSoundConfigSchema),
});

export const footerLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  when: z.string(),
});

export const projectFooterSchema = z.object({
  enabled: z.boolean(),
  icon: z.string(),
  title: z.string(),
  meta: z.array(z.string()),
  links: z.array(footerLinkSchema),
  notes: z.array(z.string()),
});

export const hookyProjectsConfigSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  default: projectFooterSchema.nullable(),
  projects: z.record(z.string(), projectFooterSchema),
});

export function validateSettings(data: unknown): ClaudeSettings {
  return claudeSettingsSchema.parse(data) as ClaudeSettings;
}

export function validateSoundConfig(data: unknown): HookySoundConfig {
  return hookySoundConfigSchema.parse(data) as HookySoundConfig;
}

export function validateRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
