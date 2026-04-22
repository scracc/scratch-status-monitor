import {
  StatusCheckResult,
  type StatusLevel as StatusLevelType,
  type ssmrcSchema,
} from "@repo/types";
import type z from "zod";
import { BACKEND_DEFAULTS } from "../config/defaults";

interface CheckOptions {
  timeout?: number;
}

/**
 * ステータスコードから状態を判定
 */
function determineStatusFromCode(statusCode: number): StatusLevelType {
  if (statusCode >= 200 && statusCode < 300) {
    return "up";
  }
  if (statusCode >= 300 && statusCode < 400) {
    return "up";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "degraded";
  }
  if (statusCode >= 500) {
    return "down";
  }
  return "down";
}

// レスポンス Body の length をチェックする場合の実装例
async function checkLength(
  res: Response,
  opts: { min?: number | undefined; max?: number | undefined } = {
    min: 0,
  }
): Promise<{
  status: StatusLevelType;
  message?: string;
}> {
  try {
    const text = await res.text();
    console.log(`Response body length: ${text.length}`);
    const length = text.length;
    console.log(`Checking length: ${length} (min: ${opts.min}, max: ${opts.max})`);
    if (opts.max !== undefined && length > opts.max) {
      return { status: "down", message: `Response body too long: ${length} > ${opts.max}` };
    }
    if (opts.min !== undefined && length < opts.min) {
      return { status: "degraded", message: `Response body too short: ${length} < ${opts.min}` };
    }
    return { status: "up" };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 単一のエンドポイントをチェック
 */
export async function checkMonitorStatus(
  id: string,
  url: string,
  check: z.infer<typeof ssmrcSchema.e.monitors.e.e.check> | undefined,
  options: CheckOptions = {}
): Promise<StatusCheckResult> {
  const timeout = options.timeout || BACKEND_DEFAULTS.TIMEOUT_MS;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const runFetch = async (opts: RequestInit) => {
      const res = await fetch(url, {
        signal: controller.signal,
        ...opts,
      });
      clearTimeout(timeoutId);
      const time = Date.now() - startTime;
      return { res, time };
    };

    let result: { res: Response; time: number };
    let status: StatusLevelType;

    switch (check?.type) {
      case "length": {
        result = await runFetch({ method: "GET" });
        status = (await checkLength(result.res, check?.expect)).status;
        break;
      }
      default: {
        result = await runFetch({ method: "HEAD" });
        status = determineStatusFromCode(result.res.status);
        break;
      }
    }

    return StatusCheckResult.parse({
      id,
      status,
      statusCode: result.res.status,
      responseTime: result.time,
      checkedAt: new Date(),
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // タイムアウトの場合
    if (error instanceof Error && error.name === "AbortError") {
      return StatusCheckResult.parse({
        id,
        status: "down" as const,
        responseTime,
        errorMessage: `Timeout after ${timeout}ms`,
        checkedAt: new Date(),
      });
    }

    return StatusCheckResult.parse({
      id,
      status: "down" as const,
      responseTime,
      errorMessage,
      checkedAt: new Date(),
    });
  }
}

/**
 * 複数のエンドポイントを並行チェック
 */
export async function checkMultipleMonitors(
  monitors: Array<{
    id: string;
    url: string;
    check?: z.infer<typeof ssmrcSchema.e.monitors.e.e.check>;
  }>,
  options: CheckOptions = {}
): Promise<StatusCheckResult[]> {
  const promises = monitors.map((monitor) =>
    checkMonitorStatus(monitor.id, monitor.url, monitor.check, options)
  );

  return Promise.all(promises);
}
