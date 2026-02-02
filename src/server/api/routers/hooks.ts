import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { configService } from "@/server/services/configService";
import { z } from "zod";
import { hookEventTypeSchema } from "@/utils/validation";
import { ClaudeSettings, HOOK_EVENTS, HookEventType } from "@/types/hooks";
import { HOOK_EVENTS_ORDERED } from "@/utils/constants";

export const hooksRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    const settings = await configService.readSettings();
    const hooks = settings.hooks || {};

    return HOOK_EVENTS_ORDERED.map((eventType) => ({
      eventType,
      description: HOOK_EVENTS[eventType],
      enabled: !!hooks[eventType],
      handlerCount: hooks[eventType]?.reduce((sum, group) => sum + (group.hooks?.length || 0), 0) || 0,
    }));
  }),

  get: publicProcedure
    .input(z.object({ eventType: hookEventTypeSchema }))
    .query(async ({ input }) => {
      const settings = await configService.readSettings();
      const hooks = settings.hooks || {};
      return {
        eventType: input.eventType,
        groups: hooks[input.eventType] || [],
      };
    }),

  update: publicProcedure
    .input(
      z.object({
        eventType: hookEventTypeSchema,
        groups: z.array(
          z.object({
            matcher: z.string().optional(),
            hooks: z.array(
              z.object({
                type: z.enum(["command", "prompt", "agent"]),
                command: z.string().optional(),
                prompt: z.string().optional(),
                matcher: z.string().optional(),
                async: z.boolean().optional(),
                timeout: z.number().int().positive().optional(),
                statusMessage: z.string().optional(),
                once: z.boolean().optional(),
              })
            ),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const settings = await configService.readSettings();
      const hooks = settings.hooks || {};

      hooks[input.eventType] = input.groups;

      await configService.writeSettings({
        ...settings,
        hooks,
      });

      return { success: true };
    }),

  toggle: publicProcedure
    .input(z.object({ eventType: hookEventTypeSchema, enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const settings = await configService.readSettings();
      const hooks = settings.hooks || {};

      if (input.enabled) {
        // Enable: ensure the hook exists
        if (!hooks[input.eventType]) {
          hooks[input.eventType] = [{ hooks: [] }];
        }
      } else {
        // Disable: remove the hook
        delete hooks[input.eventType];
      }

      await configService.writeSettings({
        ...settings,
        hooks,
      });

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ eventType: hookEventTypeSchema }))
    .mutation(async ({ input }) => {
      const settings = await configService.readSettings();
      const hooks = settings.hooks || {};

      delete hooks[input.eventType];

      await configService.writeSettings({
        ...settings,
        hooks,
      });

      return { success: true };
    }),
});
