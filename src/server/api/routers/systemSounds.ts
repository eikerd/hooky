import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { systemSoundsService } from "@/server/services/systemSoundsService";
import { z } from "zod";

export const systemSoundsRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    return await systemSoundsService.listSystemSounds();
  }),

  play: publicProcedure
    .input(z.object({ soundPath: z.string() }))
    .mutation(async ({ input }) => {
      await systemSoundsService.playSystemSound(input.soundPath);
      return { success: true };
    }),
});
