import { requestMiddleware } from "@scracc/tanstack-plugin-logger";
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [sentryGlobalRequestMiddleware, requestMiddleware],
    functionMiddleware: [sentryGlobalFunctionMiddleware],
  };
});
