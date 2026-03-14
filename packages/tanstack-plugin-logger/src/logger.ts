import { createIsomorphicFn } from "@tanstack/react-start";
import pino from "pino";
import pretty from "pino-pretty";

const isDevelopmentRuntime =
  process.env.ENVIRONMENT === "development" || process.env.NODE_ENV === "development";

const _logger = {
  prod: pino({
    name: "DEF",
  }),
  // Avoid pino transport worker in ESM SSR bundles, use stream mode instead.
  dev: pino(
    pretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      messageFormat: "{msg}",
    })
  ),
};

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerOptions {
  level: LogLevel;
  name?: string;
}

const writeLog = ({ level, name = "DEF" }: LoggerOptions, msg: string, ...args: unknown[]) => {
  const target = isDevelopmentRuntime ? _logger.dev : _logger.prod;

  if (args.length === 0) {
    target[level]({ name }, msg);
    return;
  }

  target[level]({ name, data: args.length === 1 ? args[0] : args }, msg);
};

const logger = createIsomorphicFn().server(writeLog).client(writeLog);

// Usage anywhere in your app
export { logger };
