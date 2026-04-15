import { verifyKey } from "discord-interactions";
import type { MiddlewareHandler } from "hono";
import type { BotEnv, DiscordInteraction } from "../types/discord";

export const verifyDiscordRequest: MiddlewareHandler<BotEnv> = async (c, next) => {
  const signature = c.req.header("X-Signature-Ed25519");
  const timestamp = c.req.header("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    console.error("Missing signature or timestamp headers");
    return c.text("invalid request", 401);
  }

  const body = await c.req.text();
  const isValid = await verifyKey(body, signature, timestamp, c.env.DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return c.text("invalid request", 401);
  }

  let parsedBody: DiscordInteraction;
  try {
    parsedBody = JSON.parse(body) as DiscordInteraction;
  } catch {
    return c.text("invalid request body", 400);
  }

  c.set("body", parsedBody);

  return await next();
};
