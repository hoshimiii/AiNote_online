export const WEB_VITALS_EVENT_NAME = "ainote:web-vitals" as const;
export const WEB_VITALS_DEBUG_QUERY_PARAM = "vitals" as const;

export const FIRST_SCREEN_METRIC_NAMES = ["FCP", "LCP"] as const;

export type FirstScreenMetricName = (typeof FIRST_SCREEN_METRIC_NAMES)[number];

export interface FirstScreenSnapshot {
    fcp: number | null;
    lcp: number | null;
    firstScreenTime: number | null;
    lastUpdatedMetric: FirstScreenMetricName | null;
    updatedAt: string | null;
}

export const createEmptyFirstScreenSnapshot = (): FirstScreenSnapshot => ({
    fcp: null,
    lcp: null,
    firstScreenTime: null,
    lastUpdatedMetric: null,
    updatedAt: null,
});

export const isFirstScreenMetricName = (name: string): name is FirstScreenMetricName => (
    name === "FCP" || name === "LCP"
);

export const deriveFirstScreenTime = ({
    fcp,
    lcp,
}: Pick<FirstScreenSnapshot, "fcp" | "lcp">): number | null => lcp ?? fcp ?? null;

export const updateFirstScreenSnapshot = (
    snapshot: FirstScreenSnapshot,
    metricName: FirstScreenMetricName,
    metricValue: number,
    updatedAt = new Date().toISOString(),
): FirstScreenSnapshot => {
    const nextSnapshot: FirstScreenSnapshot = {
        ...snapshot,
        updatedAt,
        lastUpdatedMetric: metricName,
        firstScreenTime: snapshot.firstScreenTime,
    };

    if (metricName === "FCP") {
        nextSnapshot.fcp = metricValue;
    } else {
        nextSnapshot.lcp = metricValue;
    }

    nextSnapshot.firstScreenTime = deriveFirstScreenTime(nextSnapshot);

    return nextSnapshot;
};

export const formatMetricDuration = (value: number | null): string => {
    if (value == null) {
        return "--";
    }

    if (value < 1000) {
        return `${Math.round(value)} ms`;
    }

    return `${(value / 1000).toFixed(2)} s`;
};

export const isWebVitalsDebugEnabled = (search: string, nodeEnv: string): boolean => {
    const normalizedSearch = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(normalizedSearch);
    const queryValue = params.get(WEB_VITALS_DEBUG_QUERY_PARAM)?.toLowerCase();

    if (queryValue === "1" || queryValue === "true") {
        return true;
    }

    if (queryValue === "0" || queryValue === "false") {
        return false;
    }

    return nodeEnv !== "production";
};

declare global {
    interface Window {
        __AINOTE_WEB_VITALS__?: FirstScreenSnapshot;
    }

    interface WindowEventMap {
        "ainote:web-vitals": CustomEvent<FirstScreenSnapshot>;
    }
}
