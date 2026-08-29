import fs from "fs/promises";
import path from "path";
import { soundConfigService } from "@/server/services/soundConfigService";
import { hookWiringService } from "@/server/services/hookWiringService";
import { HookySoundConfig, HOOK_EVENTS_ORDERED } from "@/types/soundEvents";
import { CONFIG_PATHS } from "@/utils/constants";

/**
 * "Learn mode": wire all 22 events, silently.
 *
 * The point is to watch the lifecycle in the live monitor. An event that isn't
 * in settings.json never invokes the runner, so it can never be observed --
 * which means observing everything requires wiring everything, including the
 * two that fire on every single tool call.
 *
 * That costs ~13ms per hook (bash startup + two jq passes; the sound work is
 * not the expensive part), so roughly 26ms per tool call. Real, but bounded --
 * and the reason this is a temporary mode with a one-click exit rather than a
 * default.
 *
 * Restoration is exact, not reconstructed: the previous config is copied
 * wholesale before anything is touched, so leaving learn mode returns every
 * sound, volume, emoji and message to precisely what it was.
 */
class LearnModeService {
  async isActive(): Promise<boolean> {
    try {
      await fs.access(CONFIG_PATHS.learnBackup);
      return true;
    } catch {
      return false;
    }
  }

  async enter(): Promise<HookySoundConfig> {
    const current = await soundConfigService.read();

    // Snapshot first. If this throws we abort having changed nothing, rather
    // than entering a mode we can't cleanly leave.
    if (!(await this.isActive())) {
      await fs.mkdir(path.dirname(CONFIG_PATHS.learnBackup), { recursive: true });
      const tmp = `${CONFIG_PATHS.learnBackup}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(current, null, 2), "utf-8");
      await fs.rename(tmp, CONFIG_PATHS.learnBackup);
    }

    const learn: HookySoundConfig = structuredClone(current);
    learn.enabled = true;
    for (const event of HOOK_EVENTS_ORDERED) {
      learn.events[event] = {
        ...learn.events[event],
        // Enabled purely so hookWiringService wires it. Silent + no banner
        // means the only observable effect is the trace line.
        enabled: true,
        soundPath: "",
        banner: false,
      };
    }

    await soundConfigService.write(learn);
    await hookWiringService.sync(learn);
    return learn;
  }

  async exit(): Promise<HookySoundConfig> {
    let restored: HookySoundConfig;
    try {
      const raw = await fs.readFile(CONFIG_PATHS.learnBackup, "utf-8");
      restored = JSON.parse(raw) as HookySoundConfig;
    } catch {
      // No usable snapshot: leave the current config alone rather than
      // guessing. Silence would be a worse outcome than staying in learn mode.
      return soundConfigService.read();
    }

    await soundConfigService.write(restored);
    await hookWiringService.sync(restored);
    // Only drop the flag once the restore has actually landed.
    await fs.rm(CONFIG_PATHS.learnBackup, { force: true });
    return restored;
  }
}

export const learnModeService = new LearnModeService();
