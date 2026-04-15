import { isStringSelectInteraction } from "../types/discord";
import { defineChatInputCommand } from "../utils/command.factory";
import {
  messageResponse,
  messageUpdateResponse,
  selectMenuResponse,
  selectMenuUpdateResponse,
} from "../utils/discordResponses";
import { appendPanelHistoryCode, closePanelWithHistory } from "../utils/panelHistory";

export const tokenPanelTitle = "トークンの管理を行います";
const tokenPanelSelectId = "token_action";

const tokenHistoryMessages = {
  details: "トークン詳細を表示",
  settings: "トークン設定を表示",
  view: "トークンを表示",
  regenerate: "トークンを再生成",
  delete: "トークンを削除",
  openFromControl: "コントロールパネルからトークン管理を開く",
};

const tokenHistoryCodeMap: Record<string, string> = {
  details: "details",
  settings: "settings",
  view: "view",
  regenerate: "regenerate",
  delete: "delete",
};

export const tokenPanelOptions = [
  {
    label: "詳細",
    value: "details",
    description: "トークンの詳細情報を表示する",
  },
  {
    label: "設定",
    value: "settings",
    description: "トークンの設定を開く",
    emoji: "👁️",
  },
  {
    label: "表示",
    value: "view",
    description: "トークンを表示する",
    emoji: "👁️",
  },
  {
    label: "再生成",
    value: "regenerate",
    description: "新しいトークンを生成する",
    emoji: "🔄",
  },
  {
    label: "削除",
    value: "delete",
    description: "トークンを削除する",
    emoji: "🗑️",
  },
  {
    label: "閉じる",
    value: "close",
    description: "このメニューを閉じる",
    emoji: "❌",
  },
];

export const token = defineChatInputCommand({
  name: "token",
  description: "トークン管理メニューを表示します",
  execute(_interaction, c) {
    return c.json(
      selectMenuResponse({
        content: tokenPanelTitle,
        selectId: tokenPanelSelectId,
        placeholder: "アクションを選択してください",
        options: tokenPanelOptions,
      })
    );
  },
  componentHandlers: {
    token_action: (interaction, c) => {
      if (!isStringSelectInteraction(interaction)) {
        return c.json(
          messageResponse("Invalid interaction type", {
            flags: 64,
          })
        );
      }

      const selectedValue = interaction.data.values?.[0];
      const historyCode = tokenHistoryCodeMap[selectedValue || ""];

      if (selectedValue === "close") {
        return c.json(
          messageUpdateResponse(
            closePanelWithHistory(
              interaction.data.custom_id,
              "トークンパネルを閉じました",
              tokenHistoryMessages
            ),
            {
              components: [],
            }
          )
        );
      }

      if (!historyCode) {
        return c.json(
          messageResponse("Unknown action", {
            flags: 64,
          })
        );
      }

      return c.json(
        selectMenuUpdateResponse({
          content: tokenPanelTitle,
          selectId: appendPanelHistoryCode(interaction.data.custom_id, historyCode),
          placeholder: "アクションを選択してください",
          options: tokenPanelOptions,
        })
      );
    },
  },
});
