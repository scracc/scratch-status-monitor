import { type APIMessageComponentInteraction, ComponentType } from "discord-api-types/v10";
import { componentHandlers } from "../commands";
import {
  type BotContext,
  type DiscordInteraction,
  isCommandInteraction,
  isComponentInteraction,
} from "../types/discord";
import { getBaseCustomId } from "../utils/panelHistory";
import { commandRouter } from "./commandRouter";

function componentRouter(interaction: APIMessageComponentInteraction, c: BotContext) {
  const customId = interaction.data.custom_id;
  const baseCustomId = getBaseCustomId(customId);

  // String select menu
  if (interaction.data.component_type === ComponentType.StringSelect) {
    const handler = componentHandlers.get(customId) || componentHandlers.get(baseCustomId);

    if (handler) {
      return handler(interaction, c);
    }
  }

  return c.json({
    type: 4,
    data: { content: "Component handler not found" },
  });
}

export function interactionRouter(interaction: DiscordInteraction, c: BotContext) {
  if (isCommandInteraction(interaction)) {
    return commandRouter(interaction, c);
  }

  if (isComponentInteraction(interaction)) {
    return componentRouter(interaction, c);
  }

  return c.json({ type: 4, data: { content: "Unknown interaction" } });
}
