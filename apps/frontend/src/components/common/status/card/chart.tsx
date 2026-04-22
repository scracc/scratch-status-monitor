import { ssmrc } from "@repo/configs";
import type { Locale } from "intlayer";
import { memo, useDeferredValue, useMemo } from "react";
import { useLocale } from "react-intlayer";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  getFullDateTimeFormatter,
  getMonthDayFormatter,
  getTimeFormatter,
} from "@/lib/i18n/formatters";
import { StatusCardChartTooltip } from "../ui/chart-tooltip";
import { ChartSkeleton } from "./chart-skeleton";
import { type TimePeriod, useStatusCardContext } from "./context";

/**
 * 指定した期間に基づいて、フィルタリングの開始時刻を取得
 */
function getStartTimeForPeriod(period: TimePeriod): Date {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "today":
      return todayStart;
    case "yesterday": {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return yesterdayStart;
    }
    case "lastTwoDays": {
      const twoDaysAgo = new Date(todayStart);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      return twoDaysAgo;
    }
    case "all":
    default:
      return new Date(0); // 最初から
  }
}

const chartConfig = {
  responseTime: {
    label: "応答時間",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type ChartPoint = {
  timestamp: number;
  fullDateTime: string;
  responseTime: number;
  xAxisLabel: string;
};

/**
 * 時刻を指定の間隔でフロア処理
 */
function floorToInterval(date: Date, intervalMs: number): Date {
  const time = date.getTime();
  const floored = Math.floor(time / intervalMs) * intervalMs;
  return new Date(floored);
}

/**
 * 日時をフォーマット（フル形式）
 * ロケールとタイムゾーンに対応
 */
const formatFullDateTime = (date: Date, locale: Locale): string => {
  return getFullDateTimeFormatter(locale).format(date);
};

/**
 * X軸用のラベルをフォーマット
 * ロケールとタイムゾーンに対応
 */
const formatXAxisLabel = (date: Date, locale: Locale): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isStartOfDay = hours === 0 && minutes === 0;

  if (isStartOfDay) {
    return getMonthDayFormatter(locale).format(date);
  }

  return getTimeFormatter(locale).format(date);
};

/**
 * チャートレンダリング（内部コンポーネント）
 * useMemo で計算したデータに基づいて描画
 */
const ChartContent = memo(function ChartContent({
  chartData,
  dateChangeTimestamps,
  locale,
}: {
  chartData: ChartPoint[];
  dateChangeTimestamps: number[];
  locale: Locale;
}) {
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-muted-foreground">
        チャートデータがありません
      </div>
    );
  }

  const minTimestamp = Math.min(...chartData.map((d) => d.timestamp));
  const maxTimestamp = Math.max(...chartData.map((d) => d.timestamp));

  return (
    <ChartContainer config={chartConfig} className="w-full h-56">
      <ComposedChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 0, top: 12, bottom: 0 }}
      >
        <CartesianGrid vertical={true} strokeDasharray="3 3" stroke="var(--muted)" />

        {/* 日付が変わる箇所に縦線を表示 */}
        {dateChangeTimestamps.map((timestamp, idx) => (
          <ReferenceLine
            key={`date-change-${idx}`}
            x={timestamp}
            stroke="var(--muted-foreground)"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: getMonthDayFormatter(locale).format(new Date(timestamp)),
              position: "insideTopRight",
              offset: -8,
              fill: "var(--muted-foreground)",
              fontSize: 12,
              fontWeight: 600,
            }}
          />
        ))}

        <XAxis
          dataKey="timestamp"
          type="number"
          domain={[minTimestamp, maxTimestamp]}
          tickFormatter={(timestamp) => {
            const date = new Date(timestamp);
            return getTimeFormatter(locale).format(date);
          }}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="currentColor"
          style={{ fontSize: "0.75rem" }}
          // X軸の目盛りを5個程度表示
          ticks={Array.from(
            { length: 5 },
            (_, i) => minTimestamp + ((maxTimestamp - minTimestamp) * i) / 4
          )}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="currentColor"
          style={{ fontSize: "0.75rem" }}
          label={{
            value: `応答時間 (ms)`,
            angle: -90,
            position: "insideLeft",
          }}
        />
        <ChartTooltip
          cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
          contentStyle={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}
          content={
            <StatusCardChartTooltip
              locale={locale}
              valueFormatter={(value) => {
                if (typeof value === "number") {
                  return `${Math.round(value)}ms`;
                }
                return String(value);
              }}
              nameFormatter={(name) => {
                return chartConfig[name as keyof typeof chartConfig]?.label || name;
              }}
            />
          }
          labelFormatter={(value) => {
            const data = chartData.find((d) => d.timestamp === value);
            return data?.fullDateTime || String(value);
          }}
        />
        <Area dataKey="responseTime" type="monotone" fillOpacity={0.3} isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
});

export function StatusCardChart({ timePeriod = "today" }: { timePeriod?: TimePeriod }) {
  const contextValue = useStatusCardContext();
  const { locale } = useLocale();
  const deferredPeriod = useDeferredValue(timePeriod);
  const isSwitching = deferredPeriod !== timePeriod;

  // チャートデータをメモ化（s.data.row, locale, period が変わる時だけ再計算）
  const { chartData, dateChangeTimestamps } = useMemo(() => {
    if (!contextValue) {
      return { chartData: [], dateChangeTimestamps: [] };
    }

    const { data: s } = contextValue;
    const period = deferredPeriod;
    if (!s?.row || s.row.length === 0) {
      return { chartData: [], dateChangeTimestamps: [] };
    }

    // 期間に基づいてフィルタリング
    const startTime = getStartTimeForPeriod(period);
    const filteredRecords = s.row.filter((record) => {
      const recordedAtDate = new Date(record.recordedAt);
      return recordedAtDate >= startTime;
    });

    if (filteredRecords.length === 0) {
      return { chartData: [], dateChangeTimestamps: [] };
    }

    // bucketIntervalMs 単位で集約して重複や順序の問題を解消
    const bucketMap = new Map<
      number,
      {
        sum: number;
        count: number;
        latestTimestamp: number;
      }
    >();

    for (const record of filteredRecords) {
      const recordedAtDate = new Date(record.recordedAt);
      const bucketedAtDate = record.bucketedAt
        ? new Date(record.bucketedAt)
        : floorToInterval(recordedAtDate, ssmrc.cache.bucketIntervalMs);
      const bucketTimestamp = bucketedAtDate.getTime();
      const recordTimestamp = recordedAtDate.getTime();

      const existing = bucketMap.get(bucketTimestamp);
      if (existing) {
        existing.sum += record.responseTime;
        existing.count += 1;
        if (recordTimestamp > existing.latestTimestamp) {
          existing.latestTimestamp = recordTimestamp;
        }
      } else {
        bucketMap.set(bucketTimestamp, {
          sum: record.responseTime,
          count: 1,
          latestTimestamp: recordTimestamp,
        });
      }
    }

    const data = Array.from(bucketMap.entries())
      .map(([bucketTimestamp, bucket]) => {
        const bucketDate = new Date(bucketTimestamp);
        const latestDate = new Date(bucket.latestTimestamp);

        return {
          // ツールチップ用フル日時（バケット内の最新レコード）
          fullDateTime: formatFullDateTime(latestDate, locale),
          // 時間軸（数値）- X軸のdataKeyとして使用
          timestamp: bucketTimestamp,
          // 応答時間（平均）
          responseTime: Math.round(bucket.sum / bucket.count),
          // X軸用ラベル（時間軸での表示）
          xAxisLabel: formatXAxisLabel(bucketDate, locale),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // 日付が変わる箇所を検出
    const dateChanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevDate = new Date(data[i - 1].timestamp);
      const currDate = new Date(data[i].timestamp);

      if (
        prevDate.getFullYear() !== currDate.getFullYear() ||
        prevDate.getMonth() !== currDate.getMonth() ||
        prevDate.getDate() !== currDate.getDate()
      ) {
        dateChanges.push(data[i].timestamp);
      }
    }

    return {
      chartData: data,
      dateChangeTimestamps: dateChanges,
    };
  }, [contextValue, deferredPeriod, locale]);

  // チャート描画部をメモ化されたコンポーネントに分離
  if (isSwitching) {
    return <ChartSkeleton />;
  }

  return chartData.length === 0 ? (
    <ChartSkeleton />
  ) : (
    <ChartContent
      chartData={chartData}
      dateChangeTimestamps={dateChangeTimestamps}
      locale={locale}
    />
  );
}
