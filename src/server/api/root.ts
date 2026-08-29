import { createTRPCRouter } from "@/server/api/trpc";
import { configRouter } from "@/server/api/routers/config";
import { soundsRouter } from "@/server/api/routers/sounds";
import { projectsRouter } from "@/server/api/routers/projects";

export const appRouter = createTRPCRouter({
  config: configRouter,
  sounds: soundsRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
