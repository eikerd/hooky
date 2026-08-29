import { z } from "zod";
import { spawn } from "child_process";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { soundConfigService } from "@/server/services/soundConfigService";
import { systemSoundsService } from "@/server/services/systemSoundsService";
import { hookWiringService } from "@/server/services/hookWiringService";
import { learnModeService } from "@/server/services/learnModeService";
import { runnerService } from "@/server/services/runnerService";
import { hookEventTypeSchema, eventSoundConfigSchema } from "@/utils/validation";
import { EVENT_META, HOOK_EVENTS_ORDERED } from "@/types/soundEvents";

export const soundsRouter = createTRPCRouter({
  /** Everything the sound board needs in one round trip. */
  board: publicProcedure.query(async () => {
    const config = await soundConfigService.read();
    const [sounds, status, learnMode] = await Promise.all([
      systemSoundsService.list(),
      hookWiringService.status(config),
      learnModeService.isActive(),
    ]);

    return {
      config,
      sounds,
      status,
      learnMode,
      events: HOOK_EVENTS_ORDERED.map((event) => ({
        event,
        ...EVENT_META[event],
        settings: config.events[event],
      })),
    };
  }),

  /**
   * The sound library: every playable file, plus which events currently point
   * at it. The usage map is what makes picking a *free* sound possible --
   * reusing one that already means something is how hook audio stops carrying
   * information.
   */
  library: publicProcedure.query(async () => {
    const [sounds, config] = await Promise.all([
      systemSoundsService.list(),
      soundConfigService.read(),
    ]);

    const usage: Record<string, string[]> = {};
    for (const event of HOOK_EVENTS_ORDERED) {
      const { soundPath, enabled } = config.events[event];
      if (!soundPath || !enabled) continue;
      (usage[soundPath] ??= []).push(event);
    }

    return { sounds, usage };
  }),

  /**
   * Wire every event silently so the live monitor can see the whole lifecycle,
   * or restore the exact config that was in place before.
   */
  setLearnMode: publicProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ input }) => {
      const config = input.active ? await learnModeService.enter() : await learnModeService.exit();
      return { config, learnMode: input.active };
    }),

  updateEvent: publicProcedure
    .input(
      z.object({
        event: hookEventTypeSchema,
        patch: eventSoundConfigSchema.partial(),
      })
    )
    .mutation(async ({ input }) => {
      const config = await soundConfigService.updateEvent(input.event, input.patch);
      // Re-sync so enabling/disabling an event immediately adds or removes it
      // from settings.json rather than drifting until the next explicit install.
      await hookWiringService.sync(config);
      return config;
    }),

  /** Bulk save from the editor's "Save changes" bar. */
  saveConfig: publicProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        events: z.record(hookEventTypeSchema, eventSoundConfigSchema),
      })
    )
    .mutation(async ({ input }) => {
      const current = await soundConfigService.read();
      const config = {
        ...current,
        enabled: input.enabled,
        events: { ...current.events, ...input.events },
      };
      await soundConfigService.write(config);
      await hookWiringService.sync(config);
      return config;
    }),

  setGlobalEnabled: publicProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const config = await soundConfigService.setGlobalEnabled(input.enabled);
      await hookWiringService.sync(config);
      return config;
    }),

  resetDefaults: publicProcedure.mutation(async () => {
    const config = await soundConfigService.resetToDefaults();
    await hookWiringService.sync(config);
    return config;
  }),

  /** Preview a sound at the exact volume it will fire at. */
  preview: publicProcedure
    .input(z.object({ soundPath: z.string().min(1), volume: z.number().min(0).max(2).default(1) }))
    .mutation(async ({ input }) => {
      await systemSoundsService.play(input.soundPath, input.volume);
      return { success: true };
    }),

  /** Install the runner and wire it into settings.json. */
  install: publicProcedure
    .input(z.object({ removeLegacy: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const config = await soundConfigService.read();
      await soundConfigService.write(config); // Materialize defaults on first install.
      await hookWiringService.sync(config, { removeLegacy: input.removeLegacy });
      return hookWiringService.status(config);
    }),

  /** Remove Hooky's hooks from settings.json. Leaves hooky.json intact. */
  uninstall: publicProcedure.mutation(async () => {
    await hookWiringService.unwire();
    await runnerService.remove();
    const config = await soundConfigService.read();
    return hookWiringService.status(config);
  }),

  /**
   * Fire the real runner with a synthetic payload for one event.
   *
   * This exercises the actual installed script -- jq parsing, config lookup,
   * afplay, terminal-notifier -- so a passing test means the hook genuinely
   * works, not just that the config looks right.
   */
  testEvent: publicProcedure
    .input(z.object({ event: hookEventTypeSchema }))
    .mutation(async ({ input }) => {
      if (!(await runnerService.isInstalled())) {
        throw new Error("Runner is not installed yet. Click Install first.");
      }

      const payload = JSON.stringify({
        hook_event_name: input.event,
        tool_name: "Edit",
        model: "claude-opus-5",
        tool_input: { file_path: "/example/project/src/index.ts" },
      });

      await new Promise<void>((resolve, reject) => {
        const child = spawn("/bin/bash", [runnerService.scriptPath], {
          stdio: ["pipe", "ignore", "pipe"],
        });

        let stderr = "";
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(stderr.trim() || `Runner exited with code ${code}`))
        );

        child.stdin.end(payload);
      });

      return { success: true };
    }),

  /** Force a rescan of the sound directories. */
  rescan: publicProcedure.mutation(async () => {
    return systemSoundsService.list(true);
  }),
});
