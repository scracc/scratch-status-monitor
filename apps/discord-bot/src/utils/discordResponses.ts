import {
  type APIEmbed,
  type APIInteractionResponse,
  type APIInteractionResponseCallbackData,
  type APIModalInteractionResponseCallbackData,
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
