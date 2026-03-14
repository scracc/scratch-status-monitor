import { BProgress } from "@bprogress/core";
import { initHeadControllerConfigs } from "@scracc/tanstack-plugin-headcontroller";
import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { getEnv } from "./plugins/envrc";
import { NotFoundComponent } from "./routes/$locale/404";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

const env = getEnv();

const headControllerConfig = initHeadControllerConfigs();

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext();

  const router = createRouter({
    routeTree,
    context: {
      ...rqContext,
      ...headControllerConfig,
    },
    scrollRestorationBehavior: "smooth",
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFoundComponent,
  });

  if (!router.isServer) {
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      environment: env.ENVIRONMENT,
      integrations: [Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] })],
      enableLogs: true,
      sendDefaultPii: true,
      tunnel: "/tunnel",
    });
  }

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  });

  router.subscribe("onBeforeLoad", ({ fromLocation, pathChanged }) => {
    // Don't show the progress bar on initial page load, seems like the onLoad event doesn't fire in that case
    fromLocation && pathChanged && BProgress.start();
  });
  router.subscribe("onLoad", () => {
    BProgress.done();
  });

  return router;
};
