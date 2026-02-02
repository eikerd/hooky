import { createTRPCRouter } from "@/server/api/trpc";
import { hooksRouter } from "@/server/api/routers/hooks";
import { notificationsRouter } from "@/server/api/routers/notifications";
import { configRouter } from "@/server/api/routers/config";
import { systemSoundsRouter } from "@/server/api/routers/systemSounds";

export const appRouter = createTRPCRouter({
  hooks: hooksRouter,
  notifications: notificationsRouter,
  config: configRouter,
  systemSounds: systemSoundsRouter,
});

export type AppRouter = typeof appRouter;
