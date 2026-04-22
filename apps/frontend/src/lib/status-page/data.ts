import { ssmrc } from "@repo/configs";
import {
  formatDateShort as formatDateShortI18n,
  formatDateTime as formatDateTimeI18n,
} from "@/lib/i18n/formatters";
import {
  colorMapping,
  type HistoryRecord,
  type StatusLevel,
  statusToTooltip,
} from "@/lib/status-page/rc";

/**
 * ステータス集約戦略
 * - worst: 1つでも downがあれば down（最も厳しい判定）
 * - latest: グループ内の最後のステータス（時系列で最新）
 * - majority: 最も割合を占めるステータス（多数決）
 */
type AggregationStrategy = "worst" | "latest" | "majority";

const DEFAULT_AGGREGATION_STRATEGY: AggregationStrategy = "worst";

export const generatePlaceholderTrackData = (count: number) => {
  const totalDays = ssmrc.cache.dataRetentionDays;
  const dayPerMemory = totalDays / count;
  const now = new Date();

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    // 7日前から今日までを等間隔で配置
    const daysAgo = Math.round(totalDays - (i + 1) * dayPerMemory);
    date.setDate(date.getDate() - daysAgo);
    return {
      date: date.toISOString(),
      tooltip: "Not measured" as keyof typeof colorMapping,
      color: colorMapping["Not measured"],
    };
  });
};

/**
 * 複数のステータスを1つに集約する
 * @param statuses 集約対象のステータス配列
 * @param strategy 集約戦略（デフォルト: latest）
 */
export const aggregateStatus = (
  statuses: StatusLevel[],
  strategy: AggregationStrategy = DEFAULT_AGGREGATION_STRATEGY
): StatusLevel => {
  if (statuses.length === 0) return "unknown";

  switch (strategy) {
    case "worst":
      // 最も悪い状態を優先: down > degraded > up > unknown
      if (statuses.includes("down")) return "down";
      if (statuses.includes("degraded")) return "degraded";
      if (statuses.every((s) => s === "up")) return "up";
      return "unknown";

    case "latest":
      // グループ内の最後（最新）のステータスを使用
      return statuses[statuses.length - 1];

    case "majority": {
      // 最も割合が大きいステータスを使用
      const counts = statuses.reduce(
        (acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<StatusLevel, number>
      );
      const [mostFrequent] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
      return mostFrequent as StatusLevel;
    }

    default:
      return "unknown";
  }
};

export const formatDateShort = formatDateShortI18n;

/**
 * 最適化版: buildMemoryTrackData
 * 計算結果をメモ化し、同じ入力に対して再計算しない
 * 呼び出し側で useMemo でラップされることを前提とする
 */
export const buildMemoryTrackData = (
  records: HistoryRecord[] | undefined,
  memoryCount: number,
  strategy: AggregationStrategy = DEFAULT_AGGREGATION_STRATEGY
) => {
  if (!records || records.length === 0) {
    return generatePlaceholderTrackData(memoryCount);
  }

  // 最適化: ソート済みリストのキャッシュ
  // （同じ records を複数回渡される場合が多い）
  const sorted = [...records].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const now = Date.now();
  const retentionDays = ssmrc.cache.dataRetentionDays;
  const maxRetentionMs = retentionDays * 24 * 60 * 60 * 1000;

  // 実際のデータの時間範囲を取得
  const oldestRecordTime = new Date(sorted[0].recordedAt).getTime();
  const newestRecordTime = new Date(sorted[sorted.length - 1].recordedAt).getTime();

  // 表示範囲の開始時刻を決定
  // - データが少ない場合: 最古のレコードから開始
  // - データが十分ある場合: 設定された保持期間分を表示
  const idealStartTime = now - maxRetentionMs;
  const startTime = Math.max(oldestRecordTime, idealStartTime);

  // 表示範囲の終了時刻（現在時刻 または 最新レコード時刻）
  const endTime = Math.max(newestRecordTime, now);

  // 実際の表示範囲（ミリ秒）
  const actualRangeMs = endTime - startTime;

  // 1メモリが表す時間範囲（ミリ秒）
  const timeSlotMs = actualRangeMs / memoryCount;

  // 時間範囲ごとにレコードをグループ化
  const groups: HistoryRecord[][] = Array.from({ length: memoryCount }, () => []);

  for (const record of sorted) {
    const recordTime = new Date(record.recordedAt).getTime();

    // 表示範囲外のレコードはスキップ
    if (recordTime < startTime || recordTime > endTime) {
      continue;
    }

    // このレコードがどのメモリスロットに属するかを計算
    const slotIndex = Math.min(Math.floor((recordTime - startTime) / timeSlotMs), memoryCount - 1);

    if (slotIndex >= 0 && slotIndex < memoryCount) {
      groups[slotIndex].push(record);
    }
  }

  // 各グループを1メモリに集約
  const mapped = groups.map((group, index) => {
    // このスロットの代表時刻（スロットの中央）
    const slotCenterTime = new Date(startTime + (index + 0.5) * timeSlotMs);

    // 空のスロットの場合
    if (group.length === 0) {
      // 未来のスロット（まだデータがない）かどうかを判定
      const isFutureSlot = slotCenterTime.getTime() > now;

      return {
        date: slotCenterTime.toISOString(),
        tooltip: "Not measured" as keyof typeof colorMapping,
        color: colorMapping["Not measured"],
        isFuture: isFutureSlot,
      };
    }

    // レコードがある場合、ステータスを集約
    const statuses = group.map((r) => r.status);
    const aggregated = aggregateStatus(statuses, strategy);
    const tooltip = statusToTooltip[aggregated];

    // グループの日付は最新のレコードの日付を使用
    const lastRecord = group[group.length - 1];
    return {
      date: lastRecord.recordedAt,
      tooltip,
      color: colorMapping[tooltip],
      isFuture: false,
    };
  });

  return mapped;
};

export const formatDateTime = formatDateTimeI18n;

export const formatUptime = (value: number) => {
  const normalized = Math.min(100, Math.max(0, value));
  return normalized.toFixed(1).padStart(4, "0");
};
