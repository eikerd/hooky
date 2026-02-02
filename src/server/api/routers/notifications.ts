import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { scriptGenerator } from "@/server/services/scriptGenerator";
import { configService } from "@/server/services/configService";
import { z } from "zod";
import { notificationConfigSchema } from "@/utils/validation";
import { CONFIG_PATHS } from "@/utils/constants";
import { DEFAULT_NOTIFICATIONS } from "@/types/notifications";

export const notificationsRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    // First try to parse existing script
    const fromScript = await scriptGenerator.parseExistingScript(CONFIG_PATHS.psScript);

    if (fromScript.length > 0) {
      return fromScript;
    }

    // Fall back to defaults
    return DEFAULT_NOTIFICATIONS;
  }),

  update: publicProcedure
    .input(z.array(notificationConfigSchema))
    .mutation(async ({ input }) => {
      await scriptGenerator.writeScripts(input);
      return { success: true };
    }),

  regenerateScript: publicProcedure.mutation(async () => {
    const fromScript = await scriptGenerator.parseExistingScript(CONFIG_PATHS.psScript);
    const notifications = fromScript.length > 0 ? fromScript : DEFAULT_NOTIFICATIONS;

    await scriptGenerator.writeScripts(notifications);
    return { success: true };
  }),

  test: publicProcedure
    .input(z.object({ hookName: z.string() }))
    .mutation(async ({ input }) => {
      // This is a placeholder for testing notifications
      // In a real scenario, this would execute the PowerShell script
      await scriptGenerator.testNotification(input.hookName);
      return { success: true, message: `Tested notification for ${input.hookName}` };
    }),
});
