import {
  type APIApplicationCommandInteraction,
  type APIInteraction,
  type APIMessageComponentInteraction,
  type APIMessageStringSelectInteractionData,
  ComponentType,
  InteractionType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { Context } from "hono";

export interface CloudflareBindings {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
}

export type DiscordInteraction = APIInteraction;

export interface BotEnv {
  Bindings: CloudflareBindings;
  Variables: {
    body: DiscordInteraction;
  };
}

export type BotContext = Context<BotEnv>;

export interface DiscordCommand {
  definition: RESTPostAPIApplicationCommandsJSONBody;
  execute: (interaction: APIApplicationCommandInteraction, c: BotContext) => Response;
  componentHandlers?: Record<
    string,
    (interaction: APIMessageComponentInteraction, c: BotContext) => Response
  >;
}

export function isCommandInteraction(
  interaction: DiscordInteraction
): interaction is APIApplicationCommandInteraction {
  return interaction.type === InteractionType.ApplicationCommand;
}

export function isComponentInteraction(
  interaction: DiscordInteraction
): interaction is APIMessageComponentInteraction {
  return interaction.type === InteractionType.MessageComponent;
}

export function isStringSelectInteraction(
  interaction: APIMessageComponentInteraction
): interaction is APIMessageComponentInteraction & {
  data: APIMessageStringSelectInteractionData;
} {
  return interaction.data.component_type === ComponentType.StringSelect;
}
