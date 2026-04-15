import { defineChatInputCommand } from "../utils/command.factory";
import { embedResponse } from "../utils/discordResponses";

export const help = defineChatInputCommand({
  name: "help",
  description: "Display help information",
  execute(_interaction, c) {
    const date = new Date().toISOString();
    return c.json(
      embedResponse({
        color: 0x22c55e,
        timestamp: date,
        title: "Help",
        description: "Here are the available commands:",
        fields: [
          {
            name: "/ping",
            value: "Responds with pong",
          },
          {
            name: "\u200B",
            value: "\u200B",
          },
          {
            name: "/help",
            value: "Displays this help message",
            inline: true,
          },
        ],
        footer: {
          text: "v0.0.1",
        },
      })
    );
  },
});
