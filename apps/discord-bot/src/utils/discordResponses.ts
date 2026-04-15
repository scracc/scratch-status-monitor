import {
  type APIEmbed,
  type APIInteractionResponse,
  type APIInteractionResponseCallbackData,
  type APIModalInteractionResponseCallbackData,
  type APIStringSelectComponent,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
} from "discord-api-types/v10";

export function messageResponse(
  content: string,
  options?: Omit<APIInteractionResponseCallbackData, "content">
): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      ...options,
      content,
    },
  };
}

export function messageUpdateResponse(
  content: string,
  options?: Omit<APIInteractionResponseCallbackData, "content">
): APIInteractionResponse {
  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      ...options,
      content,
    },
  };
}

export function embedResponse(
  embed: APIEmbed,
  options?: Omit<APIInteractionResponseCallbackData, "embeds">
): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      ...options,
      embeds: [embed],
    },
  };
}

export function modalResponse(
  data: APIModalInteractionResponseCallbackData
): APIInteractionResponse {
  return {
    type: InteractionResponseType.Modal,
    data,
  };
}

export function simpleTextInputModal(
  customId: string,
  title: string,
  inputCustomId: string,
  inputLabel: string,
  required = true
): APIModalInteractionResponseCallbackData {
  return {
    custom_id: customId,
    title,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.TextInput,
            custom_id: inputCustomId,
            label: inputLabel,
            style: TextInputStyle.Paragraph,
            required,
          },
        ],
      },
    ],
  };
}

export type SelectMenuOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
};

type SelectMenuResponseOptions = {
  content?: string;
  selectId: string;
  placeholder?: string;
  options: SelectMenuOption[];
  minValues?: number;
  maxValues?: number;
};

function createSelectMenuData(
  options: SelectMenuResponseOptions
): APIInteractionResponseCallbackData {
  const selectComponent: APIStringSelectComponent = {
    type: ComponentType.StringSelect,
    custom_id: options.selectId,
    placeholder: options.placeholder,
    min_values: options.minValues ?? 1,
    max_values: options.maxValues ?? 1,
    options: options.options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      description: opt.description,
      emoji: opt.emoji ? { name: opt.emoji } : undefined,
      default: opt.default,
    })),
  };

  return {
    content: options.content || " ",
    components: [
      {
        type: ComponentType.ActionRow,
        components: [selectComponent],
      },
    ],
  };
}

export function selectMenuResponse(options: SelectMenuResponseOptions): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: createSelectMenuData(options),
  };
}

export function selectMenuUpdateResponse(
  options: SelectMenuResponseOptions
): APIInteractionResponse {
  return {
    type: InteractionResponseType.UpdateMessage,
    data: createSelectMenuData(options),
  };
}
