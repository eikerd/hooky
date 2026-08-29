/**
 * Shapes for Claude Code's settings.json `hooks` block.
 *
 * HookEventType lives in soundEvents.ts so the event catalog has exactly one
 * definition -- it used to be declared here *and* in constants.ts *and* in
 * validation.ts, which is how the list drifted out of sync in the first place.
 */
export type { HookEventType } from "./soundEvents";
export { HOOK_EVENTS_ORDERED, EVENT_META } from "./soundEvents";

import type { HookEventType } from "./soundEvents";

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

/**
 * Deliberately open-ended: settings.json holds many keys Hooky doesn't model
 * (env, statusLine, enabledPlugins, tui...) and they must survive a write.
 * See the note in utils/validation.ts.
 */
export interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    [key: string]: unknown;
  };
  model?: string;
  hooks?: HooksConfig;
  [key: string]: unknown;
}
