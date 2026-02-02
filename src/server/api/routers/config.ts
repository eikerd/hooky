import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { configService } from "@/server/services/configService";
import { claudeSettingsSchema } from "@/utils/validation";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const configRouter = createTRPCRouter({
  read: publicProcedure.query(async () => {
    return await configService.readSettings();
  }),

  write: publicProcedure
    .input(claudeSettingsSchema)
    .mutation(async ({ input }) => {
      await configService.writeSettings(input);
      return { success: true };
    }),

  backup: publicProcedure.mutation(async () => {
    const path = await configService.backupSettings();
    return { backupPath: path };
  }),

  export: publicProcedure.query(async () => {
    return await configService.exportSettings();
  }),

  import: publicProcedure
    .input(claudeSettingsSchema)
    .mutation(async ({ input }) => {
      await configService.writeSettings(input);
      return { success: true };
    }),

  openInVSCode: publicProcedure.mutation(async () => {
    try {
      const settingsPath = `${process.env.HOME || "~"}/.claude/settings.json`;
      await execAsync(`code "${settingsPath}"`);
      return { success: true, path: settingsPath };
    } catch (error) {
      throw new Error("Failed to open file in VSCode. Make sure VSCode is installed and in PATH.");
    }
  }),
});
