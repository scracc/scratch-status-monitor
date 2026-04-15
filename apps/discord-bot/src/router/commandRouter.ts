import type { APIApplicationCommandInteraction } from "discord-api-types/v10";
import { commands } from "../commands";
import type { BotContext } from "../types/discord";

export function commandRouter(interaction: APIApplicationCommandInteraction, c: BotContext) {
  const name = interaction.data.name;

  const command = commands.get(name);

  if (!command) {
    return c.json({
      type: 4,
      data: { content: `Command \`${name}\` not found` },
    });
  }

  return command.execute(interaction, c);
}
