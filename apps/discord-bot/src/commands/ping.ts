import { defineChatInputCommand } from "../utils/command.factory";
import { embedResponse } from "../utils/discordResponses";

export const ping = defineChatInputCommand({
  name: "ping",
  description: "Responds with pong",
  execute(_interaction, c) {
    return c.json(
      embedResponse({
        title: "Pong",
        description: "🏓 Bot is alive and responding.",
        color: 0x22c55e,
      })
    );
  },
});
