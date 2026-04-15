import { interactionRouter } from "../router/interactionRouter";
import type { BotContext } from "../types/discord";

export function handleInteraction(c: BotContext) {
  const interaction = c.get("body");

  // Handle PING interactions (type 1)
  if (interaction.type === 1) {
    return c.json({ type: 1 });
  }

  // Route other interactions
  return interactionRouter(interaction, c);
}
