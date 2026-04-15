import { isStringSelectInteraction } from "../types/discord";
import { defineChatInputCommand } from "../utils/command.factory";
import {
  messageResponse,
  messageUpdateResponse,
  selectMenuResponse,
  selectMenuUpdateResponse,
} from "../utils/discordResponses";
import { appendPanelHistoryCode, closePanelWithHistory } from "../utils/panelHistory";
import { tokenPanelOptions, tokenPanelTitle } from "./token";

const controlPanelTitle = "コントロールパネル";
const controlPanelSelectId = "control_action";

const controlHistoryMessages = {
  openToken: "コントロールパネル: トークン管理を開く",
};

export const controlPanel = defineChatInputCommand({
  name: "control-panel",
  description: "コントロールパネルを表示します",
  execute(_interaction, c) {
    return c.json(
      selectMenuResponse({
        content: controlPanelTitle,
        selectId: controlPanelSelectId,
        placeholder: "項目を選択してください",
        options: [
          {
            label: "トークン",
            value: "token",
            description: "トークン管理メニューを表示します",
            emoji: "🔑",
          },
          {
            label: "閉じる",
            value: "close",
            description: "このパネルを閉じる",
            emoji: "❌",
          },
        ],
      })
    );
  },
  componentHandlers: {
    control_action: (interaction, c) => {
      if (!isStringSelectInteraction(interaction)) {
        return c.json(
          messageResponse("Invalid interaction type", {
            flags: 64,
          })
        );
      }

      const selectedValue = interaction.data.values?.[0];

      if (selectedValue === "token") {
        return c.json(
          selectMenuUpdateResponse({
            content: tokenPanelTitle,
            selectId: appendPanelHistoryCode("token_action", "openFromControl"),
            placeholder: "アクションを選択してください",
            options: tokenPanelOptions,
          })
        );
      }

      if (selectedValue === "close") {
        return c.json(
          messageUpdateResponse(
            closePanelWithHistory(
              interaction.data.custom_id,
              "コントロールパネルを閉じました",
              controlHistoryMessages
            ),
            {
              components: [],
            }
          )
        );
      }

      return c.json(
        messageResponse("Unknown action", {
          flags: 64,
        })
      );
    },
  },
});
