const HISTORY_HEADER = "操作履歴:";
const STATE_SEPARATOR = "::";
const HISTORY_SEPARATOR = ".";
const CUSTOM_ID_MAX_LENGTH = 100;

export function getBaseCustomId(customId: string) {
  return customId.split(STATE_SEPARATOR)[0] || customId;
}

function parseCustomIdState(customId: string) {
  const [baseId, serializedHistory] = customId.split(STATE_SEPARATOR);
  const historyCodes = serializedHistory
    ? serializedHistory.split(HISTORY_SEPARATOR).filter((value) => value.length > 0)
    : [];

  return {
    baseId: baseId || customId,
    historyCodes,
  };
}

function serializeCustomIdState(baseId: string, historyCodes: string[]) {
  if (historyCodes.length === 0) {
    return baseId;
  }

  const serialized = `${baseId}${STATE_SEPARATOR}${historyCodes.join(HISTORY_SEPARATOR)}`;

  if (serialized.length <= CUSTOM_ID_MAX_LENGTH) {
    return serialized;
  }

  const trimmedHistory = [...historyCodes];

  while (trimmedHistory.length > 0) {
    trimmedHistory.shift();
    const candidate = `${baseId}${STATE_SEPARATOR}${trimmedHistory.join(HISTORY_SEPARATOR)}`;

    if (candidate.length <= CUSTOM_ID_MAX_LENGTH) {
      return candidate;
    }
  }

  return baseId;
}

export function appendPanelHistoryCode(customId: string, historyCode: string) {
  const { baseId, historyCodes } = parseCustomIdState(customId);
  return serializeCustomIdState(baseId, [...historyCodes, historyCode]);
}

export function closePanelWithHistory(
  customId: string,
  closedTitle: string,
  historyMessages: Record<string, string>
) {
  const { historyCodes } = parseCustomIdState(customId);
  const historyLines = historyCodes
    .map((code) => historyMessages[code])
    .filter((message): message is string => Boolean(message))
    .map((message) => `- ${message}`);

  const normalizedHistory = historyLines.length > 0 ? historyLines : ["- 操作履歴はありません"];

  return `${closedTitle}\n\n${HISTORY_HEADER}\n${normalizedHistory.join("\n")}`;
}
