import { createCommandRegistry, createComponentHandlerRegistry } from "../utils/command.factory";
import { help } from "./help";
import { ping } from "./ping";
import { controlPanel } from "./control-panel";
import { token } from "./control-panel/token";

const commandList = [ping, help, controlPanel, token];

export const commands = createCommandRegistry(commandList);
export const componentHandlers = createComponentHandlerRegistry(commandList);
