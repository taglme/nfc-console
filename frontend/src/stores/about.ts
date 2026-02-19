import { defineStore } from 'pinia';
import type { AppInfo } from 'nfc-jsclient/dist/client/about';

import { getSdk } from '../services/sdk';

export const useAboutStore = defineStore('about', {
    state: () => ({
        info: null as AppInfo | null,
        loading: false,
        error: '' as string,
    }),

    actions: {
        async refresh() {
            this.loading = true;
            this.error = '';
            try {
                const sdk = getSdk();
                this.info = await sdk.About.get();
            } catch (e) {
                this.error = e instanceof Error ? e.message : String(e);
                this.info = null;
            } finally {
                this.loading = false;
            }
        },
    },
});
