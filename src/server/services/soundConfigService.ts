import fs from "fs/promises";
import path from "path";
import {
  DEFAULT_SOUND_CONFIG,
  EventSoundConfig,
  HookEventType,
  HookySoundConfig,
  HOOK_EVENTS_ORDERED,
} from "@/types/soundEvents";
import { CONFIG_PATHS } from "@/utils/constants";

/**
 * Owns ~/.claude/hooky.json.
 *
 * Reads are forgiving: a missing, truncated, or partially hand-edited file
 * still yields a complete config by merging over the defaults. That matters
 * because the runner script reads this same file on Claude Code's critical
 * path -- we never want the UI and the runner to disagree about what a
 * half-written config means.
 */
export class SoundConfigService {
  async read(): Promise<HookySoundConfig> {
    try {
      const raw = await fs.readFile(CONFIG_PATHS.soundConfig, "utf-8");
      return this.merge(JSON.parse(raw));
    } catch {
      return structuredClone(DEFAULT_SOUND_CONFIG);
    }
  }

  /** Fill in anything missing so every event is always fully specified. */
  private merge(partial: unknown): HookySoundConfig {
    const base = structuredClone(DEFAULT_SOUND_CONFIG);
    if (!partial || typeof partial !== "object") return base;

    const input = partial as Partial<HookySoundConfig>;
    if (typeof input.enabled === "boolean") base.enabled = input.enabled;

    for (const event of HOOK_EVENTS_ORDERED) {
      const stored = input.events?.[event];
      if (stored && typeof stored === "object") {
        base.events[event] = { ...base.events[event], ...stored };
      }
    }
    return base;
  }

  async write(config: HookySoundConfig): Promise<void> {
    await fs.mkdir(path.dirname(CONFIG_PATHS.soundConfig), { recursive: true });

    // Atomic write so the runner never reads a half-flushed file mid-hook.
    const tmp = `${CONFIG_PATHS.soundConfig}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(config, null, 2), "utf-8");
    await fs.rename(tmp, CONFIG_PATHS.soundConfig);
  }

  async updateEvent(
    event: HookEventType,
    patch: Partial<EventSoundConfig>
  ): Promise<HookySoundConfig> {
    const config = await this.read();
    config.events[event] = { ...config.events[event], ...patch };
    await this.write(config);
    return config;
  }

  async setGlobalEnabled(enabled: boolean): Promise<HookySoundConfig> {
    const config = await this.read();
    config.enabled = enabled;
    await this.write(config);
    return config;
  }

  async resetToDefaults(): Promise<HookySoundConfig> {
    const config = structuredClone(DEFAULT_SOUND_CONFIG);
    await this.write(config);
    return config;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(CONFIG_PATHS.soundConfig);
      return true;
    } catch {
      return false;
    }
  }
}

export const soundConfigService = new SoundConfigService();
