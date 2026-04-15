import type { DiscordCommand } from "../types/discord";
import { ping } from "./ping";

export const commands = new Map<string, DiscordCommand>([[ping.definition.name, ping]]);
