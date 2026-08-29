import { configService } from "@/server/services/configService";
import { runnerService } from "@/server/services/runnerService";
import { projectConfigService } from "@/server/services/projectConfigService";
import { HookConfig, HookGroup } from "@/types/hooks";
import { HookEventType, HookySoundConfig, HOOK_EVENTS_ORDERED } from "@/types/soundEvents";

/** Recognizes Hooky's own runner regardless of ~ vs. absolute path. */
const RUNNER_PATTERN = /hooky-notify\.sh/;
/**
 * Hand-written scripts this app replaces, detected so we can offer cleanup.
 * project-footer.sh is included because Hooky now draws the footer itself --
 * leaving it wired would print two boxes on every turn.
 */
const LEGACY_PATTERN =
  /claude-notify-macos\.sh|claude-notify\.ps1|claude-notify-wsl\.sh|project-footer\.sh/;

export interface WiringStatus {
  /** Events where Hooky's runner is currently wired into settings.json. */
  wiredEvents: HookEventType[];
  /** Events that should be wired given the current config but aren't. */
  missingEvents: HookEventType[];
  /** Events wired to a different notifier script (e.g. the old bash one). */
  legacyEvents: HookEventType[];
  runnerInstalled: boolean;
  runnerStale: boolean;
  runnerPath: string;
  /** True when some project footer could render, which forces Stop to be wired. */
  footerActive: boolean;
  inSync: boolean;
}

function isRunner(hook: HookConfig): boolean {
  return hook.type === "command" && RUNNER_PATTERN.test(hook.command ?? "");
}

function isLegacy(hook: HookConfig): boolean {
  return hook.type === "command" && LEGACY_PATTERN.test(hook.command ?? "");
}

export class HookWiringService {
  /**
   * Which events must be wired for the current configuration to work.
   *
   * Sounds drive this per-event, but the footer is a second, independent
   * reason to wire Stop: a project can have a footer while Stop plays no
   * sound at all. Without this, muting Stop would unwire it and the footer
   * would vanish with no visible cause.
   */
  private async wireDecision(
    config: HookySoundConfig
  ): Promise<{ wanted: (event: HookEventType) => boolean; footerActive: boolean }> {
    const projects = await projectConfigService.read();
    const footerActive = projectConfigService.hasActiveFooter(projects);

    return {
      footerActive,
      wanted: (event) =>
        Boolean(config.enabled && config.events[event]?.enabled) ||
        (event === "Stop" && footerActive),
    };
  }

  /**
   * Wire settings.json to match the sound and project configs.
   *
   * Only events that are actually needed get wired. That's deliberate: a
   * disabled PreToolUse costs literally nothing instead of spawning bash+jq on
   * every single tool call just to exit early.
   *
   * Hooks belonging to anything other than Hooky are preserved untouched -- we
   * filter out only our own runner entries before re-adding them.
   */
  async sync(config: HookySoundConfig, opts: { removeLegacy?: boolean } = {}): Promise<void> {
    await runnerService.install();

    const { wanted } = await this.wireDecision(config);
    const settings = await configService.readSettings();
    const hooks = { ...(settings.hooks ?? {}) };
    const command = runnerService.scriptPath;

    for (const event of HOOK_EVENTS_ORDERED) {
      const groups: HookGroup[] = hooks[event] ? [...hooks[event]!] : [];

      // Strip our runner (and optionally the legacy notifier) from every group.
      const cleaned: HookGroup[] = groups.map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter(
          (hook) => !isRunner(hook) && !(opts.removeLegacy && isLegacy(hook))
        ),
      }));

      if (wanted(event)) {
        const target = cleaned.find((group) => group.matcher === "*") ?? cleaned[0];
        if (target) {
          target.hooks = [...target.hooks, { type: "command", command }];
        } else {
          cleaned.push({ matcher: "*", hooks: [{ type: "command", command }] });
        }
      }

      // Drop groups we emptied out, and the event key itself if nothing remains.
      const remaining = cleaned.filter((group) => group.hooks.length > 0);
      if (remaining.length > 0) {
        hooks[event] = remaining;
      } else {
        delete hooks[event];
      }
    }

    await configService.writeSettings({ ...settings, hooks });
  }

  /** Remove Hooky's runner from every event, leaving other hooks alone. */
  async unwire(): Promise<void> {
    const settings = await configService.readSettings();
    const hooks = { ...(settings.hooks ?? {}) };

    for (const event of HOOK_EVENTS_ORDERED) {
      if (!hooks[event]) continue;

      const remaining = hooks[event]!
        .map((group) => ({
          ...group,
          hooks: (group.hooks ?? []).filter((hook) => !isRunner(hook)),
        }))
        .filter((group) => group.hooks.length > 0);

      if (remaining.length > 0) {
        hooks[event] = remaining;
      } else {
        delete hooks[event];
      }
    }

    await configService.writeSettings({ ...settings, hooks });
  }

  async status(config: HookySoundConfig): Promise<WiringStatus> {
    const { wanted, footerActive } = await this.wireDecision(config);
    const settings = await configService.readSettings();
    const hooks = settings.hooks ?? {};

    const wiredEvents: HookEventType[] = [];
    const legacyEvents: HookEventType[] = [];
    const missingEvents: HookEventType[] = [];

    for (const event of HOOK_EVENTS_ORDERED) {
      const all = (hooks[event] ?? []).flatMap((group) => group.hooks ?? []);
      const wired = all.some(isRunner);

      if (wired) wiredEvents.push(event);
      if (all.some(isLegacy)) legacyEvents.push(event);
      if (wanted(event) && !wired) missingEvents.push(event);
    }

    const runnerInstalled = await runnerService.isInstalled();
    const runnerStale = await runnerService.needsRefresh();

    // Wired but no longer wanted -- e.g. the user just disabled the event.
    const stale = wiredEvents.filter((event) => !wanted(event));

    return {
      wiredEvents,
      missingEvents,
      legacyEvents,
      runnerInstalled,
      runnerStale,
      runnerPath: runnerService.scriptPath,
      footerActive,
      inSync:
        runnerInstalled &&
        !runnerStale &&
        missingEvents.length === 0 &&
        stale.length === 0 &&
        legacyEvents.length === 0,
    };
  }
}

export const hookWiringService = new HookWiringService();
