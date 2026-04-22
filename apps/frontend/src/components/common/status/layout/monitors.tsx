import { ssmrc } from "@repo/configs";
import { memo, useContext, useMemo } from "react";
import { buildMemoryTrackData } from "@/lib/status-page/data";
import type { HistoryResponse } from "@/lib/status-page/rc";
import { statusToTooltip } from "@/lib/status-page/rc";
import { StatusCard } from "../card";
import { StatusCardProvider } from "../card/context";
import { StatusPageDataContext } from "./context";

/**
 * MonitorCard: 個別モニターカードをメモ化
 * 親の再レンダリングに影響されない
 */

const MonitorCard = memo(function MonitorCard({
  monitor,
  history,
}: {
  monitor: (typeof ssmrc.monitors)[0];
  history?: HistoryResponse;
}) {
  const monitorRecords = history?.records;
  const recordList = monitorRecords ?? [];

  // データフォーマッターを一度だけ実行
  const trackData = useMemo(() => {
    if (recordList.length === 0) return null;
    return {
      desktop: buildMemoryTrackData(recordList, 90),
      tablet: buildMemoryTrackData(recordList, 60),
      mobile: buildMemoryTrackData(recordList, 30),
    };
  }, [recordList]);

  const latestRecord = recordList[recordList.length - 1];
  const monitorTooltip = latestRecord
    ? statusToTooltip[latestRecord.status as keyof typeof statusToTooltip]
    : undefined;

  const monitorWithLabel = {
    ...(latestRecord ?? {}),
    label: history?.label ?? monitor.label,
  };

  return (
    <StatusCardProvider
      value={{
        monitor: monitorWithLabel,
        uptimePercent: history?.stats.uptime,
        data: trackData
          ? {
              row: recordList,
              desktop: trackData.desktop,
              tablet: trackData.tablet,
              mobile: trackData.mobile,
            }
          : undefined,
      }}
    >
      <StatusCard monitorTooltip={monitorTooltip ?? "Not measured"} />
    </StatusCardProvider>
  );
});

export function Monitors() {
  const s = useContext(StatusPageDataContext);
  const { histories = [] } = s || {};

  // 静的な設定からモニターマップを作成
  const historiesMap = useMemo(() => {
    return new Map(histories.map((h) => [h.monitorId, h]));
  }, [histories]);

  // 全モニターをレンダリング（データがない場合でもカード構造は表示）
  const monitorCards = useMemo(() => {
    return ssmrc.monitors.map((monitor) => {
      const history = historiesMap.get(monitor.id);
      return <MonitorCard key={monitor.id} monitor={monitor} history={history} />;
    });
  }, [historiesMap]);

  return (
    <div className="relative w-full rounded-lg border p-6 text-left shadow-sm bg-card mt-10 space-y-6">
      {monitorCards}
    </div>
  );
}
