import { defineStore } from 'pinia';
import type { LicenseAccessResource } from 'nfc-jsclient/dist/models/license';

import { getSdk } from '../services/sdk';

export const useLicenseStore = defineStore('license', {
    state: () => ({
        access: null as LicenseAccessResource | null,
        loading: false,
        error: '' as string,
        fetchedAt: 0 as number,
    }),

    getters: {
        hostTier: s => s.access?.host_tier ?? 'community',
        capabilities: s => s.access?.job_capabilities ?? null,
        constraints: s => s.access?.create_job_constraints ?? null,
        rateLimit: s => s.access?.create_job_rate_limit ?? null,
    },

    actions: {
        async refreshAccess() {
            this.loading = true;
            this.error = '';
            try {
                const sdk = getSdk();
                this.access = await sdk.Licenses.getAccess();
                this.fetchedAt = Date.now();
            } catch (e) {
                this.error = e instanceof Error ? e.message : String(e);
                this.access = null;
            } finally {
                this.loading = false;
            }
        },
    },
});
