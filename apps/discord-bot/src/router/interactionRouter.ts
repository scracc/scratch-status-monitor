import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  type BotContext,
  type DiscordInteraction,
  isCommandInteraction,
  isComponentInteraction,
} from "../types/discord";
import { commandRouter } from "./commandRouter";

// Component interactions (buttons, selects) - not yet implemented
function componentRouter(_interaction: APIMessageComponentInteraction, c: BotContext) {
  return c.json({
    type: 4,
    data: { content: "Component interactions not yet implemented" },
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
