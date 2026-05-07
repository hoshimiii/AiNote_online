import { describe, expect, it } from "vitest";

import {
    createEmptyFirstScreenSnapshot,
    deriveFirstScreenTime,
    FIRST_SCREEN_METRIC_NAMES,
    formatMetricDuration,
    isFirstScreenMetricName,
    isWebVitalsDebugEnabled,
    updateFirstScreenSnapshot,
} from "@/lib/webVitals";

describe("webVitals helpers", () => {
    it("prefers LCP over FCP when deriving first-screen time", () => {
        expect(deriveFirstScreenTime({ fcp: 980, lcp: 1680 })).toBe(1680);
        expect(deriveFirstScreenTime({ fcp: 980, lcp: null })).toBe(980);
        expect(deriveFirstScreenTime({ fcp: null, lcp: null })).toBeNull();
    });

    it("updates the first-screen snapshot with the latest metric", () => {
        const empty = createEmptyFirstScreenSnapshot();
        const afterFcp = updateFirstScreenSnapshot(empty, "FCP", 912, "2026-05-07T10:00:00.000Z");
        const afterLcp = updateFirstScreenSnapshot(afterFcp, "LCP", 1824, "2026-05-07T10:00:01.000Z");

        expect(afterFcp).toMatchObject({
            fcp: 912,
            lcp: null,
            firstScreenTime: 912,
            lastUpdatedMetric: "FCP",
            updatedAt: "2026-05-07T10:00:00.000Z",
        });

        expect(afterLcp).toMatchObject({
            fcp: 912,
            lcp: 1824,
            firstScreenTime: 1824,
            lastUpdatedMetric: "LCP",
            updatedAt: "2026-05-07T10:00:01.000Z",
        });
    });

    it("formats metric durations for human-friendly display", () => {
        expect(formatMetricDuration(null)).toBe("--");
        expect(formatMetricDuration(426)).toBe("426 ms");
        expect(formatMetricDuration(2450)).toBe("2.45 s");
    });

    it("enables the debug surface in development and via explicit query opt-in", () => {
        expect(isWebVitalsDebugEnabled("", "development")).toBe(true);
        expect(isWebVitalsDebugEnabled("", "production")).toBe(false);
        expect(isWebVitalsDebugEnabled("?vitals=1", "production")).toBe(true);
        expect(isWebVitalsDebugEnabled("?foo=bar&vitals=true", "production")).toBe(true);
        expect(isWebVitalsDebugEnabled("?vitals=0", "development")).toBe(false);
        expect(isWebVitalsDebugEnabled("?vitals=false", "development")).toBe(false);
    });

    it("recognizes first-screen metric names", () => {
        expect(FIRST_SCREEN_METRIC_NAMES).toEqual(["FCP", "LCP"]);
        expect(isFirstScreenMetricName("FCP")).toBe(true);
        expect(isFirstScreenMetricName("LCP")).toBe(true);
        expect(isFirstScreenMetricName("CLS")).toBe(false);
    });
});
