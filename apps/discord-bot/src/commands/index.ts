import { createCommandRegistry, createComponentHandlerRegistry } from "../utils/command.factory";
import { controlPanel } from "./control-panel";
import { help } from "./help";
import { ping } from "./ping";
import { token } from "./token";

const commandList = [ping, help, token, controlPanel];

export const commands = createCommandRegistry(commandList);
export const componentHandlers = createComponentHandlerRegistry(commandList);
