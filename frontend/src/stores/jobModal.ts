import { defineStore } from 'pinia';
import { EventName } from 'nfc-jsclient/dist/models/events';
import type { Event } from 'nfc-jsclient/dist/client/events';
import { JobRun } from 'nfc-jsclient/dist/client/runs';
import { CommandStatus } from 'nfc-jsclient/dist/models/commands';

import { getSdk } from '../services/sdk';
import { useLicenseStore } from './license';

export type JobModalStatus = 'pending' | 'activated' | 'finished' | 'error' | 'deleted';

function hasScope(scopes: string[] | null | undefined, required: string): boolean {
    const req = String(required ?? '').trim().toLowerCase();
    if (!req) return false;
    for (const raw of scopes ?? []) {
        const s = String(raw ?? '').trim().toLowerCase();
        if (!s) continue;
        if (s === req || s === '*') return true;
        if (s.endsWith(':*')) {
            const prefix = s.slice(0, -1);
            if (req.startsWith(prefix)) return true;
        }
    }
    return false;
}

export const useJobModalStore = defineStore('jobModal', {
    state: () => ({
        open: false,
        adapterId: '' as string,
        jobId: '' as string,
        jobName: '' as string,

        status: 'pending' as JobModalStatus,
        errorMessage: '' as string,

        counters: {
            total_runs: 0,
            success_runs: 0,
            error_runs: 0,
            repeat: 0,
        },

        timeoutMs: 2000,
        timeoutHandle: 0 as any,
        loadingCounters: false,
    }),

    actions: {
        openForJob(params: { adapterId: string; jobId: string; jobName: string }) {
            this.open = true;
            this.adapterId = params.adapterId;
            this.jobId = params.jobId;
            this.jobName = params.jobName;

            this.status = 'pending';
            this.errorMessage = '';
            this.counters = { total_runs: 0, success_runs: 0, error_runs: 0, repeat: 0 };

            this.clearTimeout();
            void this.refreshCounters();
        },

        async close(reason?: 'user' | 'auto') {
            this.clearTimeout();

            const shouldDelete = this.open && (this.status === 'pending' || this.status === 'activated');
            const adapterId = this.adapterId;
            const jobId = this.jobId;

            this.open = false;

            // Match original app behavior: if the user closes while pending/activated,
            // try to delete the job to avoid leaving it running.
            if (reason === 'user' && shouldDelete && adapterId && jobId) {
                const license = useLicenseStore();
                if (hasScope(license.allowedScopes, 'job:delete')) {
                    try {
                        const sdk = getSdk();
                        await sdk.Jobs.delete(adapterId, jobId);
                    } catch {
                        // ignore
                    }
                }
            }
        },

        clearTimeout() {
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
                this.timeoutHandle = 0;
            }
        },

        returnToPendingLater() {
            this.clearTimeout();
            this.timeoutHandle = setTimeout(() => {
                if (!this.open) return;
                this.status = 'pending';
                this.errorMessage = '';
            }, this.timeoutMs);
        },

        async refreshCounters() {
            if (!this.open || !this.adapterId || !this.jobId) return;
            if (this.loadingCounters) return;

            this.loadingCounters = true;
            try {
                const sdk = getSdk();
                const job = await sdk.Jobs.get(this.adapterId, this.jobId);
                this.counters.total_runs = (job as any).totalRuns ?? (job as any).total_runs ?? 0;
                this.counters.success_runs = (job as any).successRuns ?? (job as any).success_runs ?? 0;
                this.counters.error_runs = (job as any).errorRuns ?? (job as any).error_runs ?? 0;
                this.counters.repeat = (job as any).repeat ?? 0;
            } catch {
                // ignore
            } finally {
                this.loadingCounters = false;
            }
        },

        ingestWsEvent(ev: Event) {
            if (!this.open) return;
            if (!ev) return;

            // Only react to events tied to the currently displayed job.
            const data: any = ev.data;
            const jobId = String(data?.job_id ?? data?.jobID ?? '').trim();
            if (!jobId || jobId !== this.jobId) return;

            // Cancel any pending status reset when a new event arrives.
            this.clearTimeout();

            switch (ev.name) {
                case EventName.RunStarted:
                    this.status = 'activated';
                    void this.refreshCounters();
                    return;

                case EventName.RunSuccess:
                    this.status = 'finished';
                    void this.refreshCounters();
                    this.returnToPendingLater();
                    return;

                case EventName.RunError: {
                    try {
                        const run = new JobRun(data);
                        const msgs = (run.results || [])
                            .filter(r => r.status === CommandStatus.Error)
                            .map(r => String(r.message ?? '').trim())
                            .filter(Boolean);
                        this.errorMessage = msgs.join(', ');
                    } catch {
                        this.errorMessage = '';
                    }

                    this.status = 'error';
                    void this.refreshCounters();
                    this.returnToPendingLater();
                    return;
                }

                case EventName.JobSubmitted:
                    void this.refreshCounters();
                    return;

                case EventName.JobFinished:
                    void this.close('auto');
                    return;

                case EventName.JobDeleted:
                    this.status = 'deleted';
                    this.errorMessage = 'job_deleted';
                    void this.refreshCounters();
                    this.timeoutHandle = setTimeout(() => {
                        void this.close('auto');
                    }, this.timeoutMs);
                    return;

                default:
                    return;
            }
        },
    },
});
