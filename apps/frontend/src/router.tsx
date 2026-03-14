import { BProgress } from "@bprogress/core";
import { initHeadControllerConfigs } from "@scracc/tanstack-plugin-headcontroller";
import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { NotFoundComponent } from "./routes/$locale/404";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

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
      dsn: "https://9f38c35ec7dc4887f3425eb602d0eb75@o4511041204781056.ingest.us.sentry.io/4511041216643072",

      // Adds request headers and IP for users, for more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
      sendDefaultPii: true,
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
