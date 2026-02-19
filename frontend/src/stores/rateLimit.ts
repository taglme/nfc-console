import { defineStore } from 'pinia';
import type { CreateJobRateLimitResource } from 'nfc-jsclient/dist/models/license';

type CheckResult =
    | { ok: true }
    | {
          ok: false;
          waitMs: number;
          reason: string;
      };

function toInt(v: number | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    if (!Number.isFinite(v)) return null;
    return Math.trunc(v);
}

export const useRateLimitStore = defineStore('rateLimit', {
    state: () => ({
        // Submission timestamps in ms (monotonic enough for UI use)
        submittedAt: [] as number[],
        lastSubmittedAt: 0 as number,
    }),

    actions: {
        reset() {
            this.submittedAt = [];
            this.lastSubmittedAt = 0;
        },

        check(rate: CreateJobRateLimitResource | null | undefined, nowMs = Date.now()): CheckResult {
            const minIntervalMs = toInt(rate?.min_interval_ms);
            const windowMs = toInt(rate?.window_ms);
            const maxInWindow = toInt(rate?.max_in_window);

            if (minIntervalMs !== null && this.lastSubmittedAt > 0) {
                const delta = nowMs - this.lastSubmittedAt;
                if (delta < minIntervalMs) {
                    return {
                        ok: false,
                        waitMs: minIntervalMs - delta,
                        reason: 'min_interval',
                    };
                }
            }

            if (windowMs !== null && maxInWindow !== null && windowMs > 0 && maxInWindow > 0) {
                const cutoff = nowMs - windowMs;
                this.submittedAt = this.submittedAt.filter(t => t > cutoff);

                if (this.submittedAt.length >= maxInWindow) {
                    const oldest = this.submittedAt[0];
                    const waitMs = Math.max(0, oldest + windowMs - nowMs);
                    return {
                        ok: false,
                        waitMs,
                        reason: 'window',
                    };
                }
            }

            return { ok: true };
        },

        record(nowMs = Date.now()) {
            this.lastSubmittedAt = nowMs;
            this.submittedAt.push(nowMs);
        },
    },
});
