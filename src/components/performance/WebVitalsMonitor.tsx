"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

import {
    createEmptyFirstScreenSnapshot,
    formatMetricDuration,
    isFirstScreenMetricName,
    isWebVitalsDebugEnabled,
    updateFirstScreenSnapshot,
    WEB_VITALS_EVENT_NAME,
    type FirstScreenSnapshot,
} from "@/lib/webVitals";

const INITIAL_SNAPSHOT = createEmptyFirstScreenSnapshot();

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const MetricRow = ({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) => (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={emphasize ? "font-semibold text-foreground" : "font-medium text-foreground/90"}>{value}</span>
    </div>
);

export const WebVitalsMonitor = () => {
    const searchParams = useSearchParams();
    const [snapshot, setSnapshot] = useState<FirstScreenSnapshot>(INITIAL_SNAPSHOT);
    const debugEnabled = isWebVitalsDebugEnabled(searchParams.toString(), process.env.NODE_ENV ?? "development");

    useEffect(() => {
        window.__AINOTE_WEB_VITALS__ = INITIAL_SNAPSHOT;
    }, []);

    const handleMetric = useCallback<ReportWebVitalsCallback>((metric) => {
        if (!isFirstScreenMetricName(metric.name)) {
            return;
        }

        setSnapshot((currentSnapshot) => {
            const nextSnapshot = updateFirstScreenSnapshot(currentSnapshot, metric.name, metric.value);
            window.__AINOTE_WEB_VITALS__ = nextSnapshot;
            window.dispatchEvent(new CustomEvent(WEB_VITALS_EVENT_NAME, { detail: nextSnapshot }));
            return nextSnapshot;
        });
    }, []);

    useReportWebVitals(handleMetric);

    if (!debugEnabled) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-border/60 bg-background/95 p-3 text-xs shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold text-foreground">Web Vitals</div>
                    <div className="text-[11px] text-muted-foreground">首屏参考值优先使用 LCP，未就绪时回退到 FCP。</div>
                </div>
                <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-600">
                    首屏观测
                </span>
            </div>

            <div className="mt-3 space-y-2">
                <MetricRow label="FCP" value={formatMetricDuration(snapshot.fcp)} />
                <MetricRow label="LCP" value={formatMetricDuration(snapshot.lcp)} />
                <MetricRow label="First Screen" value={formatMetricDuration(snapshot.firstScreenTime)} emphasize />
            </div>

            <div className="mt-3 text-[11px] leading-5 text-muted-foreground">
                生产环境加上 <code className="rounded bg-muted px-1 py-0.5 text-[10px]">?vitals=1</code> 也能显示这块面板。
            </div>
        </div>
    );
};
