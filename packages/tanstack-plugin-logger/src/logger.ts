import { createIsomorphicFn } from "@tanstack/react-start";
import { Logger } from "tslog";

const isDevelopmentRuntime =
  process.env.ENVIRONMENT === "development" || process.env.NODE_ENV === "development";

const _logger = {
  prod: new Logger<unknown>({
    type: "json",
  }),
  dev: new Logger<unknown>({
    type: "pretty",
    prettyLogTemplate:
      "{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}} {{logLevelName}} {{name}}",
  }),
};

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerOptions {
  level: LogLevel;
  name?: string;
}

const writeLog = ({ level, name = "DEF" }: LoggerOptions, msg: string, ...args: unknown[]) => {
  const target = isDevelopmentRuntime ? _logger.dev : _logger.prod;
  const scopedLogger = name === "DEF" ? target : target.getSubLogger({ name });

  if (args.length === 0) {
    scopedLogger[level](msg);
    return;
  }

  scopedLogger[level](msg, args.length === 1 ? args[0] : { data: args });
};

const logger = createIsomorphicFn().server(writeLog).client(writeLog);

// Usage anywhere in your app
export { logger };
