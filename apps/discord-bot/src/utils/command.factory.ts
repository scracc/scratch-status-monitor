import {
  type APIApplicationCommandInteraction,
  type APIMessageComponentInteraction,
  ApplicationCommandType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { BotContext, DiscordCommand } from "../types/discord";

type CommandHandler = (interaction: APIApplicationCommandInteraction, c: BotContext) => Response;

type ComponentHandler = (interaction: APIMessageComponentInteraction, c: BotContext) => Response;

type DefineChatInputCommandOptions = {
  name: string;
  description: string;
  options?: RESTPostAPIChatInputApplicationCommandsJSONBody["options"];
  execute: CommandHandler;
  componentHandlers?: Record<string, ComponentHandler>;
};

export function defineChatInputCommand(options: DefineChatInputCommandOptions): DiscordCommand {
  return {
    definition: {
      type: ApplicationCommandType.ChatInput,
      name: options.name,
      description: options.description,
      options: options.options,
    },
    execute: options.execute,
    componentHandlers: options.componentHandlers,
  };
}

export function createCommandRegistry(commandList: DiscordCommand[]) {
  const registry = new Map<string, DiscordCommand>();

  for (const command of commandList) {
    const name = command.definition.name;

    if (registry.has(name)) {
      throw new Error(`Duplicate command definition: ${name}`);
    }

    registry.set(name, command);
  }

  return registry;
}

export function createComponentHandlerRegistry(commandList: DiscordCommand[]) {
  const registry = new Map<string, ComponentHandler>();

  for (const command of commandList) {
    if (command.componentHandlers) {
      for (const [customId, handler] of Object.entries(command.componentHandlers)) {
        if (registry.has(customId)) {
          throw new Error(`Duplicate component handler: ${customId}`);
        }

        registry.set(customId, handler);
      }
    }
  }

  return registry;
}
