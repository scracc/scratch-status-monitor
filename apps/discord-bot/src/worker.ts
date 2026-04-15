import { Hono } from "hono";
import { handleInteraction } from "./discord/interaction";
import { verifyDiscordRequest } from "./discord/verify";
import type { BotEnv } from "./types/discord";

const app = new Hono<BotEnv>();

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "Discord Bot worker is running",
  });
});

// Discord interaction endpoint
app.post("/interaction", verifyDiscordRequest, handleInteraction);

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      type: 4,
      data: { content: "An error occurred while processing your command" },
    },
    500
  );
});

export default app;
