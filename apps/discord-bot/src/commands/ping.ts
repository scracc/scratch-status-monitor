import {
  type APIApplicationCommandInteraction,
  ApplicationCommandType,
} from "discord-api-types/v10";
import type { BotContext, DiscordCommand } from "../types/discord";
import { embedResponse } from "../utils/discordResponses";

export const ping = {
  definition: {
    type: ApplicationCommandType.ChatInput,
    name: "ping",
    description: "Responds with pong",
  },

  execute(_interaction: APIApplicationCommandInteraction, c: BotContext) {
    return c.json(
      embedResponse({
        title: "Pong",
        description: "🏓 Bot is alive and responding.",
        color: 0x22c55e,
      })
    );
  },
} satisfies DiscordCommand;
