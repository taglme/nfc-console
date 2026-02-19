import { defineStore } from 'pinia';
import { JobRun } from 'nfc-jsclient/dist/client/runs';
import { EventName } from 'nfc-jsclient/dist/models/events';
import type { Event } from 'nfc-jsclient/dist/client/events';

export const useRunsStore = defineStore('runs', {
    state: () => ({
        lastRunByAdapterId: {} as Record<string, JobRun>,
        lastRunByJobId: {} as Record<string, JobRun>,
        lastRunEventNameByJobId: {} as Record<string, EventName>,
        parseError: '' as string,
    }),

    actions: {
        ingestWsEvent(event: Event) {
            if (event.name !== EventName.RunSuccess && event.name !== EventName.RunError) return;
            if (!event.data) return;

            try {
                const run = new JobRun(event.data);
                if (run.adapterID) {
                    this.lastRunByAdapterId[run.adapterID] = run;
                }
                if (run.jobID) {
                    this.lastRunByJobId[run.jobID] = run;
                    this.lastRunEventNameByJobId[run.jobID] = event.name;
                }
                this.parseError = '';
            } catch (e) {
                this.parseError = e instanceof Error ? e.message : String(e);
            }
        },
    },
});
